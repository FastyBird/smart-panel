/** A producer publishes its complete committed membership. Subscribers reconcile by producer and device ID. */
export const DEVICE_BINDINGS_CHANGED = 'DevicesModule.Device.BindingsChanged';

export interface DeviceBinding {
	readonly role: string;
	readonly deviceId: string | null;
	readonly propertyId: string;
	readonly claimId?: string;
	readonly physicalIdentity?: string;
	readonly providerProfile?: string;
}

export interface DeviceBindingsEvent {
	readonly producer: string;
	readonly kind: string;
	readonly action: 'created' | 'updated' | 'deleted';
	readonly deviceId: string;
	readonly revision: number;
	readonly bindings: readonly DeviceBinding[];
	/** Members removed by this commit, including their last provider and stable physical identity. */
	readonly removedBindings?: readonly DeviceBinding[];
}
