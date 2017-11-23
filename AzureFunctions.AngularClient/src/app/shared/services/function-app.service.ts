import { CacheService } from 'app/shared/services/cache.service';
import { FunctionAppContext } from './functions-service';
import { Injectable } from '@angular/core';
import { Headers, Request, Response, ResponseType } from '@angular/http';
import { FunctionInfo } from 'app/shared/models/function-info';
import { FunctionAppHttpResult } from './../models/function-app-http-result';
import { UrlTemplates } from 'app/shared/url-templates';
import { ArmObj } from 'app/shared/models/arm/arm-obj';
import { FunctionsVersionInfoHelper } from 'app/shared/models/functions-version-info';
import { Constants } from 'app/shared/models/constants';
import { ArmUtil } from 'app/shared/Utilities/arm-utils';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/zip';
import { ApiProxy } from 'app/shared/models/api-proxy';
import * as jsonschema from 'jsonschema';
import { VfsObject } from 'app/shared/models/vfs-object';
import { FunctionTemplate } from 'app/shared/models/function-template';
import { CreateFunctionInfo } from 'app/shared/models/create-function-info';
import { HttpRunModel } from 'app/shared/models/http-run';
import { FunctionKeys, FunctionKey } from 'app/shared/models/function-key';
import { BindingConfig } from 'app/shared/models/binding';
import { HostStatus } from 'app/shared/models/host-status';
import { SiteConfig } from 'app/shared/models/arm/site-config';
import { Subject } from 'rxjs/Subject';
import { FunctionAppEditMode } from 'app/shared/models/function-app-edit-mode';
import { Site } from 'app/shared/models/arm/site';
import { AuthSettings } from 'app/shared/models/auth-settings';
import { RunFunctionResult } from 'app/shared/models/run-function-result';
import { PortalResources } from 'app/shared/models/portal-resources';
import { ConditionalHttpClient } from 'app/shared/conditional-http-client';
import { TranslateService } from '@ngx-translate/core';


type Result<T> = Observable<FunctionAppHttpResult<T>>;
@Injectable()
export class FunctionAppService {
    private readonly runtime: ConditionalHttpClient;
    private readonly azure: ConditionalHttpClient;

    constructor(private _cacheService: CacheService, private _translateService: TranslateService) {
        this.runtime = new ConditionalHttpClient(_cacheService, 'NoClientCertificate', 'NotOverQuota', 'NotStopped', 'ReachableLoadballancer');
        this.azure = new ConditionalHttpClient(_cacheService, 'NotOverQuota', 'ReachableLoadballancer');
    }

    getClient(context: FunctionAppContext) {
        return ArmUtil.isLinuxApp(context.site) ? this.runtime : this.azure;
    }

    getFunctions(context: FunctionAppContext): Result<FunctionInfo[]> {
        return this.getClient(context).execute(context, t => Observable.zip(
            this._cacheService.get(context.urlTemplates.functionsUrl, false, this.headers(t)),
            this._cacheService.postArm(`${context.site.id}/config/appsettings/list`),
            (functions, appSettings) => ({ functions: functions as FunctionInfo[], appSettings: appSettings.json() }))
            .map(result => {
                // For runtime 2.0 we use settings for disabling functions
                const appSettings = result.appSettings as ArmObj<{ [key: string]: string }>;
                if (FunctionsVersionInfoHelper.getFuntionGeneration(appSettings.properties[Constants.runtimeVersionAppSettingName]) === 'V2') {
                    result.functions.forEach(f => {
                        const disabledSetting = appSettings.properties[`AzureWebJobs.${f.name}.Disabled`];
                        f.config.disabled = (disabledSetting && disabledSetting.toLocaleLowerCase() === 'true');
                    });
                }
                return result.functions;
            }));
    }

    getApiProxies(context: FunctionAppContext): Result<ApiProxy[]> {
        const client = this.getClient(context);
        return client.execute(context, t => Observable.zip(
            this._cacheService.get(context.urlTemplates.proxiesJsonUrl, false, this.headers(t)),
            this._cacheService.get('assets/schemas/proxies.json', false),
            (p, s) => ({ proxies: p, schema: s.json() })
        ).map(r => {
            const proxies = r.proxies.json();
            if (proxies.proxies) {
                const validateResult = jsonschema.validate(proxies, r.schema).toString();
                if (validateResult) {
                    // error
                    return ApiProxy.fromJson({});
                }
            }
            return ApiProxy.fromJson(proxies);
        }));
    }

