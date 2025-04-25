export class PagesCardsException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PagesCardsException';
	}
}

export class PagesCardsNotFoundException extends PagesCardsException {
	constructor(message: string) {
		super(message);
		this.name = 'PagesCardsNotFoundException';
	}
}

export class PagesCardsValidationException extends PagesCardsException {
	constructor(message: string) {
		super(message);
		this.name = 'PagesCardsValidationException';
	}
}
