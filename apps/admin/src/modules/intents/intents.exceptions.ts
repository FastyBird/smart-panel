import { AppException } from '../../common';

export class IntentsException extends AppException {}

export class IntentsValidationException extends IntentsException {
	constructor(message: string) {
		super(message, 'intents-module/validation-error');
	}
}
