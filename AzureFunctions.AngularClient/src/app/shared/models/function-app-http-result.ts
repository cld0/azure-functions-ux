export interface FunctionAppHttpError {
    errorId: string;
}

export interface FunctionAppHttpResult<T> {
    isSuccessful: boolean;
    error: FunctionAppHttpError | null;
    result: T | null;
}
