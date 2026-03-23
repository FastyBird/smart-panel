export class DevicesReTerminalException extends Error {}

export class DevicesReTerminalValidationException extends DevicesReTerminalException {}

export class DevicesReTerminalApiException extends DevicesReTerminalException {
	public code: number;

	constructor(message: string, code: number) {
		super(message);

		this.code = code;
	}
}
