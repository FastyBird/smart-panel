import { BadRequestException, NotFoundException } from '@nestjs/common';

export class ExtensionNotFoundException extends NotFoundException {
	constructor(type: string) {
		super(`Extension '${type}' not found.`);
	}
}

export class CoreExtensionModificationException extends BadRequestException {
	constructor(type: string) {
		super(`Extension '${type}' is a core extension and cannot be modified.`);
	}
}
