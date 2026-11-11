export class DevicesModbusException extends Error {}

export interface IDevicesModbusErrorField {
	field?: string;
	reason: string;
}

export class DevicesModbusApiException extends DevicesModbusException {
	public constructor(
		message: string,
		public readonly code?: number,
		public readonly fields: IDevicesModbusErrorField[] = []
	) {
		super(message);
	}
}
