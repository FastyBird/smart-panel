export interface ILogger {
	append(obj: unknown): Promise<void>;
}