    saveApiProxy(context: FunctionAppContext, jsonString: string): Result<Response> {
        const uri = context.urlTemplates.proxiesJsonUrl;

        this._cacheService.clearCachePrefix(uri);
        return this.getClient(context).execute(context, t => this._cacheService.put(uri, this.headers(t, ['If-Match', '*']), jsonString));
    }

    getFileContent(context: FunctionAppContext, file: VfsObject | string): Result<string> {
        const fileHref = typeof file === 'string' ? file : file.href;

        return this.getClient(context).execute(context, t => this._cacheService.get(fileHref, false, this.headers(t)).map(r => r.text()));
    }

    saveFile(context: FunctionAppContext, file: VfsObject | string, updatedContent: string, functionInfo?: FunctionInfo): Result<VfsObject | string> {
        const fileHref = typeof file === 'string' ? file : file.href;

        return this.getClient(context).execute(context, t =>
            this._cacheService.put(fileHref, this.headers(t, ['Content-Type', 'plain/text'], ['If-Match', '*']), updatedContent).map(() => file));
    }

    deleteFile(context: FunctionAppContext, file: VfsObject | string, functionInfo?: FunctionInfo): Result<VfsObject | string> {
        const fileHref = typeof file === 'string' ? file : file.href;

        return this.getClient(context).execute(context, t =>
            this._cacheService.delete(fileHref, this.headers(t, ['Content-Type', 'plain/text'], ['If-Match', '*'])).map(() => file));
    }

    private getExtensionVersionFromAppSettings(context: FunctionAppContext) {
        return this._cacheService.postArm(`${context.site.id}/config/appsettings/list`)
            .map(r => {
                const appSettingsArm: ArmObj<any> = r.json();
                return appSettingsArm.properties[Constants.runtimeVersionAppSettingName];
            });
    }

    getTemplates(context: FunctionAppContext): Result<FunctionTemplate[]> {
        // this is for dev scenario for loading custom templates
        try {
            if (localStorage.getItem('dev-templates')) {
                const devTemplate: FunctionTemplate[] = JSON.parse(localStorage.getItem('dev-templates'));
                this.localize(devTemplate);
                return Observable.of({
                    isSuccessful: true,
                    result: devTemplate,
                    error: null
                });
            }
        } catch (e) {
            console.error(e);
        }
        return this.azure.executeWithConditions([], context, t =>
            this.getExtensionVersionFromAppSettings(context)
                .mergeMap(extensionVersion => {
                    return this._cacheService.get(
                        Constants.serviceHost + 'api/templates?runtime=' + (extensionVersion || 'latest'),
                        true,
                        this.portalHeaders(t));
                })
                .map(r => {
                    const object = r.json();
                    this.localize(object);
                    return object;
                }));
    }

    createFunction(context: FunctionAppContext, functionName: string, templateId: string): Result<FunctionInfo> {
        const body = templateId
            ? {
                name: functionName,
                templateId: (templateId && templateId !== 'Empty' ? templateId : null)
            }
            : {
                config: {}
            };

        return this.getClient(context).execute(context, t =>
            this._cacheService.put(context.urlTemplates.getFunctionUrl(functionName), this.headers(t), JSON.stringify(body))
                .map(r => r.json()));
    }

    // TODO: this function is suspect
    getFunctionContainerAppSettings(context: FunctionAppContext) {
        return this.getClient(context).executeWithConditions([], context, t =>
            this._cacheService.get(context.urlTemplates.scmSettingsUrl, false, this.headers(t))
                .map(r => r.json() as { [key: string]: string }));
    }

    createFunctionV2(context: FunctionAppContext, functionName: string, files: any, config: any) {
        const filesCopy = Object.assign({}, files);
        const sampleData = filesCopy['sample.dat'];
        delete filesCopy['sample.dat'];

        const content = JSON.stringify({ files: filesCopy, test_data: sampleData, config: config });
        const url = context.urlTemplates.getFunctionUrl(functionName);

        return this.getClient(context).executeWithConditions([], context, t =>
            this._cacheService.put(url, this.headers(t), content).map(r => r.json() as FunctionInfo));
    }

    statusCodeToText(code: number) {
        const statusClass = Math.floor(code / 100) * 100;
        return Constants.HttpConstants.statusCodeMap[code] || Constants.HttpConstants.genericStatusCodeMap[statusClass] || 'Unknown Status Code';
    }

    runHttpFunction(context, functionInfo: FunctionInfo, url: string, model: HttpRunModel) {
        const content = model.body;

        const regExp = /\{([^}]+)\}/g;
        const matchesPathParams = url.match(regExp);
        const processedParams = [];

