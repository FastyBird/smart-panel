import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export class PagesHouseModesException extends Error {}

export class PagesHouseModesNotFoundException extends NotFoundException {
	constructor(message: string) {
		super(message);
	}
}

export class PagesHouseModesValidationException extends UnprocessableEntityException {
	constructor(message: string) {
		super(message);
	}
}

export class PagesHouseModesBadRequestException extends BadRequestException {
	constructor(message: string) {
		super(message);
	}
}
