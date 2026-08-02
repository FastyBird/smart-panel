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

/** A property would end up `local` with a source: the one state pair the entity has no state for. */
export class VirtualValueOriginConflictException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualValueOriginConflictException';
	}
}

/** A source property's permissions cannot satisfy a required spec slot. */
export class VirtualPermissionsIncompatibleException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualPermissionsIncompatibleException';
	}
}

/** A virtual channel or property would be attached to a channel or device that is not virtual. */
export class VirtualOwnerNotVirtualException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualOwnerNotVirtualException';
	}
}
