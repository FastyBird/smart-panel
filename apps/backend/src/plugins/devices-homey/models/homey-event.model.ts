import { HomeyCapabilityValue } from './homey-capability.model';

interface HomeyEventMetadata {
	readonly occurredAt: string | null;
	readonly sequence: string | number | null;
}

export enum HomeyEventType {
	CAPABILITY_VALUE_CHANGED = 'capability_value_changed',
	DEVICE_AVAILABILITY_CHANGED = 'device_availability_changed',
	DEVICE_ADDED = 'device_added',
	DEVICE_UPDATED = 'device_updated',
	DEVICE_REMOVED = 'device_removed',
	ZONE_ADDED = 'zone_added',
	ZONE_UPDATED = 'zone_updated',
	ZONE_REMOVED = 'zone_removed',
}

export interface HomeyCapabilityValueChangedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.CAPABILITY_VALUE_CHANGED;
	readonly deviceId: string;
	/** Always the full capability ID, never its descriptor-matching base ID. */
	readonly capabilityId: string;
	readonly value: HomeyCapabilityValue;
	readonly lastUpdatedAt: string | null;
}

export interface HomeyDeviceAvailabilityChangedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED;
	readonly deviceId: string;
	readonly available: boolean;
	readonly availabilityMessage: string | null;
}

export interface HomeyDeviceAddedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.DEVICE_ADDED;
	readonly deviceId: string;
}

export interface HomeyDeviceUpdatedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.DEVICE_UPDATED;
	readonly deviceId: string;
}

export interface HomeyDeviceRemovedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.DEVICE_REMOVED;
	readonly deviceId: string;
}

export interface HomeyZoneAddedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.ZONE_ADDED;
	readonly zoneId: string;
}

export interface HomeyZoneUpdatedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.ZONE_UPDATED;
	readonly zoneId: string;
}

export interface HomeyZoneRemovedEvent extends HomeyEventMetadata {
	readonly type: HomeyEventType.ZONE_REMOVED;
	readonly zoneId: string;
}

export type HomeyEvent =
	| HomeyCapabilityValueChangedEvent
	| HomeyDeviceAvailabilityChangedEvent
	| HomeyDeviceAddedEvent
	| HomeyDeviceUpdatedEvent
	| HomeyDeviceRemovedEvent
	| HomeyZoneAddedEvent
	| HomeyZoneUpdatedEvent
	| HomeyZoneRemovedEvent;
