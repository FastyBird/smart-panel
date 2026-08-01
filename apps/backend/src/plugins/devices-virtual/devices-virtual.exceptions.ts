export class VirtualException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualException';
	}
}

/** A device category needs closed-loop control this plugin cannot provide yet. */
export class VirtualCategoryNotSupportedException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualCategoryNotSupportedException';
	}
}

/** A `source_property` resolves to a property owned by another virtual device. */
export class VirtualNestingNotAllowedException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualNestingNotAllowedException';
	}
}

/** A `source_property` does not resolve to a real property/channel/device chain. */
export class VirtualSourceNotFoundException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualSourceNotFoundException';
	}
}

/** A source property's permissions cannot satisfy a required spec slot. */
export class VirtualPermissionsIncompatibleException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualPermissionsIncompatibleException';
	}
}
