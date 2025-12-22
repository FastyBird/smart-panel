export class DevicesZigbee2mqttException extends Error {}

export class DevicesZigbee2mqttValidationException extends DevicesZigbee2mqttException {}

export class DevicesZigbee2mqttApiException extends DevicesZigbee2mqttException {
	public code: number;

	constructor(message: string, code: number) {
		super(message);

		this.code = code;
	}
}
