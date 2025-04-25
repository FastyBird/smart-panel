export class PagesTilesException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PagesTilesException';
	}
}

export class PagesTilesNotFoundException extends PagesTilesException {
	constructor(message: string) {
		super(message);
		this.name = 'PagesTilesNotFoundException';
	}
}

export class PagesTilesValidationException extends PagesTilesException {
	constructor(message: string) {
		super(message);
		this.name = 'PagesTilesValidationException';
	}
}
