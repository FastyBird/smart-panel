import { DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { BuddyContext } from '../services/buddy-context.service';

export const BUDDY_CONTEXT_SCALE_DEVICE_COUNTS = [10, 100, 1_000] as const;
export const BUDDY_CONTEXT_SOAK_DEVICE_COUNT = 5_000;

export interface BuddyContextFixtureOptions {
	spaceId?: string;
	spaceCount?: number;
	deviceIndexOffset?: number;
	timestamp?: string;
	timezone?: string;
}

const DEFAULT_SPACE_COUNT = 4;
const DEFAULT_TIMESTAMP = '2026-01-15T12:00:00.000Z';

interface FixtureChannelDefinition {
	identifier: string;
	properties: ReadonlyArray<readonly [PropertyCategory, boolean | number]>;
}

const pad = (value: number): string => value.toString().padStart(6, '0');

const getSpaceId = (index: number, options: BuddyContextFixtureOptions): string => {
	if (options.spaceId) {
		return options.spaceId;
	}

	const spaceCount = Math.max(1, options.spaceCount ?? DEFAULT_SPACE_COUNT);

	return `space-${(index % spaceCount) + 1}`;
};

const createProperty = (
	deviceNumber: string,
	channelNumber: number,
	propertyNumber: number,
	category: PropertyCategory,
	value: boolean | number,
): ChannelPropertyEntity =>
	Object.assign(new ChannelPropertyEntity(), {
		id: `property-${deviceNumber}-${channelNumber}-${propertyNumber}`,
		identifier: category,
		name: category,
		category,
		value: new PropertyValueState(value, DEFAULT_TIMESTAMP, 'stable'),
	});

/**
 * Produce the raw entity graph returned by DevicesService/SpacesService. Every
 * device has three channels and five total properties so scale evaluations
 * exercise both nested and flattened Buddy context representations.
 */
export function createBuddyDeviceEntityFixtures(
	deviceCount: number,
	options: BuddyContextFixtureOptions = {},
): DeviceEntity[] {
	const offset = options.deviceIndexOffset ?? 0;

	return Array.from({ length: deviceCount }, (_, fixtureIndex) => {
		const index = offset + fixtureIndex;
		const deviceNumber = pad(index + 1);
		const deviceId = `device-${deviceNumber}`;
		const spaceId = getSpaceId(index, options);
		const channelDefinitions: FixtureChannelDefinition[] = [
			{
				identifier: 'light',
				properties: [
					[PropertyCategory.ON, index % 2 === 0],
					[PropertyCategory.BRIGHTNESS, (index * 7) % 101],
				],
			},
			{
				identifier: 'environment',
				properties: [
					[PropertyCategory.TEMPERATURE, 18 + (index % 12) * 0.5],
					[PropertyCategory.HUMIDITY, 35 + (index % 45)],
				],
			},
			{
				identifier: 'energy',
				properties: [[PropertyCategory.POWER, 5 + (index % 250)]],
			},
		];

		const channels = channelDefinitions.map((definition, channelIndex) => {
			const channelNumber = channelIndex + 1;
			const channel = Object.assign(new ChannelEntity(), {
				id: `channel-${deviceNumber}-${channelNumber}`,
				identifier: definition.identifier,
				name: definition.identifier,
				properties: definition.properties.map(([category, value], propertyIndex) =>
					createProperty(deviceNumber, channelNumber, propertyIndex + 1, category, value),
				),
			});

			return channel;
		});

		const device = Object.assign(new DeviceEntity(), {
			id: deviceId,
			identifier: deviceId,
			name: `Evaluation device ${deviceNumber}`,
			category: DeviceCategory.LIGHTING,
			roomId: spaceId,
			channels,
		});

		return device;
	});
}

/** Produce the flattened snapshot consumed by Buddy prompts and evaluators. */
export function createBuddyContextFixture(deviceCount: number, options: BuddyContextFixtureOptions = {}): BuddyContext {
	const devices = createBuddyDeviceEntityFixtures(deviceCount, options).map((device) => {
		const state: Record<string, unknown> = {};
		const channels = device.channels.map((channel) => ({
			id: channel.id,
			name: channel.identifier ?? channel.name ?? channel.id,
			properties: channel.properties.map((property) => {
				const value = property.value?.value ?? null;

				state[`${channel.identifier ?? channel.name ?? channel.id}.${property.category}`] = value;

				return { id: property.id, category: property.category, value };
			}),
		}));

		return {
			id: device.id,
			name: device.name,
			space: device.roomId,
			category: device.category,
			state,
			channels,
		};
	});

	const deviceCountsBySpace = new Map<string, number>();

	for (const device of devices) {
		if (device.space) {
			deviceCountsBySpace.set(device.space, (deviceCountsBySpace.get(device.space) ?? 0) + 1);
		}
	}

	return {
		timestamp: options.timestamp ?? DEFAULT_TIMESTAMP,
		timezone: options.timezone ?? 'UTC',
		spaces: [...deviceCountsBySpace].map(([id, count]) => ({
			id,
			name: `Evaluation ${id}`,
			category: 'living_room',
			deviceCount: count,
		})),
		devices,
		scenes: [],
		weather: null,
		energy: null,
		recentIntents: [],
	};
}
