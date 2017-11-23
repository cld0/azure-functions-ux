import { CacheService } from 'app/shared/services/cache.service';
import { Observable } from 'rxjs/Observable';
import { FunctionAppContext } from './services/functions-service';

export namespace Preconditions {
    export type PreconditionErrorId = string;
    export type HttpPreconditions = 'NotStopped' | 'ReachableLoadballancer' | 'NotOverQuota' | 'NoEasyAuth' | 'RuntimeAvailable' | 'NoClientCertificate';
    export type PreconditionMap = {[key in HttpPreconditions]: HttpPrecondition };
    export type DataService = CacheService;

    export interface PreconditionResult {
        conditionMet: boolean; errorId: PreconditionErrorId;
    }

    export abstract class HttpPrecondition {
        constructor(protected dataService: DataService) { }
        abstract check(context: FunctionAppContext): Observable<PreconditionResult>;
    }

    export class NotStoppedPrecondition extends HttpPrecondition {
        check(context: FunctionAppContext): Observable<PreconditionResult> {
            throw new Error('Method not implemented.');
        }
    }

    export class ReachableLoadballancerPrecondition extends HttpPrecondition {
        check(context: FunctionAppContext): Observable<PreconditionResult> {
            throw new Error('Method not implemented.');
        }
    }

    export class NotOverQuotaPrecondition extends HttpPrecondition {
        check(context: FunctionAppContext): Observable<PreconditionResult> {
            throw new Error('Method not implemented.');
        }
    }

    export class NoEasyAuthPrecondition extends HttpPrecondition {
        check(context: FunctionAppContext): Observable<PreconditionResult> {
            throw new Error('Method not implemented.');
        }
    }

    export class RuntimeAvailablePrecondition extends HttpPrecondition {
        check(context: FunctionAppContext): Observable<PreconditionResult> {
            throw new Error('Method not implemented.');
        }
    }

    export class NoClientCertificatePrecondition extends HttpPrecondition {
        check(context: FunctionAppContext): Observable<PreconditionResult> {
            throw new Error('Method not implemented.');
        }
    }
}