import {
	HomeyCapability,
	HomeyCapabilityEnumValue,
	HomeyCapabilityType,
	HomeyCapabilityValue,
	createHomeyCapability,
} from '../models/homey-capability.model';
import { HomeyDevice, HomeyDeviceEnergy } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';
import { HomeySystemInfo } from '../models/homey-system-info.model';
import { HomeyZone } from '../models/homey-zone.model';

import { HomeyLocalTransportEvent } from './homey-local.transport';

type HomeyProtocolRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is HomeyProtocolRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const asNumber = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

const requireString = (value: unknown, label: string): string => {
	const parsed = asString(value);

	if (parsed === null || parsed.length === 0) {
		throw new Error(`Homey protocol ${label} is missing`);
	}

	return parsed;
};

const requireBoolean = (value: unknown, label: string): boolean => {
	const parsed = asBoolean(value);

	if (parsed === null) {
		throw new Error(`Homey protocol ${label} is missing`);
	}

	return parsed;
};

const firstString = (...values: unknown[]): string | null => {
	for (const value of values) {
		const parsed = asString(value);

		if (parsed !== null && parsed.length > 0) {
			return parsed;
		}
	}

	return null;
};

const eventMetadata = (value: HomeyProtocolRecord): Pick<HomeyEvent, 'occurredAt' | 'sequence'> => ({
	occurredAt: firstString(value.occurredAt, value.timestamp, value.lastUpdated),
	sequence:
		typeof value.sequence === 'string' || (typeof value.sequence === 'number' && Number.isFinite(value.sequence))
			? value.sequence
			: null,
});

const capabilityType = (value: unknown): HomeyCapabilityType => {
	switch (value) {
		case HomeyCapabilityType.BOOLEAN:
		case HomeyCapabilityType.NUMBER:
		case HomeyCapabilityType.STRING:
		case HomeyCapabilityType.ENUM:
			return value;
		default:
			return HomeyCapabilityType.UNKNOWN;
	}
};

const capabilityValue = (value: unknown): HomeyCapabilityValue => {
	if (value === null) {
		return null;
	}

	if (typeof value === 'boolean' || typeof value === 'string') {
		return value;
	}

	return asNumber(value);
};

const requireCapabilityValue = (value: HomeyProtocolRecord, key: string, label: string): HomeyCapabilityValue => {
	if (!Object.hasOwn(value, key)) {
		throw new Error(`Homey protocol ${label} is missing`);
	}

	const candidate = value[key];

	if (candidate === null) {
		return null;
	}

	if (typeof candidate === 'boolean' || typeof candidate === 'string') {
		return candidate;
	}

	if (typeof candidate === 'number' && Number.isFinite(candidate)) {
		return candidate;
	}

	throw new Error(`Homey protocol ${label} is malformed`);
};

const enumValues = (value: unknown): readonly HomeyCapabilityEnumValue[] => {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((item) => {
		if (!isRecord(item)) {
			return [];
		}

		const id = asString(item.id);
		const title = asString(item.title);

		return id === null || title === null ? [] : [{ id, title }];
	});
};

const transformCapability = (id: string, value: unknown): HomeyCapability => {
	const capability = isRecord(value) ? value : {};

	return createHomeyCapability({
		id,
		title: asString(capability.title) ?? id,
		value: capabilityValue(capability.value),
		type: capabilityType(capability.type),
		unit: asString(capability.units),
		minimum: asNumber(capability.min),
		maximum: asNumber(capability.max),
		step: asNumber(capability.step),
		enumValues: enumValues(capability.values),
		readable: capability.getable === true,
		writable: capability.setable === true,
		available: asBoolean(capability.available),
		lastUpdatedAt: asString(capability.lastUpdated),
	});
};

const transformEnergy = (value: unknown): HomeyDeviceEnergy | null => {
	if (!isRecord(value)) {
		return null;
	}

	const approximation = isRecord(value.approximation) ? value.approximation : {};

	return {
		cumulative: asBoolean(value.cumulative),
		cumulativeImported:
			asBoolean(value.cumulativeImported) ?? (typeof value.cumulativeImportedCapability === 'string' ? true : null),
		cumulativeExported:
			asBoolean(value.cumulativeExported) ?? (typeof value.cumulativeExportedCapability === 'string' ? true : null),
		usageConstant: asNumber(value.usageConstant) ?? asNumber(approximation.usageConstant),
		usageOff: asNumber(value.usageOff) ?? asNumber(approximation.usageOff),
	};
};

const capabilityIds = (device: HomeyProtocolRecord, capabilities: HomeyProtocolRecord): readonly string[] => {
	if (Array.isArray(device.capabilities)) {
		return device.capabilities.filter((id): id is string => typeof id === 'string');
	}

	return Object.keys(capabilities);
};

/** Converts the local system manager response into a transport-neutral snapshot. */
export const transformHomeyLocalSystemInfo = (value: unknown): HomeySystemInfo => {
	if (!isRecord(value)) {
		throw new Error('Homey protocol system response is malformed');
	}

	return {
		id: requireString(firstString(value.id, value.homeyId, value.cloudId, value._id), 'system id'),
		name: firstString(value.name, value.homeyName),
		version: requireString(firstString(value.homeyVersion, value.version), 'system version'),
		tier: firstString(value.tier, value.homeyTier),
		model: firstString(value.homeyModelName, value.model),
	};
};

