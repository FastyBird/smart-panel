export class SpacesSignageInfoPanelException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SpacesSignageInfoPanelException';
	}
}

export class SpacesSignageInfoPanelNotFoundException extends SpacesSignageInfoPanelException {
	constructor(message: string) {
		super(message);
		this.name = 'SpacesSignageInfoPanelNotFoundException';
	}
}

export class SpacesSignageInfoPanelValidationException extends SpacesSignageInfoPanelException {
	constructor(message: string) {
		super(message);
		this.name = 'SpacesSignageInfoPanelValidationException';
	}
}
