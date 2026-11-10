export class DevicesModbusException extends Error {}

export class DevicesModbusApiException extends DevicesModbusException {
	public constructor(
		message: string,
		public readonly code?: number
	) {
		super(message);
	}
}