        const splitResults = url.split('?');
        if (splitResults.length === 2) {
            url = splitResults[0];
        }

        if (matchesPathParams) {
            matchesPathParams.forEach((m) => {
                const name = m.split(':')[0].replace('{', '').replace('}', '');
                processedParams.push(name);
                const param = model.queryStringParams.find((p) => {
                    return p.name === name;
                });
                if (param) {
                    url = url.replace(m, param.value);
                }
            });
        }

        let queryString = '';
        if (model.code) {
            queryString = `?${model.code.name}=${model.code.value}`;
        }
        model.queryStringParams.forEach(p => {
            const findResult = processedParams.find((pr) => {
                return pr === p.name;
            });

            if (!findResult) {
                if (!queryString) {
                    queryString += '?';
                } else {
                    queryString += '&';
                }
                queryString += p.name + '=' + p.value;
            }
        });
        url = url + queryString;
        const inputBinding = (functionInfo.config && functionInfo.config.bindings
            ? functionInfo.config.bindings.find(e => e.type === 'httpTrigger')
            : null);

        let contentType: string;
        if (!inputBinding || inputBinding && inputBinding.webHookType) {
            contentType = 'application/json';
        }

        const headers = this.getMainSiteHeaders(contentType);
        model.headers.forEach((h) => {
            headers.append(h.name, h.value);
        });

        let response: Observable<Response>;
        switch (model.method) {
            case Constants.HttpMethods.GET:
                // make sure to pass 'true' to force make a request.
                // there is no scenario where we want cached data for a function run.
                response = this._cacheService.get(url, true, headers);
                break;
            case Constants.HttpMethods.POST:
                response = this._cacheService.post(url, true, headers, content);
                break;
            case Constants.HttpMethods.DELETE:
                response = this._cacheService.delete(url, headers);
                break;
            case Constants.HttpMethods.HEAD:
                response = this._cacheService.head(url, true, headers);
                break;
            case Constants.HttpMethods.PATCH:
                response = this._cacheService.patch(url, headers, content);
                break;
            case Constants.HttpMethods.PUT:
                response = this._cacheService.put(url, headers, content);
                break;
            default:
                response = this._cacheService.send(url, model.method, true, headers, content);
                break;
        }

