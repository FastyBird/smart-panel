import { BadRequestException, NotFoundException } from '@nestjs/common';

export class ExtensionNotFoundException extends NotFoundException {
	constructor(type: string) {
		super(`Extension '${type}' not found.`);
	}
}

export class ExtensionNotConfigurableException extends BadRequestException {
	constructor(type: string) {
		super(`Extension '${type}' does not support enable/disable configuration.`);
	}
}

export class ExtensionConfigValidationException extends BadRequestException {
	constructor(type: string) {
		super(`Extension '${type}' can not be enabled because its configuration is incomplete or invalid.`);
	}
}
