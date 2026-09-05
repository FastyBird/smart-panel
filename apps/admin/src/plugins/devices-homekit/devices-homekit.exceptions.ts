export class DevicesHomeKitException extends Error {}

export class DevicesHomeKitApiException extends DevicesHomeKitException {
	public constructor(
		message: string,
		public readonly code?: number
	) {
		super(message);
	}
}

export class DevicesHomeKitValidationException extends DevicesHomeKitException {}
