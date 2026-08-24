export class DevicesHomeyException extends Error {}

export class DevicesHomeyApiException extends DevicesHomeyException {
	public constructor(
		message: string,
		public readonly code?: number
	) {
		super(message);
	}
}

export class DevicesHomeyValidationException extends DevicesHomeyException {}
