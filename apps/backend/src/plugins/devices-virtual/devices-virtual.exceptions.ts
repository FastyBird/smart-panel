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

/** An owned (`local`) property would be writable, which v1 has no write semantics for. */
export class VirtualOwnedPropertyNotWritableException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualOwnedPropertyNotWritableException';
	}
}

/**
 * A projection would be stored whose source cannot fill the spec slot it is being wired into.
 *
 * Broader than VirtualPermissionsIncompatibleException, which answers only the permission half:
 * this one carries whichever reason `reportCompatibility` gave — channel membership, permissions,
 * or data type — so the operator is told the actual reason rather than a permission message for a
 * data-type mismatch.
 */
export class VirtualProjectionIncompatibleException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualProjectionIncompatibleException';
	}
}

/**
 * A device's category would be changed to one the structure it already carries does not satisfy.
 *
 * Distinct from VirtualCategoryNotSupportedException, which refuses a category outright: this one is
 * about a category that is perfectly legal for a virtual device and merely wrong for *this* device's
 * channels and properties.
 */
export class VirtualCategoryChangeUnsafeException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualCategoryChangeUnsafeException';
	}
}

/**
 * A virtual channel's category would be changed out from under the projections it carries.
 *
 * The device-level sibling above asks whether the *whole* structure still satisfies a new device
 * category. This one is narrower and cheaper: a channel's category decides which spec slots its own
 * properties fill, so moving it detaches every projection under it from the slot it was judged
 * against, whatever the device category says.
 */
export class VirtualChannelCategoryChangeUnsafeException extends VirtualException {
	constructor(message: string) {
		super(message);
		this.name = 'VirtualChannelCategoryChangeUnsafeException';
	}
}
