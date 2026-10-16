/* eslint-disable @typescript-eslint/require-await -- Async storage fixture methods intentionally implement provider contracts. */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { ExtensionLoggerService } from '../../../common/logger/extension-logger.service';
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
		const currentPlan = await commands.plan([
			{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value: true },
		]);
		const snapshotFailure = jest
			.spyOn(graph, 'edges')
			.mockRejectedValueOnce(new Error('validation snapshot unavailable'));
		const logged = jest.spyOn(ExtensionLoggerService.prototype, 'error').mockImplementation();
		try {
			await structure.runExclusive(() => graph.withStructuralWrite(() => Promise.resolve()));
			expect(runtime.getReportedState(channelId)).toBeNull();
			expect(runtime.getReportedModel(channelId)).toBeNull();
			expect((await configs.getLightGroup(channelId)).reported_state).toBeNull();
			expect(currentPlan.isDispatchCurrent()).toBe(false);
			expect(await currentPlan.isCurrent()).toBe(false);
			const failedPlan = await commands.plan([
				{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value: true },
			]);
			expect(failedPlan.isDispatchCurrent()).toBe(false);
			expect(await failedPlan.isCurrent()).toBe(false);
			expect((await sendGroup()).success).toBe(false);
			expect(physicalDispatch).toHaveBeenCalledTimes(4);
			await graph.refreshQuarantine();
			expect((await sendGroup()).composite.children.map((child) => child.status)).toEqual(['confirmed', 'confirmed']);
			expect(physicalDispatch).toHaveBeenCalledTimes(6);
		} finally {
			snapshotFailure.mockRestore();
			logged.mockRestore();
		}
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
	it.each([
		[VirtualLightGroupProfile.LIGHT, DeviceCategory.LIGHTING, ChannelCategory.LIGHT],
		[VirtualLightGroupProfile.FAN, DeviceCategory.FAN, ChannelCategory.FAN],
		[VirtualLightGroupProfile.SWITCH, DeviceCategory.SWITCHER, ChannelCategory.SWITCHER],
		[VirtualLightGroupProfile.OUTLET, DeviceCategory.OUTLET, ChannelCategory.OUTLET],
	] as const)(
		'routes %s through the actual core planner, preserving feedback and offline members',
		async (profile, deviceCategory, channelCategory) => {
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
			const producers = new PropertyProducerRegistryService(events);
			const values = new PropertyValueService(
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
				category: deviceCategory,
				mode: VirtualDeviceMode.ACTUATOR_GROUP,
			});
			await database.manager.insert(VirtualChannelEntity, {
				id: channelId,
				device: groupId,
				name: 'Group',
				category: channelCategory,
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
					category: deviceCategory,
				});
				await database.manager.insert(ChannelEntity, {
					id: memberChannelId,
					device: deviceId,
					name: 'Light',
					category: channelCategory,
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

			const inUseOutput = uuid();
			const inUseSources: string[] = [];
			if (profile === VirtualLightGroupProfile.OUTLET) {
				await database.manager.insert(VirtualChannelPropertyEntity, {
					id: inUseOutput,
					channel: channelId,
					category: PropertyCategory.IN_USE,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_ONLY],
					valueOrigin: VirtualValueOrigin.DERIVED,
				} as never);
				for (const member of physical) {
					const id = uuid();
					inUseSources.push(id);
					await database.manager.insert(ChannelPropertyEntity, {
						id,
						channel: member.memberChannelId,
						category: PropertyCategory.IN_USE,
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_ONLY],
					} as never);
				}
			}
			const producerState = new VirtualProducerStateService(database, producers, graph, events);
			await graph.onApplicationBootstrap();
			const configs = new VirtualProducerConfigService(database, structure, graph, events, producerState);
			const configuration = Object.assign(new ConfigureVirtualLightGroupDto(), {
				profile,
				expectedRevision: 0,
				members: physical.map((member, index) => ({
					sourceChannelId: member.memberChannelId,
					bindings: [
						{ outputPropertyId: outputId, sourcePropertyId: member.propertyId },
						...(profile === VirtualLightGroupProfile.OUTLET
							? [{ outputPropertyId: inUseOutput, sourcePropertyId: inUseSources[index] }]
							: []),
					],
				})),
			});
			await configs.configureLightGroup(channelId, configuration);
			await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { format: ['true'] });
			await expect(
				configs.configureLightGroup(
					channelId,
					Object.assign(new ConfigureVirtualLightGroupDto(), configuration, { expectedRevision: 1 }),
				),
			).rejects.toThrow(/profile-required access|remove capability/);
			expect((await configs.getLightGroup(channelId)).revision).toBe(1);
			await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { format: null });
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
			expect(runtime.getReportedState(channelId)).toMatchObject({ total: 2, unknownCount: 2, on: null });
			const report = async (propertyId: string, value: boolean) => {
				const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
					where: { id: propertyId },
					relations: ['channel'],
				});
				await values.writeSampleWithState(property, value, {
					sampledAt: new Date(),
					receivedAt: new Date(),
					provenance: 'live',
				});
			};
			await report(physical[0].propertyId, true);
			await report(physical[1].propertyId, false);
			for (const id of inUseSources) await report(id, true);
			await runtime.refresh();
			expect(runtime.getReportedState(channelId)).toMatchObject({ on: true, mixed: true, unknownCount: 0 });
			if (inUseSources.length) expect(producers.read(inUseOutput)?.value).toBe(true);
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
			if (inUseSources.length) {
				const observation = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
					where: { id: inUseOutput },
					relations: ['channel', 'channel.device'],
				});
				expect(commands.canHandle(observation)).toBe(false);
				await expect(
					commands.plan([
						{
							property: observation,
							channel: parentChannel,
							device: parentChannel.device as DeviceEntity,
							value: false,
						},
					]),
				).rejects.toThrow(/not commandable/);
			}
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
			const send = (value = true) =>
				dispatch.dispatchBatch(
					[{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value }],
					{ ttlMs: 1000 },
				);
			expect((await send()).composite.children.map((child) => child.status)).toEqual(['confirmed', 'confirmed']);
			expect(physicalDispatch).toHaveBeenCalledTimes(2);

			// Metadata can change after authoring, or an older release can have persisted a
			// one-state contract. No such source/output may dispatch or supply group evidence.
			for (const format of [['true'], ['false'], ['true', 'garbage'], ['true', 'true'], [0, 1]]) {
				await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { format });
				await report(physical[0].propertyId, false);
				await runtime.refresh();
				expect(runtime.getReportedState(channelId)).toMatchObject({
					on: profile === VirtualLightGroupProfile.LIGHT ? false : null,
					unknownCount: profile === VirtualLightGroupProfile.LIGHT ? 0 : 1,
				});
				const previousCalls = physicalDispatch.mock.calls.length;
				const result = await send(false);
				expect(result.composite.children.map((child) => child.status).sort()).toEqual(
					profile === VirtualLightGroupProfile.LIGHT ? ['confirmed', 'confirmed'] : ['confirmed', 'unavailable'],
				);
				const dispatched = physicalDispatch.mock.calls.slice(previousCalls).flatMap(([targets]) => targets);
				expect(dispatched.some((target) => target.property.id === physical[0].propertyId)).toBe(
					profile === VirtualLightGroupProfile.LIGHT,
				);
				if (profile !== VirtualLightGroupProfile.LIGHT)
					expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
			}
			await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { format: null });
			if (profile !== VirtualLightGroupProfile.LIGHT) {
				for (const format of [['true'], ['true', 'invalid'], [0, 1]]) {
					await database.manager.update(VirtualChannelPropertyEntity, outputId, { format });
					parent.format = format;
					const previousCalls = physicalDispatch.mock.calls.length;
					await expect(
						commands.plan([
							{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value: false },
						]),
					).rejects.toThrow(/two-state boolean contract/);
					expect((await send(false)).success).toBe(false);
					expect(physicalDispatch).toHaveBeenCalledTimes(previousCalls);
					await runtime.refresh();
					expect(runtime.getReportedState(channelId)).toMatchObject({ on: null, unknownCount: 2 });
					expect(producers.read(outputId)?.producer.quality).toBe('unavailable');
					await expect(
						configs.configureLightGroup(
							channelId,
							Object.assign(new ConfigureVirtualLightGroupDto(), configuration, { expectedRevision: 1 }),
						),
					).rejects.toThrow(/two-state boolean contract/);
				}
				await database.manager.update(VirtualChannelPropertyEntity, outputId, { format: null });
				parent.format = null;
			}
			if (inUseSources.length) {
				await database.manager.update(ChannelPropertyEntity, inUseSources[0], { format: ['true'] });
				for (const value of [true, false]) {
					await report(inUseSources[0], value);
					await runtime.refresh();
					expect(runtime.getReportedState(channelId).properties.get(PropertyCategory.IN_USE).value).toBeNull();
					expect(producers.read(inUseOutput)?.producer.quality).toBe('unavailable');
				}
				await database.manager.update(ChannelPropertyEntity, inUseSources[0], { format: null });
				await report(inUseSources[0], true);
			}
			// Accepted two-state metadata follows the same case-insensitive spelling as core BOOL parsing.
			await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { format: ['FALSE', 'True'] });
			const accepted = await send(false);
			expect(accepted.composite.children.map((child) => child.status)).toEqual(['confirmed', 'confirmed']);
			await database.manager.update(ChannelPropertyEntity, physical[0].propertyId, { format: null });
			await report(physical[0].propertyId, true);
			await runtime.refresh();
			let lateHandle: { canonicalPropertyId: string; generation: string } | undefined;
			physicalDispatch.mockImplementationOnce((targets) => {
				const window = windows.get(targets[0].property.id);
				lateHandle = { canonicalPropertyId: targets[0].property.id, generation: window.generation };
				return Promise.resolve(false);
			});
			const failed = await send();
			expect(failed.composite.status).toBe('partial');
			expect(failed.composite.children.map((child) => child.status)).toEqual(['failed', 'confirmed']);
			expect(windows.confirm(lateHandle, { value: true, receivedAt: Date.now() })).toBeNull();
			await report(physical[0].propertyId, false);
			await runtime.refresh();
			expect(runtime.getReportedState(channelId)).toMatchObject({ on: false, mixed: false });
			expect(failed.composite.children[0].status).toBe('failed');
			await report(physical[0].propertyId, true);
			offline.add(physical[0].deviceId);
			await runtime.refresh();
			expect(runtime.getReportedState(channelId)).toMatchObject({ total: 2, unknownCount: 1, on: null });
			const outcome = await send();
			expect(outcome.composite.children).toHaveLength(2);
			expect(outcome.composite.children.some((child) => child.status !== 'confirmed')).toBe(true);
			expect((await configs.getLightGroup(channelId)).members).toHaveLength(2);
			if (inUseSources.length) expect(producers.read(inUseOutput)?.producer.quality).toBe('unavailable');
			const oldPlan = await commands.plan([
				{ property: parent, channel: parentChannel, device: parentChannel.device as DeviceEntity, value: true },
			]);
			await expect(
				configs.configureLightGroup(
					channelId,
					Object.assign(new ConfigureVirtualLightGroupDto(), configuration, {
						expectedRevision: 1,
						members: [configuration.members[0], configuration.members[0]],
					}),
				),
			).rejects.toThrow(/distinct/);
			configuration.expectedRevision = 1;
			await configs.configureLightGroup(channelId, configuration);
			expect(await oldPlan.isCurrent()).toBe(false);
			offline.clear();
			await report(physical[0].propertyId, false);
			await runtime.refresh();
			expect(runtime.getReportedState(channelId)).toMatchObject({ on: false, mixed: false });
			await database.manager.delete(ChannelEntity, physical[0].memberChannelId);
			await runtime.refresh();
			expect(runtime.getReportedState(channelId)).toMatchObject({ total: 2, unknownCount: 1 });
			const intended = await configs.getLightGroup(channelId);
			expect(intended.members).toHaveLength(2);
			expect(intended.members.some((member) => member.source_channel === null)).toBe(true);
			expect(intended.common_capabilities.map((capability) => capability.category)).toEqual(
				profile === VirtualLightGroupProfile.OUTLET
					? [PropertyCategory.ON, PropertyCategory.IN_USE]
					: [PropertyCategory.ON],
			);
			const replacementChannel = uuid();
			const replacementOn = uuid();
			const replacementInUse = uuid();
			await database.manager.insert(ChannelEntity, {
				id: replacementChannel,
				device: physical[1].deviceId,
				name: 'Replacement',
				category: channelCategory,
			} as never);
			await database.manager.insert(ChannelPropertyEntity, {
				id: replacementOn,
				channel: replacementChannel,
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			} as never);
			if (inUseSources.length)
				await database.manager.insert(ChannelPropertyEntity, {
					id: replacementInUse,
					channel: replacementChannel,
					category: PropertyCategory.IN_USE,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_ONLY],
				} as never);
			const repaired = await configs.configureLightGroup(
				channelId,
				Object.assign(new ConfigureVirtualLightGroupDto(), {
					profile,
					expectedRevision: intended.revision,
					expectedGraphRevision: intended.graph_revision,
					members: intended.members.map((member) => ({
						id: member.id,
						sourceChannelId: member.source_channel ?? replacementChannel,
						bindings: member.bindings.map((binding) => ({
							id: binding.id,
							outputPropertyId: binding.output_property,
							sourcePropertyId: member.source_channel
								? binding.source_property
								: binding.output_property === outputId
									? replacementOn
									: replacementInUse,
						})),
					})),
				}),
			);
			expect(repaired.members.map((member) => member.id)).toEqual(intended.members.map((member) => member.id));
			expect(repaired.members.flatMap((member) => member.bindings.map((binding) => binding.id))).toEqual(
				intended.members.flatMap((member) => member.bindings.map((binding) => binding.id)),
			);
			expect(repaired.members.flatMap((member) => member.bindings.map((binding) => binding.output_property))).toEqual(
				intended.members.flatMap((member) => member.bindings.map((binding) => binding.output_property)),
			);
			await runtime.refresh();
			expect(runtime.getReportedState(channelId)).toMatchObject({ total: 2, unknownCount: 1 });
			await report(replacementOn, false);
			if (inUseSources.length) await report(replacementInUse, false);
			await runtime.refresh();
			expect(runtime.getReportedState(channelId)).toMatchObject({ on: false, unknownCount: 0 });
			if (inUseSources.length)
				expect(runtime.getReportedState(channelId).properties.get(PropertyCategory.IN_USE)).toMatchObject({
					value: null,
					mixed: true,
				});
			commands.onModuleDestroy();
			metadata.onModuleDestroy();
			producerState.onModuleDestroy();
		},
	);
});