        return this.runFunctionInternal(context, response, functionInfo);
    }

    runFunction(context: FunctionAppContext, functionInfo: FunctionInfo, content: string) {
        const url = context.urlTemplates.getRunFunctionUrl(functionInfo.name.toLocaleLowerCase());
        const _content: string = JSON.stringify({ input: content });
        let contentType: string;

        try {
            JSON.parse(_content);
            contentType = 'application/json';
        } catch (e) {
            contentType = 'plain/text';
        }

        return this.getClient(context).executeWithConditions([], context, t =>
            this.runFunctionInternal(context, this._cacheService.post(url, true, this.headers(['Content-Type', contentType]), _content), functionInfo));
    }

    deleteFunction(context: FunctionAppContext, functionInfo: FunctionInfo): Result<void> {
        return this.getClient(context).execute(context, t =>
            this._cacheService.delete(functionInfo.href, this.headers(t))
                .concatMap(r => this.getRuntimeGeneration())
                .concatMap((runtimeVersion: string) => {
                    return runtimeVersion === 'V2'
                        ? this.updateDisabledAppSettings([functionInfo])
                        : Observable.of(null);
                }));
    }

    getDesignerSchema() {
        return this._http.get(Constants.serviceHost + 'mocks/function-json-schema.json')
            .retryWhen(this.retryAntares)
            .map(r => <DesignerSchema>r.json());
    }

    getHostJson(context: FunctionAppContext): Observable<any> {
        return this.getClient(context).execute(context, t =>
            this._cacheService.get(context.urlTemplates.hostJsonUrl, false, this.headers(t)).map(r => r.json()));
    }

    saveFunction(context: FunctionAppContext, fi: FunctionInfo, config: any) {
        return this.getClient(context).execute(context, t =>
            this._cacheService.put(fi.href, this.headers(t), JSON.stringify({ config: config })).map(r => r.json() as FunctionInfo));
    }

    getHostToken(context: FunctionAppContext) {
        return ArmUtil.isLinuxApp(context.site)
            ? this.azure.executeWithConditions([], context, t =>
                this._cacheService.get(Constants.serviceHost + `api/runtimetoken${context.site.id}`, false, this.portalHeaders(t)))
            : this.azure.execute(context, t =>
                this._cacheService.get(context.urlTemplates.scmTokenUrl, false, this.headers(t)));
    }

    getHostKeys(context: FunctionAppContext): Result<FunctionKeys> {
        return this.runtime.execute(context, t =>
            this._cacheService.get(context.urlTemplates.adminKeysUrl, false, this.headers(t))
                .map(r => {
                    const keys: FunctionKeys = r.json();
                    if (keys && Array.isArray(keys.keys)) {
                        keys.keys.unshift({
                            name: '_master',
                            value: '{:val}'
                        });
                    }
                    return keys;
                }));
    }

    getBindingConfig(context: FunctionAppContext): Result<BindingConfig> {
        try {
            if (localStorage.getItem('dev-bindings')) {
                const devBindings: BindingConfig = JSON.parse(localStorage.getItem('dev-bindings'));
                this.localize(devBindings);
                return Observable.of({
                    isSuccessful: true,
                    result: devBindings,
                    error: null
                });
            }
        } catch (e) {
            console.error(e);
        }

        return this.azure.execute(context, t => this.getExtensionVersionFromAppSettings(context)
            .concatMap(extensionVersion =>
                this._cacheService.get(`${Constants.serviceHost}api/bindingconfig?runtime=${extensionVersion}`, false, this.portalHeaders(t)))
            .map(r => {
                const object = r.json();
                this.localize(object);
                return object as BindingConfig;
            }));
    }

    updateFunction(context: FunctionAppContext, fi: FunctionInfo): Result<FunctionInfo> {
        const fiCopy = <FunctionInfo>{};
        for (const prop in fi) {
            if (fi.hasOwnProperty(prop) && prop !== 'functionApp') {
                fiCopy[prop] = fi[prop];
            }
        }

        return this.getClient(context).execute(context, t =>
            this._cacheService.put(fi.href, this.headers(t), JSON.stringify(fiCopy))
                .map(r => r.json() as FunctionInfo));
    }

    private getFunctionErrors(context: FunctionAppContext, fi: FunctionInfo, handleUnauthorized?: boolean): Result<string[]> {
        return this.runtime.execute(context, t =>
            this._cacheService.get(context.urlTemplates.getFunctionRuntimeErrorsUrl(fi.name), false, this.headers(t))
                .map(r => (r.json().errors || []) as string[]));
    }

    getHostErrors(context: FunctionAppContext): Result<string[]> {
        return this.runtime.execute(context, t =>
            this._cacheService.get(context.urlTemplates.runtimeStatusUrl, true, this.headers(t))
                .map(r => (r.json().errors || []) as string[]));
    }

    private getFunctionHostStatus(context: FunctionAppContext): Result<HostStatus> {
        return this.runtime.execute(context, t =>
            this._cacheService.get(context.urlTemplates.runtimeStatusUrl, true, this.headers(t))
                .map(r => r.json() as HostStatus));
    }

    getOldLogs(context: FunctionAppContext, fi: FunctionInfo, range: number): Result<string> {
        const url = context.urlTemplates.getFunctionLogUrl(fi.name);

        return this.getClient(context).execute(context, t =>
            this._cacheService.get(url, false, this.headers(t))
                .concatMap(r => {
                    let files: VfsObject[] = r.json();
                    if (files.length > 0) {
                        files = files
                            .map(e => Object.assign({}, e, { parsedTime: new Date(e.mtime) }))
                            .sort((a, b) => a.parsedTime.getTime() - b.parsedTime.getTime());

                        return this._cacheService.get(files.pop().href, false, this.headers(t, ['Range', `bytes=-${range}`]))
                            .map(f => {
                                const content = f.text();
                                const index = content.indexOf('\n');
                                return <string>(index !== -1
                                    ? content.substring(index + 1)
                                    : content);
                            });
                    } else {
                        return Observable.of('');
                    }
                }));
    }

    getVfsObjects(context: FunctionAppContext, fi: FunctionInfo | string): Result<VfsObject[]> {
        const href = typeof fi === 'string' ? fi : fi.script_root_path_href;
        return this.getClient(context).execute(context, t =>
            this._cacheService.get(href, false, this.headers(t)).map(e => <VfsObject[]>e.json()));
    }


    getFunctionKeys(context: FunctionAppContext, functionInfo: FunctionInfo): Result<FunctionKeys> {
        return this.runtime.execute(context, t =>
            this._cacheService.get(context.urlTemplates.getFunctionKeysUrl(functionInfo.name), false, this.headers(t))
                .map(r => r.json() as FunctionKeys));
    }

    createKey(
        context: FunctionAppContext,
        keyName: string,
        keyValue: string,
        functionInfo?: FunctionInfo): Result<FunctionKey> {

        const url = functionInfo
            ? context.urlTemplates.getFunctionKeyUrl(functionInfo.name, keyName)
            : context.urlTemplates.getAdminKeyUrl(keyName);

        const body = keyValue
            ? JSON.stringify({
                name: keyName,
                value: keyValue
            })
            : '';
        return this.runtime.execute(context, t =>
            this._cacheService.put(url, this.headers(t), body).map(r => r.json() as FunctionKey));
    }

    deleteKey(
        context: FunctionAppContext,
        key: FunctionKey,
        functionInfo?: FunctionInfo): Result<void> {

        const url = functionInfo
            ? context.urlTemplates.getFunctionKeyUrl(functionInfo.name, key.name)
            : context.urlTemplates.getAdminKeyUrl(key.name);

        return this.runtime.execute(context, t => this._cacheService.delete(url, this.headers(t)));
    }

    renewKey(context: FunctionAppContext, key: FunctionKey, functionInfo?: FunctionInfo): Result<FunctionKey> {
        const url = functionInfo
            ? context.urlTemplates.getFunctionKeyUrl(functionInfo.name, key.name)
            : context.urlTemplates.getAdminKeyUrl(key.name);

        return this.runtime.execute(context, t => this._cacheService.post(url, true, this.headers(t)));
    }

    fireSyncTrigger(context: FunctionAppContext): void {
        const url = context.urlTemplates.syncTriggersUrl;
        this._cacheService.post(url, true, this.headers())
            .subscribe(success => console.log(success), error => console.log(error));
    }

    isSourceControlEnabled(context: FunctionAppContext): Result<boolean> {
        return this.azure.executeWithConditions([], context, this._cacheService.getArm(`${context.site.id}/config/web`)
            .map(r => {
                const config: ArmObj<SiteConfig> = r.json();
                return !config.properties['scmType'] || config.properties['scmType'] !== 'None';
            }));
    }


    private isSlot(context: FunctionAppContext): boolean {
        // slots id looks like
        // /subscriptions/<subscriptionId>/resourceGroups/<resourceGroupName>/providers/Microsoft.Web/sites/<siteName>/slots/<slotName>
        // split('/')
        //  [
        //      0: "",
        //      1: "subscriptions",
        //      2: "<subscriptionId>",
        //      3: "resourceGroups",
        //      4: "<resourceGroupName>",
        //      5: "providers",
        //      6: "Microsoft.Web",
        //      7: "sites",
        //      8: "<siteName>",
        //      9: "slots:,
        //      10: "<slotName>"
        //  ]
        const siteSegments = context.site.id.split('/');
        return siteSegments.length === 11 && siteSegments[9].toLowerCase() === 'slots';
    }

    getSlotsList(context: FunctionAppContext): Result<ArmObj<Site>[]> {
        return this.isSlot(context)
            ? Observable.of({
                isSuccessful: true,
                result: [],
                error: null
            })
            : this.azure.executeWithConditions([], context, this._cacheService.getArm(`${context.site.id}/slots`)
                .map(r => r.json().value as ArmObj<Site>[]));
    }

    getFunctionAppEditMode(context: FunctionAppContext): Result<FunctionAppEditMode> {
        // The we have 2 settings to check here. There is the SourceControl setting which comes from /config/web
        // and there is FUNCTION_APP_EDIT_MODE which comes from app settings.
        // editMode (true -> readWrite, false -> readOnly)
        // Table
        // |Slots | SourceControl | AppSettingValue | EditMode                      |
        // |------|---------------|-----------------|-------------------------------|
        // | No   | true          | readWrite       | ReadWriteSourceControlled     |
        // | No   | true          | readOnly        | ReadOnlySourceControlled      |
        // | No   | true          | undefined       | ReadOnlySourceControlled      |
        // | No   | false         | readWrite       | ReadWrite                     |
        // | No   | false         | readOnly        | ReadOnly                      |
        // | No   | false         | undefined       | ReadWrite                     |

        // | Yes  | true          | readWrite       | ReadWriteSourceControlled     |
        // | Yes  | true          | readOnly        | ReadOnlySourceControlled      |
        // | Yes  | true          | undefined       | ReadOnlySourceControlled      |
        // | Yes  | false         | readWrite       | ReadWrite                     |
        // | Yes  | false         | readOnly        | ReadOnly                      |
        // | Yes  | false         | undefined       | ReadOnlySlots                 |
        // |______|_______________|_________________|_______________________________|

        return this.azure.executeWithConditions([], context,
            Observable.zip(
                this.isSourceControlEnabled(context),
                this.azure.executeWithConditions([], context, this._cacheService.postArm(`${context.site.id}/config/appsettings/list`, true)),
                this.isSlot(context)
                    ? Observable.of({ isSuccessful: true, result: true, error: null })
                    : this.getSlotsList(context).map(r => r.isSuccessful ? Object.assign(r, { result: r.result.length > 0 }) : r),
                this.getFunctions(context),
                (a, b, s, f) => ({ sourceControlEnabled: a, appSettingsResponse: b, hasSlots: s, functions: f }))
                .map(result => {
                    const appSettings: ArmObj<{ [key: string]: string }> = result.appSettingsResponse.isSuccessful
                        ? result.appSettingsResponse.result.json()
                        : null;

                    const sourceControlled = result.sourceControlEnabled.isSuccessful &&
                        result.sourceControlEnabled.result;

                    let editModeSettingString: string = appSettings ? appSettings.properties[Constants.functionAppEditModeSettingName] || '' : '';
                    editModeSettingString = editModeSettingString.toLocaleLowerCase();
                    const vsCreatedFunc = result.functions.isSuccessful
                        ? !!result.functions.result.find((fc: any) => !!fc.config.generatedBy)
                        : false;

                    if (vsCreatedFunc && (editModeSettingString === Constants.ReadOnlyMode || editModeSettingString === '')) {
                        return FunctionAppEditMode.ReadOnlyVSGenerated;
                    } else if (editModeSettingString === Constants.ReadWriteMode) {
                        return sourceControlled ? FunctionAppEditMode.ReadWriteSourceControlled : FunctionAppEditMode.ReadWrite;
                    } else if (editModeSettingString === Constants.ReadOnlyMode) {
                        return sourceControlled ? FunctionAppEditMode.ReadOnlySourceControlled : FunctionAppEditMode.ReadOnly;
                    } else if (sourceControlled) {
                        return FunctionAppEditMode.ReadOnlySourceControlled;
                    } else {
                        return result.hasSlots ? FunctionAppEditMode.ReadOnlySlots : FunctionAppEditMode.ReadWrite;
                    }
                })
                .catch(() => Observable.of(FunctionAppEditMode.ReadWrite)));
    }

    public getAuthSettings(context: FunctionAppContext): Result<AuthSettings> {
        return this.azure.executeWithConditions([], context, this._cacheService.postArm(`${context.site.id}/config/authsettings/list`)
            .map(r => {
                const auth: ArmObj<any> = r.json();
                return {
                    easyAuthEnabled: auth.properties['enabled'] && auth.properties['unauthenticatedClientAction'] !== 1,
                    AADConfigured: auth.properties['clientId'] || false,
                    AADNotConfigured: auth.properties['clientId'] ? false : true,
                    clientCertEnabled: context.site.properties.clientCertEnabled
                };
            }));
    }

    /**
     * This method just pings the root of the SCM site. It doesn't care about the response in anyway or use it.
     */
    pingScmSite(context: FunctionAppContext): Result<boolean> {
        return this.azure.execute(context, t =>
            this._cacheService.get(context.urlTemplates.pingScmSiteUrl, true, this.headers(t))
                .map(_ => true)
                .catch(() => Observable.of(false)));
    }

    private runFunctionInternal(context: FunctionAppContext, response: Observable<Response>, functionInfo: FunctionInfo) {
        return response
            .catch((e: Response) => {
                return this.getAuthSettings(context)
                    .map(r => r.isSuccessful ? r.result : { easyAuthEnabled: false, clientCertEnabled: false })
                    .mergeMap(authSettings => {
                        if (authSettings.easyAuthEnabled) {
                            return Observable.of({
                                status: 401,
                                statusText: this.statusCodeToText(401),
                                text: () => this._translateService.instant(PortalResources.functionService_authIsEnabled)
                            });
                        } else if (authSettings.clientCertEnabled) {
                            return Observable.of({
                                status: 401,
                                statusText: this.statusCodeToText(401),
                                text: () => this._translateService.instant(PortalResources.functionService_clientCertEnabled)
                            });
                        } else if (e.status === 200 && e.type === ResponseType.Error) {
                            return Observable.of({
                                status: 502,
                                statusText: this.statusCodeToText(502),
                                text: () => this._translateService.instant(PortalResources.functionService_errorRunningFunc, {
                                    name: functionInfo.name
                                })
                            });
                        } else if (e.status === 0 && e.type === ResponseType.Error) {
                            return Observable.of({
                                status: 0,
                                statusText: this.statusCodeToText(0),
                                text: () => ''
                            });
                        } else {
                            let text = '';
                            try {
                                text = JSON.stringify(e.json(), undefined, 2);
                            } catch (ex) {
                                text = e.text();
                            }

                            return Observable.of({
                                status: e.status,
                                statusText: this.statusCodeToText(e.status),
                                text: () => text
                            });
                        }
                    });
            })
            .map(r => <RunFunctionResult>({ statusCode: r.status, statusText: this.statusCodeToText(r.status), content: r.text() }));
    }

    getGeneratedSwaggerData(context: FunctionAppContext): Result<any> {
        const url: string = context.urlTemplates.getGeneratedSwaggerDataUrl;
        return this.runtime.execute(context, t => this._cacheService.get(url, false, this.headers(t)).map(r => r.json()));
    }

    getSwaggerDocument(context: FunctionAppContext): Result<any> {
        const url: string = context.urlTemplates.getSwaggerDocumentUrl;
        return this.runtime.execute(context, t => this._cacheService.get(url, false, this.headers(t)).map(r => r.json()));
    }

    //addOrUpdateSwaggerDocument(swaggerUrl: string, content: string) {
    //    return this._cacheService.post(swaggerUrl, false, t, content).map(r => r.json())
    //}

    //deleteSwaggerDocument(swaggerUrl: string) {
    //    return this._http.delete(swaggerUrl)
    // }

    saveHostJson(context: FunctionAppContext, jsonString: string): Result<any> {
        return this.getClient(context).execute(context, t =>
            this._cacheService.put(context.urlTemplates.hostJsonUrl, this.headers(t, ['If-Match', '*']), jsonString).map(r => r.json()));
    }

    createSystemKey(context: FunctionAppContext, keyName: string) {
        return this.runtime.execute(context, t => this._cacheService.post(context.urlTemplates.getSystemKeyUrl(keyName), true, this.headers(t, ['If-Match', '*']))
            .map(r => r.json()));
    }

    // Try and the list of runtime extensions install.
    // If there was an error getting the list, show an error. return an empty list.
    getHostExtensions(): Observable<any> {
        const masterKey = this.masterKey
            ? Observable.of(null)
            : this.getHostSecretsFromScm();
        return masterKey
            .mergeMap(_ => {
                const headers = this.getMainSiteHeaders();
                return this._http.get(this.urlTemplates.runtimeHostExtensionsUrl, { headers: headers })
                    .map(r => <FunctionKeys>r.json())
            }).catch(e => {
                return Observable.of(e);
            });
    }

    // Todo: Capture 409
    // returns error object when resulted in error
    // error.id is not defined
    installExtension(extension: RuntimeExtension): Observable<any> {
        const masterKey = this.masterKey
            ? Observable.of(null)
            : this.getHostSecretsFromScm();
        return masterKey
            .mergeMap(_ => {
                const headers = this.getMainSiteHeaders();
                return this._http.post(this.urlTemplates.runtimeHostExtensionsUrl, extension, { headers: headers })
                    .map(r => <FunctionKeys>r.json())
            }).catch(e => {
                return Observable.of(e);
            });
    }

    getExtensionInstallStatus(jobId: string): Observable<any> {
        const masterKey = this.masterKey
            ? Observable.of(null)
            : this.getHostSecretsFromScm();
        return masterKey
            .mergeMap(_ => {
                const headers = this.getMainSiteHeaders();
                return this._http.get(this.urlTemplates.getRuntimeHostExtensionsJobStatusUrl(jobId), { headers: headers })
                    .map(r => <FunctionKeys>r.json())
                    .do(__ => this._broadcastService.broadcast<string>(BroadcastEvent.ClearError, ErrorIds.failedToGetExtensionInstallStatus),
                    (error: FunctionsResponse) => {
                        if (!error.isHandled) {
                            this.trackEvent(ErrorIds.failedToGetExtensionInstallStatus, {
                                status: error.status.toString(),
                                content: error.text(),
                            });
                        }
                    });
            }).catch(_ => {
                return Observable.of(
                    {
                        id: jobId
                    });
            });
    }

    getSystemKey(): Observable<FunctionKeys> {
        const masterKey = this.masterKey
            ? Observable.of(null) // you have to pass something to Observable.of() otherwise it doesn't trigger subscribers.
            : this.getHostSecretsFromScm();

        return masterKey
            .mergeMap(_ => {
                const headers = this.getMainSiteHeaders();
                return this._http.get(this.urlTemplates.systemKeysUrl, { headers: headers })
                    .map(r => <FunctionKeys>r.json())
                    .catch(e => this.checkRuntimeStatus().map(() => ({ keys: [], links: [] })));
            });
    }

    getEventGridKey(): Observable<string> {
        return this.getSystemKey().map(keys => {
            const eventGridKey = keys.keys.find(k => k.name === Constants.eventGridName);
            return eventGridKey ? eventGridKey.value : '';
        });
    }

    // Modeled off of EventHub trigger's 'custom' tab when creating a new Event Hub connection
    createApplicationSetting(appSettingName: string, appSettingValue: string, replaceIfExists: boolean = true): Observable<any> | null {
        if (appSettingName && appSettingValue) {
            return this._cacheService.postArm(`${this.site.id}/config/appsettings/list`, true).flatMap(
                r => {
                    const appSettings: ArmObj<any> = r.json();
                    if (!replaceIfExists && appSettings.properties[appSettingName]) {
                        return Observable.of(r);
                    }
                    appSettings.properties[appSettingName] = appSettingValue;
                    return this._cacheService.putArm(appSettings.id, this._armService.websiteApiVersion, appSettings);
                });
        } else {
            return null;
        }
    }

    // Set multiple auth settings at once
    createAuthSettings(newAuthSettings: Map<string, any>): Observable<any> {
        if (newAuthSettings.size > 0) {
            return this._cacheService.postArm(`${this.site.id}/config/authsettings/list`, true)
                .flatMap(r => {
                    var authSettings: ArmObj<any> = r.json();
                    newAuthSettings.forEach((value, key) => {
                        authSettings.properties[key] = value;
                    });
                    return this._cacheService.putArm(authSettings.id, this._armService.websiteApiVersion, authSettings);
                });
        } else {
            return Observable.of(null);
        }
    }

    getRuntimeGeneration(): Observable<string> {
        return this.getExtensionVersion().map(v => {
            return FunctionsVersionInfoHelper.getFuntionGeneration(v);
        });
    }
    private localize(objectToLocalize: any): any {
        if ((typeof objectToLocalize === 'string') && (objectToLocalize.startsWith('$'))) {
            const key = objectToLocalize.substring(1, objectToLocalize.length);
            objectToLocalize = this._translateService.instant(key);
        } else if (Array.isArray(objectToLocalize)) {
            for (let i = 0; i < objectToLocalize.length; i++) {
                objectToLocalize[i] = this.localize(objectToLocalize[i]);
            }
        } else if (typeof objectToLocalize === 'object') {
            for (const property in objectToLocalize) {
                if (property === 'files' || property === 'defaultValue' || property === 'function') {
                    continue;
                }
                if (objectToLocalize.hasOwnProperty(property)) {
                    objectToLocalize[property] = this.localize(objectToLocalize[property]);
                }
            }
        }
        return objectToLocalize;
    }

    portalHeaders(authToken: string, ...aditionalHeaders: [string, string][]): Headers {
        const headers = aditionalHeaders.slice();
        headers.unshift(['portal-token', authToken]);
        return this.headers.apply(this, headers);
    }

    headers(authTokenOrHeader: string | [string, string], ...additionalHeaders: [string, string][]): Headers {
        const headers = new Headers();
        if (typeof authTokenOrHeader === 'string') {
            headers.set('Authorization', `Bearer ${authTokenOrHeader}`);
        } else {
            headers.set(authTokenOrHeader[0], authTokenOrHeader[1]);
        }

        additionalHeaders.forEach(header => {
            headers.set(header[0], header[1]);
        });

        return headers;
    }
}
/**
 * returns the file name from a VfsObject or an href
 * @param file either a VfsObject or a string representing the file's href.
 */
function getFileName(file: VfsObject | string): string {
    if (typeof file === 'string') {
        // if `file` is a string, that means it's in the format:
        //     https://<scmUrl>/api/vfs/path/to/file.ext
        return file
            .split('/') // [ 'https:', '', '<scmUrl>', 'api', 'vfs', 'path', 'to', 'file.ext' ]
            .pop(); // 'file.ext'
    } else {
        return file.name;
    }
}