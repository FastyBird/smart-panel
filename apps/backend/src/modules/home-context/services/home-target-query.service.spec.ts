import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SceneEntity } from '../../scenes/entities/scenes.entity';
import { SceneCategory } from '../../scenes/scenes.constants';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType } from '../../spaces/spaces.constants';
import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';
import { homeTriggerTargetsQuerySchema, homeWritablePropertiesQuerySchema } from '../schemas/home-target-input.schemas';
import {
	homeTriggerTargetsResultSchema,
	homeWritablePropertiesResultSchema,
} from '../schemas/home-target-output.schemas';

import { HomeTargetQueryService } from './home-target-query.service';

const profile = HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY;

describe('HomeTargetQueryService', () => {
	let service: HomeTargetQueryService;
	let propertiesService: { findWritableCandidates: jest.Mock };
	let connectionStates: { readLatestMany: jest.Mock };
	let platformRegistry: { get: jest.Mock };
	let scenesService: { findTriggerableSummaryPage: jest.Mock };
	let spacesService: { findLightingTriggerSummaryPage: jest.Mock };

	beforeEach(() => {
		propertiesService = {
			findWritableCandidates: jest.fn().mockResolvedValue({ properties: [], total: 0 }),
		};
		connectionStates = { readLatestMany: jest.fn().mockResolvedValue(new Map()) };
		platformRegistry = { get: jest.fn().mockReturnValue({}) };
		scenesService = { findTriggerableSummaryPage: jest.fn().mockResolvedValue({ scenes: [], total: 0 }) };
		spacesService = { findLightingTriggerSummaryPage: jest.fn().mockResolvedValue({ spaces: [], total: 0 }) };
		service = new HomeTargetQueryService(
			propertiesService as unknown as ChannelsPropertiesService,
			connectionStates as unknown as DeviceConnectionStateService,
			platformRegistry as unknown as PlatformRegistryService,
			scenesService as unknown as ScenesService,
			spacesService as unknown as SpacesService,
		);
	});

	it('returns exact actionable writable metadata in source order with compatibility filters', async () => {
		const connected = property(1, PermissionType.READ_WRITE);
		connected.name = 'Temperature';
		connected.category = PropertyCategory.TEMPERATURE;
		connected.dataType = DataTypeType.FLOAT;
		connected.unit = 'must-not-leak';
		connected.format = [-40, 125];
		connected.step = 0.1;
		connected.invalid = -999;
		(connected.channel as { category: ChannelCategory }).category = ChannelCategory.TEMPERATURE;
		const disconnected = property(2, PermissionType.WRITE_ONLY);
		const unknown = property(3, PermissionType.WRITE_ONLY);
		const missingStatus = property(4, PermissionType.WRITE_ONLY);
		const readOnly = property(5, PermissionType.READ_ONLY);
		const disabled = property(6, PermissionType.WRITE_ONLY);
		device(disabled).enabled = false;
		const hidden = property(7, PermissionType.WRITE_ONLY);
		device(hidden).hidden = true;
		const unregistered = property(8, PermissionType.WRITE_ONLY);
		propertiesService.findWritableCandidates.mockResolvedValue({
			properties: [connected, disconnected, unknown, missingStatus, readOnly, disabled, hidden, unregistered],
			total: 8,
		});
		platformRegistry.get.mockImplementation((candidate: DeviceEntity) =>
			candidate.id === device(unregistered).id ? null : {},
		);
		connectionStates.readLatestMany.mockResolvedValue(
			new Map([
				[device(connected).id, status(true, ConnectionState.CONNECTED)],
				[device(disconnected).id, status(false, ConnectionState.DISCONNECTED)],
				[device(unknown).id, status(false, ConnectionState.UNKNOWN)],
				[device(readOnly).id, status(true, ConnectionState.CONNECTED)],
			]),
		);

		await expect(service.getWritableProperties({ profile })).resolves.toEqual({
			properties: [
				{
					property_id: connected.id,
					property_name: 'Temperature',
					property_category: PropertyCategory.TEMPERATURE,
					device_id: device(connected).id,
					device_name: 'Device 1',
					channel_id: channelId(connected),
					channel_name: 'Switch 1',
					channel_category: ChannelCategory.TEMPERATURE,
					data_type: DataTypeType.FLOAT,
					unit: '°C',
					format: [-40, 125],
					step: 0.1,
					invalid: -999,
				},
				expectedWritableProperty(unknown),
				expectedWritableProperty(missingStatus),
			],
			truncated: false,
		});
		expect(propertiesService.findWritableCandidates).toHaveBeenCalledWith(500, 0);
		expect(connectionStates.readLatestMany).toHaveBeenCalledWith([
			device(connected),
			device(disconnected),
			device(unknown),
			device(missingStatus),
			device(readOnly),
		]);
	});

	it('pages past 500 filtered candidates and retains the ordered first 100 of 101 actionable targets', async () => {
		const offline = properties(500, 1);
		const actionable = properties(101, 501);
		propertiesService.findWritableCandidates
			.mockResolvedValueOnce({ properties: offline, total: 601 })
			.mockResolvedValueOnce({ properties: actionable, total: 601 });
		connectionStates.readLatestMany
			.mockImplementationOnce((targets: DeviceEntity[]) =>
				Promise.resolve(new Map(targets.map((target) => [target.id, status(false, ConnectionState.DISCONNECTED)]))),
			)
			.mockImplementationOnce((targets: DeviceEntity[]) =>
				Promise.resolve(new Map(targets.map((target) => [target.id, status(true, ConnectionState.CONNECTED)]))),
			);

		const result = await service.getWritableProperties({ profile });

		expect(propertiesService.findWritableCandidates).toHaveBeenNthCalledWith(1, 500, 0);
		expect(propertiesService.findWritableCandidates).toHaveBeenNthCalledWith(2, 500, 500);
		expect(result.properties).toHaveLength(100);
		expect(result.properties[0]?.property_id).toBe(actionable[0]?.id);
		expect(result.properties[99]?.property_id).toBe(actionable[99]?.id);
		expect(result.properties).not.toContainEqual(expect.objectContaining({ property_id: actionable[100]?.id }));
		expect(result.truncated).toBe(true);
	});

	it('returns exactly 100 actionable properties without truncation', async () => {
		const actionable = properties(100, 1);
		propertiesService.findWritableCandidates.mockResolvedValue({ properties: actionable, total: 100 });
		connectionStates.readLatestMany.mockImplementation((targets: DeviceEntity[]) =>
			Promise.resolve(new Map(targets.map((target) => [target.id, status(true, ConnectionState.CONNECTED)]))),
		);

		const result = await service.getWritableProperties({ profile });

		expect(result.properties).toHaveLength(100);
		expect(result.properties[0]?.property_id).toBe(actionable[0]?.id);
		expect(result.properties[99]?.property_id).toBe(actionable[99]?.id);
		expect(result.truncated).toBe(false);
	});

	it('maps exact mixed trigger targets with literal caps and independent truncation', async () => {
		const livingRoom = space(1);
		const kitchen = space(2);
		scenesService.findTriggerableSummaryPage.mockResolvedValue({
			scenes: [scene(1, true, true), scene(2, false, true), scene(3, true, false)],
			total: 51,
		});
		spacesService.findLightingTriggerSummaryPage.mockResolvedValue({ spaces: [livingRoom, kitchen], total: 50 });

		const result = await service.getTriggerTargets({ profile, includeScenes: true, includeSpaces: true });

		expect(scenesService.findTriggerableSummaryPage).toHaveBeenCalledWith(50);
		expect(spacesService.findLightingTriggerSummaryPage).toHaveBeenCalledWith(50);
		expect(result).toEqual({
			scenes: [
				{
					scene_id: 'scene-1',
					name: 'Scene 1',
					category: SceneCategory.GENERIC,
					primary_space_id: null,
				},
			],
			spaces: [
				{
					space_id: 'space-1',
					name: 'Space 1',
					type: SpaceType.ROOM,
					modes: ['off', 'on', 'work', 'relax', 'night'],
				},
				{
					space_id: 'space-2',
					name: 'Space 2',
					type: SpaceType.ROOM,
					modes: ['off', 'on', 'work', 'relax', 'night'],
				},
			],
			truncated: { scenes: true, spaces: false },
		});
		expect(result.spaces[0]?.modes).not.toBe(result.spaces[1]?.modes);
	});

	it('skips excluded trigger domains and returns independent empty sections', async () => {
		await expect(service.getTriggerTargets({ profile, includeScenes: false, includeSpaces: false })).resolves.toEqual({
			scenes: [],
			spaces: [],
			truncated: { scenes: false, spaces: false },
		});
		expect(scenesService.findTriggerableSummaryPage).not.toHaveBeenCalled();
		expect(spacesService.findLightingTriggerSummaryPage).not.toHaveBeenCalled();
	});

	it('validates fixed-profile strict inputs and complete bounded outputs', () => {
		const writable = expectedWritableProperty(property(1, PermissionType.READ_WRITE));

		expect(homeWritablePropertiesQuerySchema.safeParse({ profile }).success).toBe(true);
		expect(homeWritablePropertiesQuerySchema.safeParse({ profile, extra: true }).success).toBe(false);
		expect(
			homeTriggerTargetsQuerySchema.safeParse({ profile, includeScenes: true, includeSpaces: false }).success,
		).toBe(true);
		expect(
			homeTriggerTargetsQuerySchema.safeParse({ profile: 'other', includeScenes: true, includeSpaces: false }).success,
		).toBe(false);
		expect(homeWritablePropertiesResultSchema.safeParse({ properties: [], truncated: false }).success).toBe(true);
		for (const invalidEnumField of [
			{ property_category: 'not-a-property-category' },
			{ channel_category: 'not-a-channel-category' },
			{ data_type: 'not-a-data-type' },
		]) {
			expect(
				homeWritablePropertiesResultSchema.safeParse({
					properties: [{ ...writable, ...invalidEnumField }],
					truncated: false,
				}).success,
			).toBe(false);
		}
		expect(
			homeTriggerTargetsResultSchema.safeParse({
				scenes: [],
				spaces: [
					{ space_id: 'space-1', name: 'Space 1', type: 'room', modes: ['on', 'off', 'work', 'relax', 'night'] },
				],
				truncated: { scenes: false, spaces: false },
			}).success,
		).toBe(false);
		expect(
			homeTriggerTargetsResultSchema.safeParse({
				scenes: [
					{
						scene_id: 'scene-1',
						name: 'Scene 1',
						category: 'not-a-scene-category',
						primary_space_id: null,
					},
				],
				spaces: [],
				truncated: { scenes: false, spaces: false },
			}).success,
		).toBe(false);
		expect(
			homeTriggerTargetsResultSchema.safeParse({
				scenes: [],
				spaces: [
					{
						space_id: 'space-1',
						name: 'Space 1',
						type: 'not-a-space-type',
						modes: ['off', 'on', 'work', 'relax', 'night'],
					},
				],
				truncated: { scenes: false, spaces: false },
			}).success,
		).toBe(false);
	});

	function property(index: number, permission: PermissionType): ChannelPropertyEntity {
		return {
			id: `property-${index}`,
			name: `Power ${index}`,
			category: PropertyCategory.ON,
			permissions: [permission],
			dataType: DataTypeType.BOOL,
			unit: null,
			format: null,
			step: null,
			invalid: null,
			channel: {
				id: `channel-${index}`,
				name: `Switch ${index}`,
				category: ChannelCategory.SWITCHER,
				device: {
					id: `device-${index}`,
					name: `Device ${index}`,
					enabled: true,
					hidden: false,
				},
			},
		} as unknown as ChannelPropertyEntity;
	}

	function properties(count: number, start: number): ChannelPropertyEntity[] {
		return Array.from({ length: count }, (_, index) => property(start + index, PermissionType.READ_WRITE));
	}

	function device(target: ChannelPropertyEntity): { id: string; name: string; enabled: boolean; hidden: boolean } {
		return (target.channel as { device: { id: string; name: string; enabled: boolean; hidden: boolean } }).device;
	}

	function channelId(target: ChannelPropertyEntity): string {
		return (target.channel as { id: string }).id;
	}

	function expectedWritableProperty(target: ChannelPropertyEntity) {
		const targetDevice = device(target);
		const channel = target.channel as { id: string; name: string; category: ChannelCategory };

		return {
			property_id: target.id,
			property_name: target.name,
			property_category: target.category,
			device_id: targetDevice.id,
			device_name: targetDevice.name,
			channel_id: channel.id,
			channel_name: channel.name,
			channel_category: channel.category,
			data_type: target.dataType,
			unit: null,
			format: target.format,
			step: target.step,
			invalid: target.invalid,
		};
	}

	function status(online: boolean, state: ConnectionState) {
		return { online, status: state, lastChanged: new Date('2026-08-15T00:00:00.000Z') };
	}

	function scene(index: number, enabled: boolean, triggerable: boolean): SceneEntity {
		return {
			id: `scene-${index}`,
			name: `Scene ${index}`,
			category: SceneCategory.GENERIC,
			enabled,
			triggerable,
			primarySpaceId: null,
		} as SceneEntity;
	}

	function space(index: number): SpaceEntity {
		return { id: `space-${index}`, name: `Space ${index}`, type: SpaceType.ROOM } as SpaceEntity;
	}
});
