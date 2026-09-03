export class NotificationsException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NotificationsException';
	}
}

export class NotificationsNotFoundException extends NotificationsException {
	constructor(message: string) {
		super(message);
		this.name = 'NotificationsNotFoundException';
	}
}
