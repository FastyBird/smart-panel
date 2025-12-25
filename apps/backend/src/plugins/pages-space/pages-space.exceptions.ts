import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export class PagesSpaceException extends Error {}

export class PagesSpaceNotFoundException extends NotFoundException {
	constructor(message: string) {
		super(message);
	}
}

export class PagesSpaceValidationException extends UnprocessableEntityException {
	constructor(message: string) {
		super(message);
	}
}

export class PagesSpaceBadRequestException extends BadRequestException {
	constructor(message: string) {
		super(message);
	}
}
