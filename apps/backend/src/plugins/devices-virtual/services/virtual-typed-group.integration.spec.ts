/* eslint-disable @typescript-eslint/require-await -- Async storage fixture methods intentionally implement provider contracts. */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { CompositePropertyCommandRegistryService } from '../../../modules/devices/services/composite-property-command.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ConfigureVirtualLightGroupDto } from '../dto/producer-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualLightGroupCommandService } from './virtual-light-group-command.service';
import { VirtualLightGroupStateService } from './virtual-light-group-state.service';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualValueSourceService } from './virtual-value-source.service';

jest.setTimeout(30000);
describe('typed fan/cover SQLite and core composite lifecycle', () => {
	it.each([VirtualLightGroupProfile.FAN, VirtualLightGroupProfile.COVER])(
		'%s keeps physical feedback separate from commands',
		async (profile) => {
			const database = await new SqliteDataSource({
				type: 'sqlite',
				database: ':memory:',
				synchronize: true,
				entities: [__dirname + '/../../../**/*.entity.ts'],
			}).initialize();
			const events = new EventEmitter2();
			const graph = new VirtualDependencyGraphService(database);
			const structure = new DeviceStructureLockService();
			const producers = new PropertyProducerRegistryService(events);
			const sources = new PropertyValueSourceRegistryService();
			sources.register(new VirtualValueSourceService(graph));
			const values = new PropertyValueService(
				{
					isConnected: () => true,
					query: async () => [],
					enqueueWritePoint: () => undefined,
					flushQueuedWrites: async () => undefined,
				} as never,
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
						device.status = { online: !offline.has(id), status: ConnectionState.CONNECTED, lastChanged: null };
					return device;
				},
			};
			const category = profile === VirtualLightGroupProfile.FAN ? DeviceCategory.FAN : DeviceCategory.WINDOW_COVERING;
			const channelCategory =
				profile === VirtualLightGroupProfile.FAN ? ChannelCategory.FAN : ChannelCategory.WINDOW_COVERING;
			const quantity = profile === VirtualLightGroupProfile.FAN ? PropertyCategory.SPEED : PropertyCategory.POSITION;
			const fieldDefinitions =
				profile === VirtualLightGroupProfile.FAN
					? [
							{
								category: PropertyCategory.MODE,
								dataType: DataTypeType.ENUM,
								format: ['auto', 'manual'],
								step: null,
								permissions: [PermissionType.READ_WRITE],
							},
							{
								category: PropertyCategory.ON,
								dataType: DataTypeType.BOOL,
								format: null,
								step: null,
								permissions: [PermissionType.READ_WRITE],
							},
						]
					: [
							{
								category: PropertyCategory.TYPE,
								dataType: DataTypeType.ENUM,
								format: ['blind'],
								step: null,
								permissions: [PermissionType.READ_ONLY],
							},
							{
								category: PropertyCategory.STATUS,
								dataType: DataTypeType.ENUM,
								format: ['opened', 'closed', 'opening', 'closing', 'stopped'],
								step: null,
								permissions: [PermissionType.READ_ONLY],
							},
							{
								category: PropertyCategory.COMMAND,
								dataType: DataTypeType.ENUM,
								format: ['open', 'close', 'stop'],
								step: null,
								permissions: [PermissionType.WRITE_ONLY],
							},
							{
								category: PropertyCategory.OBSTRUCTION,
								dataType: DataTypeType.BOOL,
								format: null,
								step: null,
								permissions: [PermissionType.READ_ONLY],
							},
						];
			const fields = [
				...fieldDefinitions,
				{
					category: quantity,
					dataType: DataTypeType.UCHAR,
					format: [0, 100],
					step: 1,
					permissions: [PermissionType.READ_WRITE],
				},
			];
			const groupId = uuid();
			const channelId = uuid();
			await database.manager.insert(VirtualDeviceEntity, {
				id: groupId,
				name: 'Typed group',
				category,
				mode: VirtualDeviceMode.ACTUATOR_GROUP,
			});
			await database.manager.insert(VirtualChannelEntity, {
				id: channelId,
				device: groupId,
				name: 'Group',
				category: channelCategory,
			} as never);
			const outputs = new Map<PropertyCategory, string>();
			for (const field of fields) {
				const id = uuid();
				outputs.set(field.category, id);
				await database.manager.insert(VirtualChannelPropertyEntity, {
					...field,
					id,
					channel: channelId,
					permissions: [PermissionType.READ_ONLY],
					valueOrigin: VirtualValueOrigin.DERIVED,
				} as never);
			}
			const members: Array<{ device: string; channel: string; properties: Map<PropertyCategory, string> }> = [];
			for (let i = 0; i < 2; i++) {
				const device = uuid();
				const channel = uuid();
				const properties = new Map<PropertyCategory, string>();
				await database.manager.insert(DeviceEntity, { id: device, name: 'Physical', category });
				await database.manager.insert(ChannelEntity, {
					id: channel,
					device,
					name: 'Physical',
					category: channelCategory,
				} as never);
				for (const field of fields) {
					const id = uuid();
					properties.set(field.category, id);
					await database.manager.insert(ChannelPropertyEntity, { ...field, id, channel } as never);
				}
				members.push({ device, channel, properties });
			}
			await graph.onApplicationBootstrap();
			const configs = new VirtualProducerConfigService(
				database,
				structure,
				graph,
				events,
				new VirtualProducerStateService(database, producers, graph, events),
			);
			const configuration = Object.assign(new ConfigureVirtualLightGroupDto(), {
				profile,
				expectedRevision: 0,
				members: members.map((member) => ({
					sourceChannelId: member.channel,
					bindings: [...outputs].map(([category, outputPropertyId]) => ({
						outputPropertyId,
						sourcePropertyId: member.properties.get(category),
					})),
				})),
			});
			await configs.configureLightGroup(channelId, configuration);
			let runtime = new VirtualLightGroupStateService(
				database,
				values,
				producers,
				devices as never,
				graph,
				events,
				structure,
			);
			const metadata = new PropertyMetadataService(database);
			const windows = new PropertyCommandWindowService();
			const registry = new CompositePropertyCommandRegistryService();
			const planner = new VirtualLightGroupCommandService(
				database,
				registry,
				devices as never,
				graph,
				metadata,
				values,
				windows,
			);
			planner.onModuleInit();
			const physicalDispatch = jest.fn(async (targets: readonly IDevicePropertyData[], guard: () => boolean) => {
				if (!guard()) return false;
				for (const target of targets) {
					const window = windows.get(target.property.id);
					windows.confirm(
						{ canonicalPropertyId: target.property.id, generation: window.generation },
						{ value: target.value, receivedAt: Date.now() },
					);
				}
				return true;
			});
			const dispatch = new PropertyCommandDispatchService(
				metadata,
				values,
				{} as never,
				devices as never,
				{
					get: () => ({
						prepareCompositeBatch: async (targets: readonly IDevicePropertyData[]) => ({
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
			const report = async (member: number, category: PropertyCategory, value: string | number | boolean) => {
				const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
					where: { id: members[member].properties.get(category) },
					relations: ['channel'],
				});
				await values.writeSampleWithState(property, value, {
					sampledAt: new Date(),
					receivedAt: new Date(),
					provenance: 'live',
					...(profile === VirtualLightGroupProfile.COVER && category === PropertyCategory.STATUS
						? { semanticOrigin: 'native_cover_status' as const }
						: {}),
				});
			};
			const send = async (category = quantity, value: string | number | boolean = 60) => {
				const property = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
					where: { id: outputs.get(category) },
					relations: ['channel', 'channel.device'],
				});
				const channel = property.channel as ChannelEntity;
				return dispatch.dispatchBatch([{ property, channel, device: channel.device as DeviceEntity, value }], {
					ttlMs: 1500,
				});
			};
			try {
				await runtime.refresh();
				expect(producers.read(outputs.get(quantity))?.producer.quality).toBe('unavailable');
				await report(0, quantity, 20);
				await report(1, quantity, 80);
				await runtime.refresh();
				expect(runtime.getReportedState(channelId).properties.get(quantity)).toMatchObject({
					value: null,
					mixed: true,
				});
				await report(1, quantity, 20);
				await runtime.refresh();
				expect(producers.read(outputs.get(quantity))?.value).toBe(20);
				expect((await send()).composite.status).toBe('confirmed');
				if (profile === VirtualLightGroupProfile.FAN) {
					await report(0, PropertyCategory.MODE, 'auto');
					await report(1, PropertyCategory.MODE, 'manual');
					await runtime.refresh();
					expect(runtime.getReportedState(channelId).properties.get(PropertyCategory.MODE)).toMatchObject({
						value: null,
						mixed: true,
					});
					await report(1, PropertyCategory.MODE, 'auto');
					await runtime.refresh();
					expect(producers.read(outputs.get(PropertyCategory.MODE))?.value).toBe('auto');
					expect((await send(PropertyCategory.MODE, 'manual')).composite.status).toBe('confirmed');
					await runtime.refresh();
					expect(producers.read(outputs.get(PropertyCategory.MODE))?.value).toBe('auto');
				}

				await runtime.refresh();
				expect(producers.read(outputs.get(quantity))?.value).toBe(20);
				let late: { canonicalPropertyId: string; generation: string };
				physicalDispatch.mockImplementationOnce(async (targets) => {
					const window = windows.get(targets[0].property.id);
					late = { canonicalPropertyId: targets[0].property.id, generation: window.generation };
					return false;
				});
				const partial = await send();
				expect(partial.composite.status).toBe('partial');
				expect(windows.confirm(late, { value: 60, receivedAt: Date.now() })).toBeNull();
				if (profile === VirtualLightGroupProfile.COVER) {
					await report(0, PropertyCategory.STATUS, 'opening');
					await report(1, PropertyCategory.STATUS, 'closing');
					await report(0, PropertyCategory.OBSTRUCTION, true);
					await report(1, PropertyCategory.OBSTRUCTION, false);
					await runtime.refresh();
					expect(runtime.getReportedState(channelId).properties.get(PropertyCategory.STATUS)).toMatchObject({
						value: null,
						mixed: true,
					});
					expect(runtime.getReportedState(channelId).properties.get(PropertyCategory.OBSTRUCTION)).toMatchObject({
						value: null,
						mixed: true,
					});
					const calls = physicalDispatch.mock.calls.length;
					const stop = await send(PropertyCategory.COMMAND, 'stop');
					expect(stop.composite.children.every((child) => child.status === 'unavailable')).toBe(true);
					expect(physicalDispatch).toHaveBeenCalledTimes(calls);
					await database.manager.update(ChannelPropertyEntity, members[0].properties.get(PropertyCategory.TYPE), {
						format: ['curtain'],
					});
					expect((await send()).composite.status).toBe('partial');
					await runtime.refresh();
					expect(producers.read(outputs.get(quantity))?.producer.quality).toBe('unavailable');
					await database.manager.update(ChannelPropertyEntity, members[0].properties.get(PropertyCategory.TYPE), {
						format: ['blind'],
					});
				}
				offline.add(members[0].device);
				await runtime.refresh();
				expect(runtime.getReportedState(channelId).properties.get(quantity).value).toBeNull();
				expect((await send()).composite.status).toBe('partial');
				offline.clear();
				const parent = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
					where: { id: outputs.get(quantity) },
					relations: ['channel', 'channel.device'],
				});
				const plan = await planner.plan([
					{
						property: parent,
						channel: parent.channel as ChannelEntity,
						device: (parent.channel as ChannelEntity).device as DeviceEntity,
						value: 30,
					},
				]);
				await configs.configureLightGroup(
					channelId,
					Object.assign(new ConfigureVirtualLightGroupDto(), configuration, { expectedRevision: 1 }),
				);
				expect(await plan.isCurrent()).toBe(false);
				await database.manager.delete(ChannelEntity, members[0].channel);
				await runtime.refresh();
				expect(runtime.getReportedState(channelId).properties.get(quantity).value).toBeNull();
				const intended = await configs.getLightGroup(channelId);
				expect(intended.members).toHaveLength(2);
				expect(intended.members.some((member) => member.source_channel === null)).toBe(true);
				runtime.onModuleDestroy();
				producers.onModuleDestroy();
				const freshProducers = new PropertyProducerRegistryService(events);
				const freshValues = new PropertyValueService(
					{ isConnected: () => true, query: async () => [] } as never,
					sources,
					new PropertyValueLockService(database),
					freshProducers,
					events,
				);
				runtime = new VirtualLightGroupStateService(
					database,
					freshValues,
					freshProducers,
					devices as never,
					graph,
					events,
					structure,
				);
				await runtime.refresh();
				expect(runtime.getReportedState(channelId).properties.get(quantity).value).toBeNull();
				freshProducers.onModuleDestroy();
			} finally {
				planner.onModuleDestroy();
				dispatch.onModuleDestroy();
				runtime.onModuleDestroy();
				producers.onModuleDestroy();
				await database.destroy();
			}
		},
	);
});
