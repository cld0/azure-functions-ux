import { BroadcastService } from 'app/shared/services/broadcast.service';
import { AiService } from 'app/shared/services/ai.service';
import { Injector } from '@angular/core';
import { ArmUtil } from 'app/shared/Utilities/arm-utils';
import { UrlTemplates } from './url-templates';
import { Subject } from 'rxjs/Subject';
import { SiteService } from './services/slots.service';
import { Http, Headers, Response, ResponseType } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { TranslateService } from '@ngx-translate/core';
import { ConfigService } from './services/config.service';
import { NoCorsHttpService } from './no-cors-http-service';
import { ErrorIds } from './models/error-ids';
import { DiagnosticsResult } from './models/diagnostics-result';
import { FunctionsResponse } from './models/functions-response';
import { AuthzService } from './services/authz.service';
import { LanguageService } from './services/language.service';
import { SiteConfig } from './models/arm/site-config';
import { FunctionInfo } from './models/function-info';
import { VfsObject } from './models/vfs-object';
import { ApiProxy } from './models/api-proxy';
import { CreateFunctionInfo } from './models/create-function-info';
import { FunctionTemplate } from './models/function-template';
import { DesignerSchema } from './models/designer-schema';
import { FunctionSecrets } from './models/function-secrets';
import { BindingConfig, RuntimeExtension } from './models/binding';
import { UserService } from './services/user.service';
import { FunctionContainer } from './models/function-container';
import { RunFunctionResult } from './models/run-function-result';
import { Constants } from './models/constants';
import { Cache, ClearCache, ClearAllFunctionCache } from './decorators/cache.decorator';
import { GlobalStateService } from './services/global-state.service';
import { PortalResources } from './models/portal-resources';
import { Cookie } from 'ng2-cookies/ng2-cookies';
import { ArmService } from './services/arm.service';
import { BroadcastEvent } from './models/broadcast-event';
import { ErrorEvent, ErrorType } from './models/error-event';
import { HttpRunModel } from './models/http-run';
import { FunctionKeys, FunctionKey } from './models/function-key';
import { CacheService } from './services/cache.service';
import { ArmObj } from './models/arm/arm-obj';
import { Site } from './models/arm/site';
import { AuthSettings } from './models/auth-settings';
import { FunctionAppEditMode } from './models/function-app-edit-mode';
import { HostStatus } from './models/host-status';
import { FunctionsVersionInfoHelper } from './models/functions-version-info';
import * as jsonschema from 'jsonschema';
import { reachableInternalLoadBalancerApp } from '../shared/Utilities/internal-load-balancer';

export class FunctionApp {
    private masterKey: string;
    private token: string;
    private siteName: string;
    private ngUnsubscribe = new Subject();

    public selectedFunction: string;
    public selectedLanguage: string;
    public selectedProvider: string;
    public selectedFunctionName: string;

    public isMultiKeySupported = true;
    public isAlwaysOn = false;
    public isDeleted = false;
    // https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html

    public tryFunctionsScmCreds: string;
    private _http: NoCorsHttpService;

    private _ngHttp: Http;
    private _userService: UserService;
    private _globalStateService: GlobalStateService;
    private _translateService: TranslateService;
    private _broadcastService: BroadcastService;
    private _armService: ArmService;
    private _cacheService: CacheService;
    private _languageService: LanguageService;
    private _authZService: AuthzService;
    private _aiService: AiService;
    private _configService: ConfigService;
    private _slotsService: SiteService;

