import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { ArmService } from './arm.service';
import { CacheService } from './cache.service';
import { ArmObj } from '../models/arm/arm-obj';
import { Site } from '../models/arm/site';
import { Constants } from '../../shared/models/constants';
import { SiteDescriptor } from './../../shared/resourceDescriptors';

@Injectable()
export class SiteService {
    constructor(
        private _cacheService: CacheService,
        private _armService: ArmService
    ) { }

    isAppInsightsEnabled(siteId: string) {
        const descriptor = new SiteDescriptor(siteId);
        return Observable.zip(
            this._cacheService.postArm(`${siteId}/config/appsettings/list`),
            this._cacheService.getArm(`/subscriptions/${descriptor.subscription}/providers/microsoft.insights/components`, false, this._armService.appInsightsApiVersion),
            (as, ai) => ({ appSettings: as, appInsights: ai })
        ).map(r => {
            const ikey = r.appSettings.json().properties[Constants.instrumentationKeySettingName];
            let result = null;
            if (ikey) {
                const aiResources = r.appInsights.json();

                // AI RP has an issue where they return an array instead of a JSON response if empty
                if (aiResources && !Array.isArray(aiResources)) {
                    aiResources.value.forEach((ai) => {
                        if (ai.properties.InstrumentationKey === ikey) {
                            result = ai.id;
                        }
                    });
                }
            }

            return result;
        });
    }


    //Create Slot
    createNewSlot(siteId: string, slotName: string, loc: string, serverfarmId: string) {
        // create payload
        let payload = JSON.stringify({
            location: loc,
            properties: {
                serverFarmId: serverfarmId
            }
        });
        return this._cacheService.putArm(`${siteId}/slots/${slotName}`, this._armService.websiteApiVersion, payload);
    }


    public setStatusOfSlotOptIn(appSetting: ArmObj<any>, value?: string) {
        appSetting.properties[Constants.slotsSecretStorageSettingsName] = value;
        return this._cacheService.putArm(appSetting.id, this._armService.websiteApiVersion, appSetting);
    }
}

