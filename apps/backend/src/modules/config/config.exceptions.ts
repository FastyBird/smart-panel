export class ConfigException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigException';
	}
}

export class ConfigNotFoundException extends ConfigException {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigNotFoundException';
	}
}

export class ConfigCorruptedException extends ConfigException {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigCorruptedException';
	}
}

export class ConfigValidationException extends ConfigException {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigValidationException';
	}
}