    constructor(public site: ArmObj<Site>, injector: Injector) {

        this._ngHttp = injector.get(Http);
        this._userService = injector.get(UserService);
        this._globalStateService = injector.get(GlobalStateService);
        this._translateService = injector.get(TranslateService);
        this._broadcastService = injector.get(BroadcastService);
        this._armService = injector.get(ArmService);
        this._cacheService = injector.get(CacheService);
        this._languageService = injector.get(LanguageService);
        this._authZService = injector.get(AuthzService);
        this._aiService = injector.get(AiService);
        this._configService = injector.get(ConfigService);
        this._slotsService = injector.get(SiteService);

        this._http = new NoCorsHttpService(this._cacheService, this._ngHttp, this._broadcastService, this._aiService, this._translateService, () => this.getPortalHeaders());

        if (!this._globalStateService.showTryView) {
            this._userService.getStartupInfo()
                .takeUntil(this.ngUnsubscribe)
                .mergeMap(info => {
                    this.token = info.token;
                    return Observable.zip(
                        this._authZService.hasPermission(this.site.id, [AuthzService.writeScope]),
                        this._authZService.hasReadOnlyLock(this.site.id),
                        (p, l) => ({ hasWritePermissions: p, hasReadOnlyLock: l })
                    );
                })
                .mergeMap(r => {
                    if (r.hasWritePermissions && !r.hasReadOnlyLock) {
                        return this.getExtensionVersion();
                    }

                    return Observable.of(null);
                })
                .mergeMap(extensionVersion => {
                    if (extensionVersion) {
                        return this._languageService.getResources(extensionVersion);
                    }

                    return Observable.of(null);
                })
                .do(null, e => {
                    this._aiService.trackException(e, 'FunctionApp().getStartupInfo()');
                })
                .subscribe(() => { });

        }

        const scmUrl = FunctionApp.getScmUrl(this._configService, this.site);
        const mainSiteUrl = FunctionApp.getMainUrl(this._configService, this.site);


        this.siteName = this.site.name;

        const fc = <FunctionContainer>site;
        if (fc.tryScmCred != null) {
            this.tryFunctionsScmCreds = fc.tryScmCred;
        }

        if (Cookie.get('TryAppServiceToken')) {
            this._globalStateService.TryAppServiceToken = Cookie.get('TryAppServiceToken');
            const templateId = Cookie.get('templateId');
            this.selectedFunction = templateId.split('-')[0].trim();
            this.selectedLanguage = templateId.split('-')[1].trim();
            this.selectedProvider = Cookie.get('provider');
            this.selectedFunctionName = Cookie.get('functionName');
        }
    }

    public static getMainUrl(configService: ConfigService, site: ArmObj<Site>) {
        if (configService.isStandalone()) {
            return `https://${site.properties.defaultHostName}/functions/${site.name}`;
        }
        else {
            return `https://${site.properties.defaultHostName}`;
        }
    }

    // In standalone mode, there isn't a concept of a separate SCM site.  Instead, all calls that would
    // normally go to the main or scm site are routed to a single server and are distinguished by either
    // "/api" (scm site) or "/admin" (main site)
    public static getScmUrl(configService: ConfigService, site: ArmObj<Site>) {
        if (configService.isStandalone()) {
            return FunctionApp.getMainUrl(configService, site);
        }
        else {
            return `https://${site.properties.hostNameSslStates.find(s => s.hostType === 1).name}`;
        }
    }








    // to talk to scm site
    private getScmSiteHeaders(contentType?: string): Headers {
        contentType = contentType || 'application/json';
        const headers = new Headers();
        headers.append('Content-Type', contentType);
        headers.append('Accept', 'application/json,*/*');
        if (!this._globalStateService.showTryView && this.token) {
            headers.append('Authorization', `Bearer ${this.token}`);
        }

        if (this.tryFunctionsScmCreds) {
            headers.append('Authorization', `Basic ${this.tryFunctionsScmCreds}`);
        }

        if (this.masterKey) {
            headers.append('x-functions-key', this.masterKey);
        }
        return headers;
    }

    private getMainSiteHeaders(contentType?: string, token?: string): Headers {
        contentType = contentType || 'application/json';
        const headers = new Headers();
        headers.append('Content-Type', contentType);
        headers.append('Accept', 'application/json,*/*');
        headers.append('x-functions-key', this.masterKey);
        if (token) {
            headers.append('Authorization', `Bearer ${token}`);
        }
        return headers;
    }

    // to talk to Functions Portal
    private getPortalHeaders(contentType?: string): Headers {
        contentType = contentType || 'application/json';
        const headers = new Headers();
        headers.append('Content-Type', contentType);
        headers.append('Accept', 'application/json,*/*');

        if (this.token) {
            headers.append('client-token', this.token);
            headers.append('portal-token', this.token);
        }

        return headers;
    }


    private retryAntares(error: Observable<any>): Observable<any> {
        return error.scan((errorCount: number, err: FunctionsResponse) => {
            if (err.status === 500 || err.status === 502 && errorCount < 5) {
                return errorCount + 1;
            } else {
                throw err;
            }
        }, 0).delay(1000);
    }

    /**
     * This function is just a wrapper around AiService.trackEvent. It injects default params expected from this class.
     * Currently that's only scmUrl
     * @param params any additional parameters to get added to the default parameters that this class reports to AppInsights
     */
    private trackEvent(name: string, params: { [name: string]: string }) {
        const standardParams = {
            scmUrl: this.urlTemplates.pingScmSiteUrl
        };

        for (const key in params) {
            if (params.hasOwnProperty(key)) {
                standardParams[key] = params[key];
            }
        }

        this._aiService.trackEvent(name, standardParams);
    }

