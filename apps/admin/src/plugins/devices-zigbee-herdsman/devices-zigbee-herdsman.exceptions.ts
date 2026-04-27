export class DevicesZigbeeHerdsmanException extends Error {}

export class DevicesZigbeeHerdsmanValidationException extends DevicesZigbeeHerdsmanException {}

export class DevicesZigbeeHerdsmanApiException extends DevicesZigbeeHerdsmanException {
	public code: number;

	constructor(message: string, code: number) {
		super(message);

		this.code = code;
	}
}
