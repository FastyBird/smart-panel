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

/** A client-side request deadline expired. The backend operation itself may still have run or finished. */
export class ProtectTimeoutException extends ProtectException {}

/** The backend still reported a discovery scan in progress when the client stopped following it. */
export class ProtectScanStillRunningException extends ProtectTimeoutException {}