    private sanitize(value: string): string {
        if (value) {
            return value.substring(0, Math.min(3, value.length));
        } else {
            return 'undefined';
        }
    }


    updateDisabledAppSettings(infos: FunctionInfo[]): Observable<any> {
        if (infos.length > 0) {
            return this._cacheService.postArm(`${this.site.id}/config/appsettings/list`, true)
                .flatMap(r => {
                    const appSettings: ArmObj<any> = r.json();
                    let needToUpdate = false;
                    infos.forEach(info => {
                        const appSettingName = `AzureWebJobs.${info.name}.Disabled`;
                        if (info.config.disabled) {
                            appSettings.properties[appSettingName] = 'true';
                            needToUpdate = true;
                        } else if (appSettings.properties[appSettingName]) {
                            delete appSettings.properties[appSettingName];
                            needToUpdate = true;
                        }
                    });

                    return needToUpdate ? this._cacheService.putArm(appSettings.id, this._armService.websiteApiVersion, appSettings) : Observable.of(null);
                });
        } else {
            return Observable.of(null);
        }
    }

    checkRuntimeStatus(): Observable<HostStatus | null> {
        const hostStatus = this.getFunctionHostStatus(false);
        hostStatus
            .subscribe(status => {
                if (status.state !== 'Running') {
                    status.errors = status.errors || [];
                    this._broadcastService.broadcast<ErrorEvent>(BroadcastEvent.Error, {
                        message: this._translateService.instant(PortalResources.error_functionRuntimeIsUnableToStart)
                            + '\n'
                            + status.errors.reduce((a, b) => `${a}\n${b}`),
                        errorId: ErrorIds.functionRuntimeIsUnableToStart,
                        errorType: ErrorType.Fatal,
                        resourceId: this.site.id
                    });
                    this.trackEvent(ErrorIds.functionRuntimeIsUnableToStart, {
                        content: status.errors.reduce((a, b) => `${a}\n${b}`),
                        status: '200'
                    });
                }
            }, e => {
                // 403 is app stopped. We shouldn't display an error
                if (e.status !== 403) {
                    let content = e;
                    let status = '0';
                    try {
                        content = e.text ? e.text() : e;
                        status = e.status ? e.status.toString() : '0';
                    } catch (_) { }

                    this._broadcastService.broadcast<ErrorEvent>(BroadcastEvent.Error, {
                        message: this._translateService.instant(PortalResources.error_functionRuntimeIsUnableToStart),
                        errorId: ErrorIds.functionRuntimeIsUnableToStart,
                        errorType: ErrorType.Fatal,
                        resourceId: this.site.id
                    });
                    this.trackEvent(ErrorIds.functionRuntimeIsUnableToStart, {
                        content: content,
                        status: status
                    });
                }
            });
        return hostStatus.catch(e => Observable.of(null));
    }

    checkFunctionStatus(fi: FunctionInfo): Observable<boolean> {
        const functionErrors = this.getFunctionErrors(fi)
            .switchMap(errors => {
                this._broadcastService.broadcast<string>(BroadcastEvent.ClearError, ErrorIds.generalFunctionErrorFromHost + ';' + fi.name);
                // Give clearing a chance to run
                if (errors) {
                    setTimeout(() => {
                        errors.forEach(e => {
                            this._broadcastService.broadcast<ErrorEvent>(BroadcastEvent.Error, {
                                message: this._translateService.instant(PortalResources.functionDev_functionErrorMessage, { name: fi.name, error: e }),
                                details: this._translateService.instant(PortalResources.functionDev_functionErrorDetails, { error: e }),
                                errorId: ErrorIds.generalFunctionErrorFromHost + ';' + fi.name,
                                errorType: ErrorType.FunctionError,
                                resourceId: this.site.id
                            });
                            this._aiService.trackEvent(ErrorIds.generalFunctionErrorFromHost, { error: e, functionName: fi.name, functionConfig: JSON.stringify(fi.config) });
                        });
                    });
                    return Observable.of(true);
                } else {
                    return this.checkRuntimeStatus().map(s => s.state !== 'Running');
                }
            });
        functionErrors.subscribe(_ => _);
        return functionErrors;
    }

    dispose() {
        this.ngUnsubscribe.next();
    }
}
