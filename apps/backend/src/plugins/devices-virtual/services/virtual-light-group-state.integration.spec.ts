/* eslint-disable @typescript-eslint/require-await -- Async storage fixture methods intentionally implement provider contracts. */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { CompositePropertyCommandRegistryService } from '../../../modules/devices/services/composite-property-command.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyCommandEntrySnapshot } from '../../../modules/devices/services/property-command-entry-snapshot';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { SceneEntity } from '../../../modules/scenes/entities/scenes.entity';
import { LocalSceneActionEntity } from '../../scenes-local/entities/scenes-local.entity';
import { ConfigureVirtualLightGroupDto } from '../dto/producer-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualLightGroupConfigEntity, VirtualLightGroupMemberEntity } from '../entities/virtual-producer.entity';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualLightGroupCommandService } from './virtual-light-group-command.service';
import { VirtualLightGroupStateService } from './virtual-light-group-state.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualValueSourceService } from './virtual-value-source.service';

jest.setTimeout(60_000);

describe('light group actual feedback with real SQLite bindings', () => {
	let database: SqliteDataSource;
	let runtime: VirtualLightGroupStateService;
	afterEach(async () => {
		runtime?.onModuleDestroy();
		jest.useRealTimers();
		if (database?.isInitialized) await database.destroy();
	});

	it('keeps missing identities, excludes offline/invalid/expired evidence, and cannot resurrect reported state after restart', async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		const events = new EventEmitter2();
		const graph = new VirtualDependencyGraphService(database);
		const structure = new DeviceStructureLockService();
		const storage = {
			isConnected: () => true,
			query: async () => [],
			enqueueWritePoint: () => undefined,
			flushQueuedWrites: async () => undefined,
		};
		const sources = new PropertyValueSourceRegistryService();
		sources.register(new VirtualValueSourceService(graph));
		let producers = new PropertyProducerRegistryService(events);
		let values = new PropertyValueService(
			storage as never,
			sources,
			new PropertyValueLockService(database),
			producers,
			events,
		);
		const offline = new Set<string>();
		const devices = {
			findOne: async (id: string) => {
				const device = await database.manager.findOneBy(DeviceEntity, { id });
				if (device)
					device.status = {
						online: !offline.has(id),
						status: offline.has(id) ? ConnectionState.DISCONNECTED : ConnectionState.CONNECTED,
						lastChanged: null,
					};
				return device;
			},
		};
		const groupId = uuid();
		const channelId = uuid();
		const outputId = uuid();
		await database.manager.insert(VirtualDeviceEntity, {
			id: groupId,
			name: 'Group',
			category: DeviceCategory.LIGHTING,
			mode: VirtualDeviceMode.ACTUATOR_GROUP,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: channelId,
			device: groupId,
			name: 'Group',
			category: ChannelCategory.LIGHT,
		} as never);
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id: outputId,
			channel: channelId,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.DERIVED,
		} as never);
		const physical: Array<{ deviceId: string; memberChannelId: string; propertyId: string }> = [];
		for (let index = 0; index < 2; index++) {
			const deviceId = uuid();
			const memberChannelId = uuid();
			const propertyId = uuid();
			await database.manager.insert(DeviceEntity, {
				id: deviceId,
				name: 'Physical',
				category: DeviceCategory.LIGHTING,
			});
			await database.manager.insert(ChannelEntity, {
				id: memberChannelId,
				device: deviceId,
				name: 'Light',
				category: ChannelCategory.LIGHT,
			} as never);
			await database.manager.insert(ChannelPropertyEntity, {
				id: propertyId,
				channel: memberChannelId,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			} as never);
			physical.push({ deviceId, memberChannelId, propertyId });
		}
		const brightnessOutput = uuid();
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id: brightnessOutput,
			channel: channelId,
			category: PropertyCategory.BRIGHTNESS,
			dataType: DataTypeType.FLOAT,
			format: [0, 100],
			step: 1,
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.DERIVED,
		} as never);
		const brightnessSources: string[] = [];
		for (const member of physical) {
			const propertyId = uuid();
			brightnessSources.push(propertyId);
			await database.manager.insert(ChannelPropertyEntity, {
				id: propertyId,
				channel: member.memberChannelId,
				category: PropertyCategory.BRIGHTNESS,
				dataType: DataTypeType.FLOAT,
				format: [0, 100],
				step: 1,
				permissions: [PermissionType.READ_WRITE],
			} as never);
		}
		const producerState = new VirtualProducerStateService(database, producers, graph, events);
		await producerState.onModuleInit();
		await graph.onApplicationBootstrap();
		runtime = new VirtualLightGroupStateService(
			database,
			values,
			producers,
			devices as never,
			graph,
			events,
			structure,
		);
		await runtime.onModuleInit();
		events.on(EventType.CHANNEL_PROPERTY_UPDATED, () => runtime.changed());
		const configs = new VirtualProducerConfigService(database, structure, graph, events, producerState);
		const configuration = Object.assign(new ConfigureVirtualLightGroupDto(), {
			expectedRevision: 0,
			profile: VirtualLightGroupProfile.LIGHT,
			members: physical.map((member, index) => ({
				sourceChannelId: member.memberChannelId,
				bindings: [
					{ outputPropertyId: outputId, sourcePropertyId: member.propertyId },
					{ outputPropertyId: brightnessOutput, sourcePropertyId: brightnessSources[index] },
				],
			})),
		});
		const configured = await configs.configureLightGroup(channelId, configuration);
		expect(graph.isRevisionCurrent(configured.graph_revision)).toBe(true);
		expect(configured.common_capabilities.map((capability) => capability.category)).toEqual([
			PropertyCategory.ON,
			PropertyCategory.BRIGHTNESS,
		]);
		const sceneId = uuid();
		const actionId = uuid();
		await database.manager.insert(SceneEntity, { id: sceneId, name: 'Brightness scene' });
		await database.manager.insert(LocalSceneActionEntity, {
			id: actionId,
			scene: sceneId,
			deviceId: groupId,
			channelId,
			propertyId: brightnessOutput,
			value: 75,
		} as never);
		await database.manager.update(ChannelPropertyEntity, brightnessSources[1], { format: [0, 50] });
		configuration.expectedRevision = 1;
		await expect(configs.configureLightGroup(channelId, configuration)).rejects.toThrow(
			/repair its scene\/tile references/,
		);
		expect(
			(await database.manager.findOneByOrFail(VirtualLightGroupConfigEntity, { groupChannelId: channelId })).revision,
		).toBe(1);
		expect((await database.manager.findOneByOrFail(LocalSceneActionEntity, { id: actionId })).propertyId).toBe(
			brightnessOutput,
		);
		await runtime.refresh();
		expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
		const report = async (index: number, value: boolean) => {
			const property = await database.manager.findOne(ChannelPropertyEntity, {
				where: { id: physical[index].propertyId },
				relations: ['channel'],
			});
			await values.writeSampleWithState(property, value, {
				sampledAt: new Date(),
				receivedAt: new Date(),
				provenance: 'live',
			});
		};
		await report(0, true);
		await report(1, false);
		await runtime.refresh();
		expect(producers.read(outputId)?.value).toBe(true);
		expect(runtime.getReportedState(channelId)).toMatchObject({ total: 2, onCount: 1, offCount: 1, mixed: true });
		const metadata = new PropertyMetadataService(database);
		const windows = new PropertyCommandWindowService();
		const registry = new CompositePropertyCommandRegistryService();
		const commands = new VirtualLightGroupCommandService(
			database,
			registry,
			devices as never,
			graph,
			metadata,
			values,
			windows,
		);
		const parent = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: outputId },
			relations: ['channel', 'channel.device'],
		});
		const parentChannel = parent.channel as ChannelEntity;
		expect(commands.canHandle(parent)).toBe(true);
		const plan = await commands.plan([
			{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value: true },
		]);
		expect(plan.children).toHaveLength(2);
		expect(await plan.isCurrent()).toBe(true);
		expect(plan.isDispatchCurrent()).toBe(true);
		commands.onModuleInit();
		const physicalDispatch = jest.fn((targets: readonly IDevicePropertyData[], guard: () => boolean) => {
			if (!guard()) return Promise.resolve(false);
			for (const target of targets) {
				const window = windows.get(target.property.id);
				windows.confirm(
					{ canonicalPropertyId: target.property.id, generation: window.generation },
					{ value: target.value, receivedAt: Date.now() },
				);
			}
			return Promise.resolve(true);
		});
		const dispatch = new PropertyCommandDispatchService(
			metadata,
			values,
			{} as never,
			devices as never,
			{
				get: () => ({
					prepareCompositeBatch: (targets: readonly IDevicePropertyData[]) =>
						Promise.resolve({
							updates: targets,
							isCurrent: () => true,
							dispatch: (guard: () => boolean) => physicalDispatch(targets, guard),
						}),
				}),
				usesAuthoritativePropertyReadback: () => false,
			} as never,
			sources,
			structure,
			new PropertyStateCoordinatorService(),
			windows,
			undefined,
			registry,
			events,
		);
		const sendGroup = () =>
			dispatch.dispatchBatch(
				[{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value: true }],
				{ ttlMs: 1000 },
			);
		expect((await sendGroup()).composite.children.map((child) => child.status)).toEqual(['confirmed', 'confirmed']);
		expect(physicalDispatch).toHaveBeenCalledTimes(2);
		await database.manager.update(ChannelPropertyEntity, brightnessSources[1], { format: [0, 100] });
		configuration.expectedRevision = 1;
		const reconfigured = await configs.configureLightGroup(channelId, configuration);
		expect(graph.isRevisionCurrent(reconfigured.graph_revision)).toBe(true);
		expect(plan.isDispatchCurrent()).toBe(false);
		expect((await sendGroup()).composite.children.map((child) => child.status)).toEqual(['confirmed', 'confirmed']);
		expect(physicalDispatch).toHaveBeenCalledTimes(4);
		configuration.expectedRevision = 2;
		const stableRevision = await graph.revision();
		await expect(
			configs.configureLightGroup(
				channelId,
				Object.assign(new ConfigureVirtualLightGroupDto(), configuration, {
					members: [configuration.members[0], configuration.members[0]],
				}),
			),
		).rejects.toThrow(/distinct/);
		expect(await graph.revision()).toBe(stableRevision);
		expect(graph.isRevisionCurrent(stableRevision)).toBe(true);
		dispatch.onModuleDestroy();
		const brightnessParent = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
			where: { id: brightnessOutput },
			relations: ['channel', 'channel.device'],
		});
		const brightnessUpdate = {
			property: brightnessParent,
			channel: parentChannel,
			device: parentChannel.device as DeviceEntity,
			value: 45,
		};
		const brightnessPlan = await commands.plan([brightnessUpdate]);
		expect(brightnessPlan.children).toHaveLength(4);
		expect(
			brightnessPlan.children
				.filter((child) => child.update?.property.category === PropertyCategory.ON)
				.map((child) => child.update.value),
		).toEqual(expect.arrayContaining([true, false]));
		const preserved = brightnessPlan.children.find((child) => child.update?.property.id === physical[0].propertyId);
		const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined);
		const newer = windows.open({
			canonicalTarget: {
				deviceId: physical[0].deviceId,
				channelId: physical[0].memberChannelId,
				propertyId: physical[0].propertyId,
			},
			requestedTargets: [],
			commandedValue: false,
			previousValue: true,
			ttlMs: 100,
		});
		windows.close(newer);
		expect(preserved.admissionCheck()).toBe(false);
		brightnessPlan.dispose();
		// A separate budget plan can finish before a competing OFF opens and closes.
		// Actual planning must still refuse the old qualified ON evidence.
		const afterBudget = await commands.plan([brightnessUpdate], entry);
		expect(
			afterBudget.children.find((child) => child.memberIdentity === physical[0].memberChannelId)?.update,
		).toBeNull();
		afterBudget.dispose();
		entry.dispose();
		const combined = await commands.plan([
			brightnessUpdate,
			{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value: false },
		]);
		expect(combined.children).toHaveLength(4);
		expect(
			combined.children
				.filter((child) => child.update?.property.category === PropertyCategory.ON)
				.every((child) => child.update.value === false),
		).toBe(true);
		combined.dispose();
		jest.spyOn(graph, 'revision').mockImplementationOnce(() => {
			windows.open({
				canonicalTarget: {
					deviceId: physical[0].deviceId,
					channelId: physical[0].memberChannelId,
					propertyId: physical[0].propertyId,
				},
				requestedTargets: [],
				commandedValue: false,
				previousValue: true,
				ttlMs: 100,
			});
			return Promise.resolve(2);
		});
		const changedDuringPlanning = await commands.plan([brightnessUpdate]);
		expect(
			changedDuringPlanning.children.find((child) => child.memberIdentity === physical[0].memberChannelId)?.update,
		).toBeNull();
		changedDuringPlanning.dispose();
		commands.onModuleDestroy();
		producerState.onModuleDestroy();

		offline.add(physical[0].deviceId);
		await runtime.refresh();
		expect(runtime.getReportedState(channelId)).toMatchObject({ on: null, unknownCount: 1 });
		expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
		offline.clear();
		await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { dataType: DataTypeType.STRING });
		expect(await plan.isCurrent()).toBe(false);
		metadata.onModuleDestroy();
		await runtime.refresh();
		expect(runtime.getReportedState(channelId)?.unknownCount).toBe(1);
		await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { dataType: DataTypeType.BOOL });
		await runtime.refresh();
		expect(producers.read(outputId)?.value).toBe(true);
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		jest.setSystemTime(Date.now() + 300_010);
		await runtime.refresh();
		expect(runtime.getReportedState(channelId)?.unknownCount).toBe(2);
		expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
		jest.useRealTimers();
		await database.manager.delete(ChannelEntity, physical[0].memberChannelId);
		await runtime.refresh();
		const intended = await database.manager.find(VirtualLightGroupMemberEntity, {
			where: { groupChannelId: channelId },
		});
		expect(intended).toHaveLength(2);
		expect(
			intended.find((member) => member.sourceChannelIdentity === physical[0].memberChannelId)?.sourceChannelId,
		).toBeNull();
		expect(runtime.getReportedState(channelId)?.total).toBe(2);
		runtime.onModuleDestroy();
		producers = new PropertyProducerRegistryService(events);
		values = new PropertyValueService(
			storage as never,
			sources,
			new PropertyValueLockService(database),
			producers,
			events,
		);
		runtime = new VirtualLightGroupStateService(
			database,
			values,
			producers,
			devices as never,
			graph,
			events,
			structure,
		);
		await runtime.refresh();
		expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
		expect(runtime.getReportedState(channelId)?.unknownCount).toBe(2);
	});
});
