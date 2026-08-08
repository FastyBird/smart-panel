export class McpApiException extends Error {
	constructor(
		message: string,
		public readonly code?: number
	) {
		super(message);
		this.name = 'McpApiException';
	}
}
