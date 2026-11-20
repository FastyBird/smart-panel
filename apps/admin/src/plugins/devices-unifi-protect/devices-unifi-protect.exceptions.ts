export class ProtectException extends Error {}

export class ProtectApiException extends ProtectException {
	public constructor(
		message: string,
		public readonly code?: number
	) {
		super(message);
	}
}

export class ProtectValidationException extends ProtectException {}
