export class DevicesWledException extends Error {}

export class DevicesWledValidationException extends DevicesWledException {}

export class DevicesWledApiException extends DevicesWledException {
	public code: number;

	constructor(message: string, code: number) {
		super(message);

		this.code = code;
	}
}
