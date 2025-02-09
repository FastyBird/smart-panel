export class DashboardException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DashboardException';
	}
}

export class DashboardNotFoundException extends DashboardException {
	constructor(message: string) {
		super(message);
		this.name = 'DashboardNotFoundException';
	}
}

export class DashboardValidationException extends DashboardException {
	constructor(message: string) {
		super(message);
		this.name = 'DashboardValidationException';
	}
}
