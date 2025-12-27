import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export class PagesHouseException extends Error {}

export class PagesHouseNotFoundException extends NotFoundException {
	constructor(message: string) {
		super(message);
	}
}

export class PagesHouseValidationException extends UnprocessableEntityException {
	constructor(message: string) {
		super(message);
	}
}

export class PagesHouseBadRequestException extends BadRequestException {
	constructor(message: string) {
		super(message);
	}
}
