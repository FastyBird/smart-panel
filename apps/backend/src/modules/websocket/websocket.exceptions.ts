export class WebsocketException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WebsocketException';
	}
}

export class WebsocketNotAllowedException extends WebsocketException {
	constructor(message: string) {
		super(message);
		this.name = 'WebsocketNotAllowedException';
	}
}
