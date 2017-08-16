import { SiteConfig } from '../shared/models/arm/site-config';
import { Site } from '../shared/models/arm/site';
import { ArmObj } from '../shared/models/arm/arm-obj';
import { CacheService } from '../shared/services/cache.service';
import { PortalService } from '../shared/services/portal.service';
import { BroadcastService } from '../shared/services/broadcast.service';
import { BusyStateScopeManager } from '../busy-state/busy-state-scope-manager';
import { SiteData, TreeViewInfo } from '../tree-view/models/tree-view-info';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Subscription as RxSubscription } from 'rxjs/Subscription';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/retry';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/zip';

import { BusyStateComponent } from '../busy-state/busy-state.component';
import { AuthzService } from '../shared/services/authz.service';
import { AiService } from '../shared/services/ai.service';
import { TranslateService } from '@ngx-translate/core';
import { SiteTabComponent } from '../site/site-dashboard/site-tab/site-tab.component';
import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-deployment-center',
  templateUrl: './deployment-center.component.html',
  styleUrls: ['./deployment-center.component.scss']
})
export class DeploymentCenterComponent implements OnInit {
  
  public viewInfoStream: Subject<TreeViewInfo<SiteData>>;
  private _viewInfoSubscription: RxSubscription;
  @Input() set viewInfoInput(viewInfo: TreeViewInfo<SiteData>) {
    this.viewInfoStream.next(viewInfo);
  }

  private _writePermission = true;
  private _readOnlyLock = false;
  public hasWritePermissions = true;

  private _siteObject: ArmObj<Site>;
  private _siteConfigObject: ArmObj<SiteConfig>;
  private _busyState: BusyStateComponent;
  private _busyStateScopeManager: BusyStateScopeManager;

  constructor(
    private _translateService: TranslateService,
    private _portalService: PortalService,
    private _aiService: AiService,
    private _broadcastService: BroadcastService,
    private _authZService: AuthzService,
    siteTabsComponent: SiteTabComponent,
    private _cacheService: CacheService) {


    this._busyState = siteTabsComponent.busyState;
    this._busyStateScopeManager = this._busyState.getScopeManager();
    
    this.viewInfoStream = new Subject<TreeViewInfo<SiteData>>();
    this._viewInfoSubscription = this.viewInfoStream
      .distinctUntilChanged()
      .switchMap(viewInfo => {
        this._busyStateScopeManager.setBusy();
        return Observable.zip(
          this._cacheService.getArm(viewInfo.resourceId),
          this._cacheService.getArm(`${viewInfo.resourceId}/config/web`),
          this._authZService.hasPermission(viewInfo.resourceId, [AuthzService.writeScope]),
          this._authZService.hasReadOnlyLock(viewInfo.resourceId),
          (s,sc, wp, rl) => ({ site: s.json(), siteConfig: sc.json(), writePermission: wp, readOnlyLock: rl })
        )
      })
      .do(null, error => {
        this._siteObject = null;
        this._siteConfigObject = null;
        this._aiService.trackEvent('/errors/deployment-center', error);
        this._busyStateScopeManager.clearBusy();
      })
      .retry()
      .subscribe(r => {
        this._siteConfigObject = r.siteConfig;
        this._writePermission = r.writePermission;
        this._readOnlyLock = r.readOnlyLock;
        this.hasWritePermissions = r.writePermission && !r.readOnlyLock;
        this._siteObject = r.site;
        this._busyStateScopeManager.clearBusy();
      });
      this._broadcastService.clearDirtyState('asiondaonisd', false);
      this._translateService.instant('key');
      this._portalService.closeBlades();
  }

  get DeploymentSetUpComplete(){
    return this._siteConfigObject && this._siteConfigObject.properties.scmType !== 'None';
  }
  ngOnInit() {
  }

}
