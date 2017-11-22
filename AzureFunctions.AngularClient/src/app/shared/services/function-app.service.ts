import { Preconditions as p } from './../preconditions';
import { CacheService } from 'app/shared/services/cache.service';
import { Observable } from 'rxjs/Observable';
import { FunctionAppContext } from './functions-service';
import { Injectable } from '@angular/core';

@Injectable()
export class FunctionAppService {
    preconditionsMap: p.PreconditionMap = {} as p.PreconditionMap;

    constructor(private cacheService: CacheService) {
        this.preconditionsMap[p.HttpPreconditions.NoClientCertificate] = new p.NotStoppedPrecondition(cacheService);
        this.preconditionsMap[p.HttpPreconditions.NoEasyAuth] = new p.NotStoppedPrecondition(cacheService);
        this.preconditionsMap[p.HttpPreconditions.NotOverQuota] = new p.NotStoppedPrecondition(cacheService);
        this.preconditionsMap[p.HttpPreconditions.NotStopped] = new p.NotStoppedPrecondition(cacheService);
        this.preconditionsMap[p.HttpPreconditions.ReachableLoadballancer] = new p.NotStoppedPrecondition(cacheService);
        this.preconditionsMap[p.HttpPreconditions.ReachableLoadballancer] = new p.NotStoppedPrecondition(cacheService);
    }
}
