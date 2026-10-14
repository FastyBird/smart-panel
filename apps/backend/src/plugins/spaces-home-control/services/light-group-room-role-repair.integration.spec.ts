import { v4 as uuid } from 'uuid';

import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DeviceContributionRegistryService } from '../../../modules/devices/services/device-contribution.registry.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../../devices-virtual/entities/devices-virtual.entity';
import { SetLightingRoleDto } from '../dto/lighting-role.dto';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { LightingIntentType, LightingRole } from '../spaces-home-control.constants';

import { LightingContributionPlannerService } from './lighting-contribution-planner.service';
import { LightingIntentService } from './lighting-intent.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpaceLightingStateService } from './space-lighting-state.service';

jest.setTimeout(30000);
describe('persisted room role repair for overlapping light groups', () => {
	let database: SqliteDataSource;
	afterEach(async () => {
		if (database?.isInitialized) await database.destroy();
	});
	it('rejects overlap before dispatch, repairs participation through a saved role, and restores the conflict', async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		const room = await database.getRepository(SpaceEntity).save({ name: 'Room', type: SpaceType.ROOM });
		const channels = new Map<string, string>(),
			devices = new Map<string, string>();
		const compositePropertyIds = new Set<string>();
		for (const name of ['A', 'B', 'C', 'AB', 'BC']) {
			const deviceId = uuid(),
				channelId = uuid(),
				propertyId = uuid();
			const composite = name.length === 2;
			devices.set(name, deviceId);
			channels.set(name, channelId);
			await database.getRepository(composite ? VirtualDeviceEntity : DeviceEntity).insert({
				id: deviceId,
				name,
				roomId: room.id,
				category: DeviceCategory.LIGHTING,
				...(composite ? { mode: VirtualDeviceMode.ACTUATOR_GROUP } : {}),
			});
			await database
				.getRepository(composite ? VirtualChannelEntity : ChannelEntity)
				.insert({ id: channelId, device: deviceId, name, category: ChannelCategory.LIGHT } as never);
			await database.getRepository(composite ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
				id: propertyId,
				channel: channelId,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [composite ? PermissionType.READ_ONLY : PermissionType.READ_WRITE],
				...(composite ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
			} as never);
			if (composite) compositePropertyIds.add(propertyId);
		}
		// Mock only the provider boundary; the planner, role persistence and both consumers are real.
		const coverage = new Map([
			[channels.get('AB'), ['A', 'B'].map((name) => channels.get(name))],
			[channels.get('BC'), ['B', 'C'].map((name) => channels.get(name))],
		]);
		const registry = new DeviceContributionRegistryService();
		registry.register({
			getCoverage: (channel) =>
				Promise.resolve(
					coverage.has(channel.id)
						? {
								leaves: coverage.get(channel.id),
								reported: { total: 2, on: 0, unknown: 0, mixed: false, mixedProperties: [], properties: [] },
							}
						: null,
				),
		});
		const planner = new LightingContributionPlannerService(registry);
		const findDevices = async () => {
			const result = await database
				.getRepository(DeviceEntity)
				.find({ where: { roomId: room.id }, relations: ['channels', 'channels.properties'] });
			for (const device of result) Object.defineProperty(device, 'status', { value: { online: true } });
			return result;
		};
		const spaces = {
			getOneOrThrow: () => Promise.resolve(room),
			findOne: () => Promise.resolve(room),
			findDevicesBySpace: findDevices,
			isDeviceInSpace: (_spaceId: string, deviceId: string) =>
				Promise.resolve([...devices.values()].includes(deviceId)),
		};
		const roles = new SpaceLightingRoleService(
			database.getRepository(SpaceLightingRoleEntity),
			database.getRepository(DeviceEntity),
			spaces as never,
			new EventEmitter2(),
		);
		const reads = {
			findOne: () => Promise.resolve(room),
			findDevicesBySpace: findDevices,
			getLightingRoleMap: () => roles.getRoleMap(room.id),
		};
		const timeseries = {
			getLastLightingMode: () => Promise.resolve(null),
			getModeValidity: () => Promise.resolve(null),
			storeModeValidity: jest.fn(),
		};
		const state = new SpaceLightingStateService(reads as never, timeseries as never, {} as never, planner);
		const dispatchBatch = jest.fn((_commands: IDevicePropertyData[]) => Promise.resolve({ success: true }));
		const createIntent = jest.fn(() => ({ id: uuid(), expiresAt: new Date(Date.now() + 30000) }));
		const intents = new LightingIntentService(
			spaces as never,
			{ get: () => ({}), getCommandTtlMs: () => 30000 } as never,
			{ dispatchBatch } as never,
			roles,
			new EventEmitter2(),
			{ captureSnapshot: () => Promise.resolve(null) } as never,
			{} as never,
			timeseries as never,
			state,
			{} as never,
			{ createIntent, completeIntent: jest.fn() } as never,
			planner,
			{
				get: (property: ChannelPropertyEntity) => (compositePropertyIds.has(property.id) ? {} : null),
				estimateTimeoutMs: () => Promise.resolve(30000),
			} as never,
		);
		const command = { type: LightingIntentType.ON };
		await expect(state.getLightingState(room.id)).rejects.toBeInstanceOf(ConflictException);
		await expect(intents.executeLightingIntent(room.id, command)).rejects.toBeInstanceOf(ConflictException);
		expect(dispatchBatch).not.toHaveBeenCalled();
		expect(createIntent).not.toHaveBeenCalled();
		const role = (value: LightingRole) =>
			Object.assign(new SetLightingRoleDto(), {
				deviceId: devices.get('BC'),
				channelId: channels.get('BC'),
				role: value,
			});
		await roles.setRole(room.id, role(LightingRole.HIDDEN));
		expect((await roles.findOne(room.id, devices.get('BC'), channels.get('BC'))).role).toBe(LightingRole.HIDDEN);
		expect((await state.getLightingState(room.id)).totalLights).toBe(3);
		await expect(intents.executeLightingIntent(room.id, command)).resolves.toMatchObject({
			success: true,
			affectedDevices: 2,
		});
		const dispatched = dispatchBatch.mock.calls.flatMap(([commands]) => commands.map((command) => command.channel.id));
		expect(dispatched.sort()).toEqual([channels.get('AB'), channels.get('C')].sort());
		// Dispatch targets partition the intended leaves once; downstream expansion has its own tests.
		expect(dispatched.flatMap((id) => coverage.get(id) ?? [id]).sort()).toEqual(
			['A', 'B', 'C'].map((name) => channels.get(name)).sort(),
		);
		expect(await roles.getLightTargetsInSpace(room.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ channelId: channels.get('BC'), role: LightingRole.HIDDEN }),
				expect.objectContaining({ channelId: channels.get('C') }),
			]),
		);
		const raw = (await findDevices()).find((device) => device.id === devices.get('C'));
		expect(raw.hidden).toBe(false);
		expect(raw.channels[0].properties[0].permissions).toContain(PermissionType.READ_WRITE);
		await roles.setRole(room.id, role(LightingRole.OTHER));
		dispatchBatch.mockClear();
		createIntent.mockClear();
		await expect(state.getLightingState(room.id)).rejects.toBeInstanceOf(ConflictException);
		await expect(intents.executeLightingIntent(room.id, command)).rejects.toBeInstanceOf(ConflictException);
		expect(dispatchBatch).not.toHaveBeenCalled();
		expect(createIntent).not.toHaveBeenCalled();
	});
});