/** Converts the Homey zone map into source-ordered normalized zones with root-to-leaf paths. */
export const transformHomeyLocalZones = (value: unknown): readonly HomeyZone[] => {
	if (!isRecord(value)) {
		throw new Error('Homey protocol zones response is malformed');
	}

	const zones = Object.values(value).map((item) => {
		if (!isRecord(item)) {
			throw new Error('Homey protocol zone is malformed');
		}

		return {
			id: requireString(item.id, 'zone id'),
			name: requireString(item.name, 'zone name'),
			parentId: asString(item.parent),
			active: item.active === true,
		};
	});
	const byId = new Map(zones.map((zone) => [zone.id, zone]));
	const resolvePath = (zone: (typeof zones)[number], visited: ReadonlySet<string> = new Set()): readonly string[] => {
		if (visited.has(zone.id)) {
			throw new Error('Homey protocol zone hierarchy contains a cycle');
		}

		if (zone.parentId === null) {
			return [zone.name];
		}

		const parent = byId.get(zone.parentId);

		if (parent === undefined) {
			return [zone.name];
		}

		return [...resolvePath(parent, new Set([...visited, zone.id])), zone.name];
	};

	return zones.map((zone) => ({ ...zone, path: resolvePath(zone) }));
};

/** Converts one raw Homey device without leaking SDK/protocol-specific fields. */
export const transformHomeyLocalDevice = (value: unknown, zones: readonly HomeyZone[]): HomeyDevice => {
	if (!isRecord(value)) {
		throw new Error('Homey protocol device is malformed');
	}

	const capabilities = isRecord(value.capabilitiesObj) ? value.capabilitiesObj : {};
	const zoneId = asString(value.zone);
	const zone = zoneId === null ? undefined : zones.find((candidate) => candidate.id === zoneId);

	return {
		id: requireString(value.id, 'device id'),
		name: requireString(value.name, 'device name'),
		class: requireString(value.class, 'device class'),
		zoneId,
		zoneName: zone?.name ?? null,
		zonePath: zone?.path ?? [],
		available: value.available === true,
		availabilityMessage: asString(value.unavailableMessage),
		driverId: asString(value.driverId),
		manufacturer: asString(value.manufacturer),
		model: asString(value.model),
		energy: transformEnergy(value.energy),
		capabilities: capabilityIds(value, capabilities).map((id) => transformCapability(id, capabilities[id])),
	};
};

/** Converts a source-ordered Homey device map into detached normalized models. */
export const transformHomeyLocalDevices = (value: unknown, zones: readonly HomeyZone[]): readonly HomeyDevice[] => {
	if (!isRecord(value)) {
		throw new Error('Homey protocol devices response is malformed');
	}

	return Object.values(value).map((device) => transformHomeyLocalDevice(device, zones));
};

/** Converts one local manager/item event while preserving full capability IDs. */
export const transformHomeyLocalEvent = (event: HomeyLocalTransportEvent): HomeyEvent => {
	if (!isRecord(event.payload)) {
		throw new Error('Homey protocol event payload is malformed');
	}

	const payload = event.payload;
	const metadata = eventMetadata(payload);

	switch (event.type) {
		case 'capability':
			return {
				type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
				deviceId: requireString(event.deviceId ?? payload.deviceId, 'event device id'),
				capabilityId: requireString(firstString(payload.capabilityId, payload.capability), 'event capability id'),
				value: requireCapabilityValue(payload, 'value', 'event capability value'),
				lastUpdatedAt: firstString(payload.lastUpdatedAt, payload.lastUpdated),
				...metadata,
			};
		case 'device.create':
			return {
				type: HomeyEventType.DEVICE_ADDED,
				deviceId: requireString(firstString(payload.id, payload.deviceId), 'event device id'),
				...metadata,
			};
		case 'device.delete':
			return {
				type: HomeyEventType.DEVICE_REMOVED,
				deviceId: requireString(firstString(payload.id, payload.deviceId), 'event device id'),
				...metadata,
			};
		case 'device.availability':
			return {
				type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
				deviceId: requireString(firstString(payload.id, payload.deviceId), 'event device id'),
				available: requireBoolean(payload.available, 'event availability'),
				availabilityMessage: firstString(payload.unavailableMessage, payload.availabilityMessage),
				...metadata,
			};
		case 'device.update':
			return {
				type: HomeyEventType.DEVICE_UPDATED,
				deviceId: requireString(firstString(payload.id, payload.deviceId), 'event device id'),
				...metadata,
			};
		case 'zone.create':
			return {
				type: HomeyEventType.ZONE_ADDED,
				zoneId: requireString(firstString(payload.id, payload.zoneId), 'event zone id'),
				...metadata,
			};
		case 'zone.delete':
			return {
				type: HomeyEventType.ZONE_REMOVED,
				zoneId: requireString(firstString(payload.id, payload.zoneId), 'event zone id'),
				...metadata,
			};
		case 'zone.update':
			return {
				type: HomeyEventType.ZONE_UPDATED,
				zoneId: requireString(firstString(payload.id, payload.zoneId), 'event zone id'),
				...metadata,
			};
	}
};
