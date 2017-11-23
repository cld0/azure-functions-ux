
import { Preconditions as p } from './preconditions';
import { CacheService } from 'app/shared/services/cache.service';
import { FunctionAppContext } from 'app/shared/services/functions-service';
import { Observable } from 'rxjs/Observable';
import { FunctionAppHttpResult } from 'app/shared/models/function-app-http-result';
import { ArmUtil } from 'app/shared/Utilities/arm-utils';

type AuthenticatedQuery<T> = (t: AuthToken) => Observable<T>;
type Query<T> = Observable<T> | AuthenticatedQuery<T>;
type AuthToken = string;
type ErrorId = string;
type Result<T> = Observable<FunctionAppHttpResult<T>>;
type Milliseconds = number;
interface ExecuteOptions {
    retryCount: number;
    retryBounce: Milliseconds;
}

export class ConditionalHttpClient {

    private readonly preconditionsMap: p.PreconditionMap = {} as p.PreconditionMap;
    private readonly conditions: p.HttpPreconditions[];

    constructor(cacheService: CacheService, ...defaultConditions: p.HttpPreconditions[]) {

        this.conditions = defaultConditions;

        this.preconditionsMap['NoClientCertificate'] = new p.NoClientCertificatePrecondition(cacheService);
        this.preconditionsMap['NoEasyAuth'] = new p.NoEasyAuthPrecondition(cacheService);
        this.preconditionsMap['NotOverQuota'] = new p.NotOverQuotaPrecondition(cacheService);
        this.preconditionsMap['NotStopped'] = new p.NotStoppedPrecondition(cacheService);
        this.preconditionsMap['ReachableLoadballancer'] = new p.ReachableLoadballancerPrecondition(cacheService);
        this.preconditionsMap['RuntimeAvailable'] = new p.RuntimeAvailablePrecondition(cacheService);
    }

    getToken(context: FunctionAppContext): Observable<string> {
        return Observable.of(context.site.id);
    }

    execute<T>(context: FunctionAppContext, query: Query<T>, executeOptions?: ExecuteOptions) {
        return this.executeWithConditions(this.conditions, context, query, executeOptions);
    }

    executeWithConditions<T>(preconditions: p.HttpPreconditions[], context: FunctionAppContext, query: Query<T>, executeOptions?: ExecuteOptions): Observable<FunctionAppHttpResult<T>> {
        const errorMapper = (error: p.PreconditionResult) => Observable.of({
            isSuccessful: false,
            error: {
                errorId: error.errorId
            },
            result: null
        });

        const observableQuery = typeof query === 'function'
            ? this.getToken().take(1).concatMap(t => query(t))
            : query;

        const successMapper = () => observableQuery
            .map(r => ({
                isSuccessful: true,
                error: null,
                result: r
            }))
            .catch((e: ErrorId) => Observable.of({
                isSuccessful: false,
                error: {
                    errorId: e
                },
                result: null
            }));

        return Observable.forkJoin(preconditions
            .map(i => this.preconditionsMap[i])
            .map(i => i.check(context)))
            .map(preconditionResults => preconditionResults.find(r => !r.conditionMet))
            .concatMap(maybeError => maybeError ? errorMapper(maybeError) : successMapper());
    }
}