/* eslint-disable @typescript-eslint/require-await -- Async storage/provider fixtures implement real interfaces. */
import { EventEmitter } from 'node:events';
import { ShellyPlus2Pm } from 'shellies-ds9';
import { v4 as uuid } from 'uuid';
import WebSocket from 'ws';

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
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { CompositePropertyCommandRegistryService } from '../../../modules/devices/services/composite-property-command.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ConfigureVirtualLightGroupDto } from '../../devices-virtual/dto/producer-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../../devices-virtual/entities/devices-virtual.entity';
import { VirtualLightGroupProfile } from '../../devices-virtual/entities/virtual-producer.entity';
import { VirtualDependencyGraphService } from '../../devices-virtual/services/virtual-dependency-graph.service';
import { VirtualLightGroupCommandService } from '../../devices-virtual/services/virtual-light-group-command.service';
import { VirtualLightGroupStateService } from '../../devices-virtual/services/virtual-light-group-state.service';
import { VirtualProducerConfigService } from '../../devices-virtual/services/virtual-producer-config.service';
import { VirtualProducerStateService } from '../../devices-virtual/services/virtual-producer-state.service';
import { VirtualValueSourceService } from '../../devices-virtual/services/virtual-value-source.service';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { ShellyDeviceDelegate } from '../delegates/shelly-device.delegate';
import { CreateShellyNgChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateShellyNgChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { ShellyCoverOrderingEntity } from '../entities/shelly-cover-ordering.entity';
import { ShellyNgDevicePlatform } from '../platforms/shelly-ng.device.platform';

import { GuardedShellyRpcHandler } from './guarded-shelly-rpc';
import { ShellyCoverOrderingService } from './shelly-cover-ordering.service';

const HOLD = Symbol('no response');
type Frame = { id: number; method: string; params: Record<string, unknown> };
class CoverTransport extends GuardedShellyRpcHandler {
	frames: Frame[] = [];
	state: Record<string, unknown> = { id: 0, state: 'stopped', current_pos: 40, pos_control: true, tag: null };
	actionTag: string | null = null;
	post: (raw: Record<string, unknown>) => unknown = (raw) => raw;
	actionResponse: () => unknown = () => null;
	pre: (raw: Record<string, unknown>) => unknown = (raw) => raw;
	gate: Promise<void> = Promise.resolve();
	protected override createSocket(): WebSocket {
		return Object.assign(new EventEmitter(), {
			readyState: WebSocket.OPEN,
			send: (data: string, callback: () => void) => {
				const frame = JSON.parse(data) as Frame;
				this.frames.push(frame);
				callback();
				let result: unknown;
				if (frame.method === 'Cover.GetStatus')
					result = this.actionTag ? this.post({ ...this.state, tag: this.actionTag }) : this.pre(this.state);
				else {
					this.actionTag = typeof frame.params.tag === 'string' ? frame.params.tag : null;
					this.state = {
						...this.state,
						state: frame.method === 'Cover.Open' ? 'opening' : frame.method === 'Cover.Close' ? 'closing' : 'stopped',
					};
					result = this.actionResponse();
				}
				if (result !== HOLD) queueMicrotask(() => this.answer(frame, result));
			},
		}) as unknown as WebSocket;
	}
	protected override connect(): Promise<void> {
		return this.gate;
	}
	protected override disconnect(): Promise<void> {
		return Promise.resolve();
	}
	socketDisconnectForTest(): void {
		(this.socket as unknown as { readyState: number }).readyState = WebSocket.CLOSED;
		this.emit('disconnect', 1000, 'fixture', null);
	}
	answerError(frame: Frame): void {
		this.client.receive({
			jsonrpc: '2.0',
			id: frame.id,
			error: {
				code: 401,
				message: JSON.stringify({ auth_type: 'digest', algorithm: 'SHA-256', realm: 'fixture', nonce: 1 }),
			},
		});
	}
	answer(frame: Frame, result: unknown): void {
		this.client.receive({ jsonrpc: '2.0', id: frame.id, result });
	}
}
const until = async (condition: () => boolean | Promise<boolean>): Promise<void> => {
	for (let i = 0; i < 400; i++) {
		if (await condition()) return;
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('Fixture did not reach expected transport boundary');
};

jest.setTimeout(30000);
describe('real Shelly cover adapter, SQLite samples and core composite proof', () => {
	let db: SqliteDataSource;
	let metadata: PropertyMetadataService;
	let values: PropertyValueService;
	let producers: PropertyProducerRegistryService;
	let windows: PropertyCommandWindowService;
	let dispatcher: PropertyCommandDispatchService;
	let planner: VirtualLightGroupCommandService;
	let runtime: VirtualLightGroupStateService;
	let configs: VirtualProducerConfigService;
	let group: string;
	let groupCommand: string;
	let groupPosition: string;
	let transports: CoverTransport[];
	let physical: Array<{
		device: ShellyNgDeviceEntity;
		channel: ShellyNgChannelEntity;
		properties: ShellyNgChannelPropertyEntity[];
	}>;
	let manager: DelegatesManagerService;
	let configuration: ConfigureVirtualLightGroupDto;
	let platform: ShellyNgDevicePlatform;
	let guards: PropertyCommandAdmissionRegistryService;
	let sources: PropertyValueSourceRegistryService;
	let events: EventEmitter2;
	let structure: DeviceStructureLockService;
	beforeEach(async () => {
		db = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		events = new EventEmitter2();
		sources = new PropertyValueSourceRegistryService();
		structure = new DeviceStructureLockService();
		const graph = new VirtualDependencyGraphService(db);
		sources.register(new VirtualValueSourceService(graph));
		producers = new PropertyProducerRegistryService(events);
		windows = new PropertyCommandWindowService();
		values = new PropertyValueService(
			{
				isConnected: () => true,
				query: async () => [],
				enqueueWritePoint: () => undefined,
				flushQueuedWrites: async () => undefined,
			} as never,
			sources,
			new PropertyValueLockService(db),
			producers,
			events,
		);
		metadata = new PropertyMetadataService(db);
		const coordinator = new PropertyStateCoordinatorService();
		const mapper = new ChannelsPropertiesTypeMapperService();
		mapper.registerMapping({
			type: 'devices-shelly-ng',
			class: ShellyNgChannelPropertyEntity,
			createDto: CreateShellyNgChannelPropertyDto,
			updateDto: UpdateShellyNgChannelPropertyDto,
		});
		const propertiesService = new ChannelsPropertiesService(
			db.getRepository(ChannelPropertyEntity),
			mapper,
			values,
			sources,
			structure,
			coordinator,
			windows,
			db,
			events,
			undefined,
			metadata,
		);
		const devices = {
			findOne: async (id: string) => {
				const device = await db.manager.findOneBy(DeviceEntity, { id });
				if (device) device.status = { online: true, status: ConnectionState.CONNECTED, lastChanged: null };
				return device;
			},
		};
		const ordering = new ShellyCoverOrderingService(db.getRepository(ShellyCoverOrderingEntity));
		manager = new DelegatesManagerService(
			devices as never,
			{} as never,
			propertiesService,
			{} as never,
			{} as never,
			{} as never,
			{ get: () => null } as never,
			{} as never,
			undefined,
			undefined,
			undefined,
			undefined,
			values,
			ordering,
		);
		Object.assign(manager, {
			channelsService: {
				findAll: async (deviceId: string) =>
					db.manager.find(ShellyNgChannelEntity, { where: { device: { id: deviceId } } }),
			},
		});
		platform = new ShellyNgDevicePlatform(manager);
		const platforms = new PlatformRegistryService();
		platforms.register(platform);
		transports = [];
		physical = [];
		const delegates = new Map<string, ShellyDeviceDelegate>();
		const owners = new Map<string, string>();
		const identifiers = new Map<string, Set<string>>();
		const sampleGenerations = new Map<string, number>();
		const fields = [
			{
				category: PropertyCategory.TYPE,
				identifier: null,
				dataType: DataTypeType.ENUM,
				format: ['blind'],
				step: null,
				permissions: [PermissionType.READ_ONLY],
			},
			{
				category: PropertyCategory.STATUS,
				identifier: 'state',
				dataType: DataTypeType.ENUM,
				format: ['opened', 'closed', 'opening', 'closing', 'stopped'],
				step: null,
				permissions: [PermissionType.READ_ONLY],
			},
			{
				category: PropertyCategory.POSITION,
				identifier: 'current_pos',
				dataType: DataTypeType.UCHAR,
				format: [0, 100],
				step: 1,
				permissions: [PermissionType.READ_WRITE],
			},
			{
				category: PropertyCategory.COMMAND,
				identifier: null,
				dataType: DataTypeType.ENUM,
				format: ['open', 'close', 'stop'],
				step: null,
				permissions: [PermissionType.WRITE_ONLY],
			},
			{
				category: PropertyCategory.OBSTRUCTION,
				identifier: 'obstruction',
				dataType: DataTypeType.BOOL,
				format: null,
				step: null,
				permissions: [PermissionType.READ_ONLY],
			},
		];
		for (let i = 0; i < 2; i++) {
			const deviceId = uuid(),
				channelId = uuid();
			const mac = `AABBCCDDEE0${i}`;
			const rpc = new CoverTransport('fixture.invalid', {
				clientId: 'fixture',
				requestTimeout: 1,
				password: 'fixture-only',
				pingInterval: 0,
				reconnectInterval: 0,
			});
			transports.push(rpc);
			const sdk = new ShellyPlus2Pm(
				{ id: `shellyplus2pm-${mac.toLowerCase()}`, mac, model: ShellyPlus2Pm.model, profile: 'cover' },
				rpc,
			);
			sdk.cover0.update(rpc.state);
			const delegate = new ShellyDeviceDelegate(sdk);
			await db.manager.insert(ShellyNgDeviceEntity, {
				id: deviceId,
				name: 'Physical',
				identifier: sdk.id,
				canonicalMac: mac,
				category: DeviceCategory.WINDOW_COVERING,
			});
			await db.manager.insert(ShellyNgChannelEntity, {
				id: channelId,
				device: deviceId,
				name: 'Cover',
				identifier: 'cover:0',
				category: ChannelCategory.WINDOW_COVERING,
			} as never);
			for (const field of fields)
				await db.manager.insert(ShellyNgChannelPropertyEntity, { ...field, id: uuid(), channel: channelId } as never);
			const channel = await db.manager.findOneOrFail(ShellyNgChannelEntity, {
				where: { id: channelId },
				relations: ['device', 'properties'],
			});
			physical.push({
				device: channel.device as ShellyNgDeviceEntity,
				channel,
				properties: channel.properties as ShellyNgChannelPropertyEntity[],
			});
			delegates.set(sdk.id, delegate);
			owners.set(sdk.id, deviceId);
			identifiers.set(sdk.id, new Set([sdk.id]));
			sampleGenerations.set(sdk.id, 1);
		}
		Object.assign(manager, {
			delegates,
			delegateDeviceIds: owners,
			identifierToDelegates: identifiers,
			sampleGenerations,
		});
		const groupDevice = uuid();
		group = uuid();
		await db.manager.insert(VirtualDeviceEntity, {
			id: groupDevice,
			name: 'Group',
			category: DeviceCategory.WINDOW_COVERING,
			mode: VirtualDeviceMode.ACTUATOR_GROUP,
		});
		await db.manager.insert(VirtualChannelEntity, {
			id: group,
			name: 'Group',
			device: groupDevice,
			category: ChannelCategory.WINDOW_COVERING,
		} as never);
		const outputs = new Map<PropertyCategory, string>();
		for (const field of fields) {
			const id = uuid();
			outputs.set(field.category, id);
			await db.manager.insert(VirtualChannelPropertyEntity, {
				...field,
				id,
				channel: group,
				permissions: [PermissionType.READ_ONLY],
				valueOrigin: VirtualValueOrigin.DERIVED,
			} as never);
		}
		groupCommand = outputs.get(PropertyCategory.COMMAND);
		groupPosition = outputs.get(PropertyCategory.POSITION);
		await graph.onApplicationBootstrap();
		const registry = new CompositePropertyCommandRegistryService();
		guards = new PropertyCommandAdmissionRegistryService();
		planner = new VirtualLightGroupCommandService(db, registry, devices as never, graph, metadata, values, windows);
		planner.onModuleInit();
		runtime = new VirtualLightGroupStateService(db, values, producers, devices as never, graph, events, structure);
		configs = new VirtualProducerConfigService(
			db,
			structure,
			graph,
			events,
			new VirtualProducerStateService(db, producers, graph, events),
			runtime,
			undefined,
			platforms,
		);
		configuration = Object.assign(new ConfigureVirtualLightGroupDto(), {
			profile: VirtualLightGroupProfile.COVER,
			expectedRevision: 0,
			members: physical.map((member) => ({
				sourceChannelId: member.channel.id,
				bindings: fields.map((field) => ({
					outputPropertyId: outputs.get(field.category),
					sourcePropertyId: member.properties.find((property) => property.category === field.category).id,
				})),
			})),
		});
		await configs.configureLightGroup(group, configuration);
		dispatcher = new PropertyCommandDispatchService(
			metadata,
			values,
			{} as never,
			devices as never,
			platforms,
			sources,
			structure,
			coordinator,
			windows,
			undefined,
			registry,
			events,
			guards,
		);

		for (let i = 0; i < physical.length; i++) {
			const delegate = manager.get(physical[i].device.identifier);
			await (
				manager as unknown as {
					bindSampleSources(delegate: ShellyDeviceDelegate, device: ShellyNgDeviceEntity): Promise<void>;
				}
			).bindSampleSources(delegate, physical[i].device);
			emitRaw(i, { ...transports[i].state });
			await until(
				() => values.readQualifiedSample(property(i, PropertyCategory.STATUS), 300000)?.nativeCoverTagPresent === true,
			);
		}
	});
	const emitRaw = (i: number, raw: Record<string, unknown>) => {
		transports[i].emit('statusUpdate', { 'cover:0': raw, ts: Date.now() / 1000 });
	};
	afterEach(async () => {
		dispatcher?.onModuleDestroy();
		planner?.onModuleDestroy();
		runtime?.onModuleDestroy();
		producers?.onModuleDestroy();
		metadata?.onModuleDestroy();
		for (const rpc of transports ?? []) await rpc.destroy();
		if (db?.isInitialized) await db.destroy();
	});
	const send = async (value: string | number = 'open', id = groupCommand, ttlMs = 1500) => {
		const property = await metadata.findOne(id);
		const channel = property.channel as ChannelEntity;
		return dispatcher.dispatchBatch([{ property, channel, device: channel.device as DeviceEntity, value }], { ttlMs });
	};
	const property = (index: number, category: PropertyCategory) =>
		physical[index].properties.find((property) => property.category === category);

	it('confirms tagged motion begun through real RPC, sample admission and composite windows without inventing endpoint state', async () => {
		const result = await send();
		expect(result.composite.status).toBe('confirmed');
		expect(result.composite.children.every((child) => child.reason === 'cover_action_begun')).toBe(true);
		for (const rpc of transports) {
			expect(rpc.frames.map((frame) => frame.method)).toEqual(['Cover.GetStatus', 'Cover.Open', 'Cover.GetStatus']);
			expect(rpc.frames[1].params.tag).toHaveLength(20);
		}
		await runtime.refresh();
		expect(runtime.getReportedState(group).properties.get(PropertyCategory.STATUS).value).toBe('opening');
		expect(producers.read(groupPosition)?.value).toBe(40);
		const type = runtime.getReportedModel(group).properties.find((field) => field.category === PropertyCategory.TYPE);
		expect(type).toMatchObject({ value: 'blind', provenance: 'configured' });
		expect(values.readQualifiedSample(property(0, PropertyCategory.TYPE), 300000)).toBeNull();
		expect(values.readQualifiedSample(property(0, PropertyCategory.COMMAND), 300000)).toBeNull();
		expect(await db.manager.count(ShellyCoverOrderingEntity)).toBe(0);
	});
	it.each(['open', 'close', 'stop'])(
		'confirms explicit terminal/no-op %s from a fresh distinct status request',
		async (action) => {
			for (const rpc of transports) {
				rpc.state = {
					...rpc.state,
					state: action === 'open' ? 'open' : action === 'close' ? 'closed' : 'stopped',
					current_pos: action === 'open' ? 100 : action === 'close' ? 0 : 40,
				};
				rpc.post = (raw) => ({
					...raw,
					state: action === 'open' ? 'open' : action === 'close' ? 'closed' : 'stopped',
					tag: 'old-noop-tag',
				});
			}
			expect((await send(action)).composite.status).toBe('confirmed');
		},
	);
	it.each([
		['wrong tag', { tag: 'wrong' }],
		['missing tag', { tag: undefined }],
		['wrong direction', { state: 'closing' }],
		['calibrating', { state: 'calibrating' }],
		['unknown state', { state: 'unknown' }],
		['null position', { current_pos: null }],
		['out-of-range position', { current_pos: 101 }],
		['uncalibrated', { pos_control: false }],
		['obstruction', { errors: ['obstruction'] }],
	] as const)('does not confirm %s while retaining other member success', async (_name, override) => {
		// End via the bounded read timeout, leaving parent-finalization budget under host load.
		// Dedicated ACK/deadline cases separately exercise absolute composite expiration.
		let observed = false;
		transports[0].post = (raw) => {
			if (observed) return HOLD;
			observed = true;
			return { ...raw, ...override };
		};
		const result = await send('open', groupCommand, 3000);
		if (result.composite?.status !== 'partial')
			throw new Error(`Unexpected member outcomes: ${JSON.stringify(result)}`);
		expect(result.composite.status).toBe('partial');
		if (
			[
				'null position',
				'out-of-range position',
				'uncalibrated',
				'obstruction',
				'calibrating',
				'unknown state',
				'missing tag',
			].includes(_name)
		)
			expect(values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000)).toBeNull();

		expect(result.composite.children.filter((child) => child.status === 'confirmed')).toHaveLength(1);
	});

	it('qualifies ordinary complete raw cover reports and immediately invalidates missing/uncalibrated position without clamping', async () => {
		const emit = (raw: Record<string, unknown>) => emitRaw(0, raw);
		emit({ id: 0, state: 'stopped', current_pos: 42, pos_control: true, tag: null });
		await until(() => values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000)?.value === 42);
		emit({ id: 0, state: 'stopped', pos_control: false, tag: null });
		await until(() => values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000) === null);
		const readiness = await platform.getCommandReadiness({
			...physical[0],
			property: property(0, PropertyCategory.COMMAND),
			value: 'open',
		});
		expect(readiness).toMatchObject({ commandable: false, reasons: ['position_unavailable_uncalibrated'] });
	});

	it('does not report a generic imperative STOP echo as native physical stopped state', async () => {
		for (let i = 0; i < 2; i++) {
			const now = new Date();
			await values.writeSampleWithState(property(i, PropertyCategory.STATUS), 'stopped', {
				sampledAt: now,
				receivedAt: now,
				observedAt: now,
				provenance: 'live',
			});
		}
		await runtime.refresh();
		expect(runtime.getReportedState(group).properties.get(PropertyCategory.STATUS).value).toBeNull();
	});
	it('refuses firmware without factual native tag support while retaining actual observations', async () => {
		const raw = { ...transports[0].state };
		delete raw.tag;
		emitRaw(0, raw);
		await until(
			() => values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000)?.nativeCoverTagPresent === false,
		);
		const readiness = await platform.getCommandReadiness({
			...physical[0],
			property: property(0, PropertyCategory.COMMAND),
			value: 'open',
		});
		expect(readiness.commandable).toBe(false);
		const result = await send('open', groupCommand, 1500);
		expect(result.composite.status).not.toBe('confirmed');
		expect(transports[0].frames).toHaveLength(0);
	});
	it('cannot borrow a newer unrelated same-value sample to qualify an old readback', async () => {
		transports[0].post = () => HOLD;
		const pending = send('open', groupCommand, 600);
		await until(() => transports[0].frames.length >= 3);
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
		emitRaw(0, { id: 0, state: 'opening', current_pos: 40, pos_control: true, tag: 'external' });
		await until(() => values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000)?.value === 'opening');
		transports[0].answer(transports[0].frames[2], {
			id: 0,
			state: 'opening',
			current_pos: 40,
			pos_control: true,
			tag: transports[0].actionTag,
		});
		const result = await pending;
		expect(result.composite.status).toBe('partial');
		expect(result.composite.children.filter((child) => child.status === 'confirmed')).toHaveLength(1);
	});
	it.each([{ current_pos: 55 }, { apower: 12 }, { state: 'opening' }])(
		'refreshes native telemetry delta %j using a distinct full read without cached-field synthesis',
		async (delta) => {
			transports[0].state = { ...transports[0].state, current_pos: 55, state: 'opening' };
			const before = values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000).acceptanceGeneration;
			emitRaw(0, delta);
			await until(() => values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000)?.value === 55);
			expect(values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000).value).toBe('opening');
			expect(
				values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000).acceptanceGeneration,
			).toBeGreaterThan(before);
			expect(transports[0].frames.map((frame) => frame.method)).toEqual(['Cover.GetStatus']);
			expect(values.readQualifiedSample(property(0, PropertyCategory.COMMAND), 300000)).toBeNull();
		},
	);
	it('discards an in-flight refresh overtaken by a delta and coalesces one newer full read', async () => {
		transports[0].pre = () => HOLD;
		emitRaw(0, { current_pos: 50 });
		await until(() => transports[0].frames.length === 1);
		emitRaw(0, { current_pos: 60 });
		transports[0].state.current_pos = 60;
		transports[0].pre = (raw) => raw;
		transports[0].answer(transports[0].frames[0], { ...transports[0].state, current_pos: 50 });
		await until(() => values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000)?.value === 60);
		expect(transports[0].frames).toHaveLength(2);
	});
	it('coalesces normal delta bursts and invalidates on failed full refresh without minting command proof', async () => {
		transports[0].state.current_pos = 55;
		emitRaw(0, { apower: 1 });
		await until(() => values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000)?.value === 55);
		const original = values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000);
		transports[0].pre = () => HOLD;
		emitRaw(0, { apower: 1 });
		emitRaw(0, { current_pos: 41 });
		emitRaw(0, { state: 'opening' });
		await until(() => transports[0].frames.length === 2);
		expect(values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000)).toMatchObject({
			value: 55,
			acceptanceGeneration: original.acceptanceGeneration,
			sampledAt: original.sampledAt,
		});
		await until(() => values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000) === null);
		expect(values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000)).toBeNull();
		expect(transports[0].frames).toHaveLength(2);
	});
	it.each(['disconnect', 'remap', 'newer full fault'])('fences a pending normal refresh across %s', async (change) => {
		transports[0].pre = () => HOLD;
		emitRaw(0, { current_pos: 55 });
		await until(() => transports[0].frames.length === 1);
		if (change === 'disconnect') transports[0].socketDisconnectForTest();
		else if (change === 'remap') manager.get(physical[0].device.identifier).setSampleComponentKeys([]);
		else {
			emitRaw(0, { id: 0, state: 'stopped', current_pos: null, pos_control: false, errors: ['obstruction'] });
			await until(() => values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000) === null);
		}
		transports[0].answer(transports[0].frames[0], {
			id: 0,
			state: 'opening',
			current_pos: 55,
			pos_control: true,
			tag: 'external',
		});
		await new Promise<void>((resolve) => setTimeout(resolve, 20));
		expect(values.readQualifiedSample(property(0, PropertyCategory.POSITION), 300000)?.value).not.toBe(55);
	});
	it('normal refreshed status with an action tag cannot confirm an ACK-only command readback', async () => {
		transports[0].post = () => HOLD;
		const pending = send('open', groupCommand, 700);
		await until(() => transports[0].frames.length >= 3);
		emitRaw(0, { apower: 12 });
		await until(() => transports[0].frames.length >= 4);
		transports[0].answer(transports[0].frames[3], {
			id: 0,
			state: 'opening',
			current_pos: 40,
			pos_control: true,
			tag: transports[0].actionTag,
		});
		await until(() => values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000)?.value === 'opening');
		expect(windows.get(property(0, PropertyCategory.COMMAND).id)?.state).toBe('pending');
		expect((await pending).composite.status).toBe('partial');
	});
	it('ACK-only stays pending, times out and cannot be repaired by a late readback', async () => {
		transports[0].post = () => HOLD;
		const pending = send('open', groupCommand, 400);
		await until(() => transports[0].frames.length >= 3);
		expect(windows.get(property(0, PropertyCategory.COMMAND).id)?.state).toBe('pending');
		const result = await pending;
		expect(result.composite.status).toBe('partial');
		transports[0].answer(transports[0].frames[2], { ...transports[0].state, tag: transports[0].actionTag });
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
		expect(result.composite.children.filter((child) => child.status === 'confirmed')).toHaveLength(1);
	});

	it('does not admit a pre-action/status replay while the action RPC response is pending', async () => {
		const initial = values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000).acceptanceGeneration;
		transports[0].actionResponse = () => HOLD;
		const pending = send('open', groupCommand, 1500);
		await until(() => transports[0].frames.length >= 2);
		transports[0].answer(transports[0].frames[0], { ...transports[0].state, tag: transports[0].actionTag });
		expect(windows.get(property(0, PropertyCategory.COMMAND).id)?.state).toBe('pending');
		expect(values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000).acceptanceGeneration).toBe(initial);
		transports[0].answer(transports[0].frames[1], null);
		expect((await pending).composite.status).toBe('confirmed');
	});
	it('direct STOP supersedes the pending group OPEN readback and a late old reply cannot revive it', async () => {
		transports[0].post = () => HOLD;
		const old = send('open', groupCommand, 700);
		await until(() => transports[0].frames.length >= 3);
		const oldRead = transports[0].frames[2];
		const oldTag = transports[0].actionTag;
		transports[0].post = (raw) => raw;
		const stopped = await send('stop', property(0, PropertyCategory.COMMAND).id);
		expect(stopped.composite.status).toBe('confirmed');
		expect(transports[0].actionTag).not.toBe(oldTag);
		const superseded = await old;
		expect(superseded.success).toBe(false);
		transports[0].answer(oldRead, { id: 0, state: 'opening', current_pos: 40, pos_control: true, tag: oldTag });
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
		expect(superseded.composite.children.some((child) => child.status === 'superseded')).toBe(true);
		expect(values.readQualifiedSample(property(0, PropertyCategory.STATUS), 300000)?.value).toBe('stopped');
	});
	it('releases only proven unsent action ordering after a queued-send guard rejection, including a new session', async () => {
		let release: () => void;
		transports[0].pre = (raw) => {
			transports[0].gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			return raw;
		};
		const old = send('open', groupCommand, 5000);
		await until(
			async () => (await db.manager.count(ShellyCoverOrderingEntity)) === 1 && transports[1].frames.length >= 3,
		);
		await send(60, property(0, PropertyCategory.POSITION).id);
		release();
		expect((await old).success).toBe(false);
		await until(async () => (await db.manager.count(ShellyCoverOrderingEntity)) === 0);
		expect(transports[0].frames.some((frame) => frame.method === 'Cover.Open')).toBe(false);
		transports[0].pre = (raw) => raw;
		expect((await send('open', property(0, PropertyCategory.COMMAND).id)).success).toBe(true);
		// Drop the cached session and recreate journal access, as after process restart.
		(
			manager.get(physical[0].device.identifier) as unknown as { coverSessions: Map<number, unknown> }
		).coverSessions.clear();
		Object.assign(manager, {
			coverOrdering: new ShellyCoverOrderingService(db.getRepository(ShellyCoverOrderingEntity)),
		});
		expect((await send('stop', property(0, PropertyCategory.COMMAND).id)).success).toBe(true);
	});

	it('retires a timed-out never-sent reservation and fences a later connect release', async () => {
		let release: () => void;
		transports[0].pre = (raw) => {
			transports[0].gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			return raw;
		};
		const old = send('open', groupCommand, 5000);
		await until(
			async () => (await db.manager.count(ShellyCoverOrderingEntity)) === 1 && transports[1].frames.length >= 3,
		);
		expect((await old).success).toBe(false);
		await until(async () => (await db.manager.count(ShellyCoverOrderingEntity)) === 0);
		release();
		await new Promise<void>((resolve) => setTimeout(resolve, 20));
		expect(transports[0].frames.some((frame) => frame.method === 'Cover.Open')).toBe(false);
		transports[0].pre = (raw) => raw;
		expect((await send('stop', property(0, PropertyCategory.COMMAND).id)).success).toBe(true);
	});
	it('does not resend an expired/superseded cover action during SDK digest authentication retry', async () => {
		transports[0].actionResponse = () => HOLD;
		const old = send('open', groupCommand, 1500);
		await until(() => transports[0].frames.length >= 2);
		await send(60, property(0, PropertyCategory.POSITION).id);
		transports[0].answerError(transports[0].frames[1]);
		expect((await old).success).toBe(false);
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
		expect(transports[0].frames.filter((frame) => frame.method === 'Cover.Open')).toHaveLength(1);
		expect(await db.manager.count(ShellyCoverOrderingEntity)).toBe(1);
		expect(
			await new ShellyCoverOrderingService(db.getRepository(ShellyCoverOrderingEntity)).blocked(
				`${physical[0].device.canonicalMac}|cover:0`,
			),
		).toBe(true);
	});
	it('checks sibling effect ownership at admission and while accepting a proof', async () => {
		let allowed = true;
		const effectId = property(0, PropertyCategory.POSITION).id;
		guards.register({
			capture: () => ({
				isEffectCurrent: (effect) => effect.property.id !== effectId || allowed,
				assertEffectAllowed: async (effect) => {
					if (effect.property.id === effectId && !allowed) throw new Error('Effect reserved');
				},
				isCurrent: (update) => !update || update.property.id !== effectId || allowed,
				assertAllowed: async (update) => {
					if (update.property.id === effectId && !allowed) throw new Error('Effect reserved');
				},
			}),
			assertAllowed: async () => undefined,
		});
		transports[0].post = () => HOLD;
		const old = send('open', groupCommand, 1500);
		await until(() => transports[0].frames.length >= 3);
		allowed = false;
		transports[0].answer(transports[0].frames[2], { ...transports[0].state, tag: transports[0].actionTag });
		expect((await old).success).toBe(false);
	});
	it('a late matched action response establishes ordering only and never repairs the old command result', async () => {
		transports[0].actionResponse = () => HOLD;
		const result = await send('open', groupCommand, 400);
		expect(result.composite.status).toBe('partial');
		const action = transports[0].frames.find((frame) => frame.method === 'Cover.Open');
		transports[0].answer(action, null);
		await until(async () => (await db.manager.count(ShellyCoverOrderingEntity)) === 0);
		transports[0].actionResponse = () => null;
		expect((await send('stop', property(0, PropertyCategory.COMMAND).id)).success).toBe(true);
		expect(result.composite.status).toBe('partial');
	});
	it.each([
		PropertyCategory.TYPE,
		PropertyCategory.STATUS,
		PropertyCategory.POSITION,
		PropertyCategory.COMMAND,
		PropertyCategory.OBSTRUCTION,
	])('excludes the whole member after declared %s metadata disappears', async (category) => {
		await db.manager.delete(ShellyNgChannelPropertyEntity, property(0, category).id);
		const result = await send();
		expect(result.composite.status).toBe('partial');
		expect(transports[0].frames).toHaveLength(0);
		await runtime.refresh();
		expect(runtime.getReportedState(group).properties.get(PropertyCategory.POSITION).value).toBeNull();
		const config = await configs.getLightGroup(group);
		expect(
			config.operations
				.find((operation) => operation.operation === 'open')
				.members.some((member) => !member.commandable && member.reasons.length > 0),
		).toBe(true);
	});
	it('exposes per-operation readiness, preserving observation-only configuration and static TYPE provenance', async () => {
		const ready = await configs.getLightGroup(group);
		expect(
			ready.operations.filter((operation) => operation.commandable).map((operation) => operation.operation),
		).toEqual(['open', 'close', 'stop']);
		await db.manager.update(ShellyNgChannelPropertyEntity, property(0, PropertyCategory.TYPE).id, {
			format: ['blind', 'curtain'],
		});
		const unconfigured = await configs.getLightGroup(group);
		expect(unconfigured.operations.every((operation) => !operation.commandable)).toBe(true);
		expect(transports.every((rpc) => rpc.frames.length === 0)).toBe(true);
	});
	it('shutdown revokes pending observation authority, stops polling and never replays', async () => {
		transports[0].post = () => HOLD;
		const pending = send('open', groupCommand, 700);
		await until(() => transports[0].frames.length >= 3);
		dispatcher.onModuleDestroy();
		const result = await pending;
		expect(result.success).toBe(false);
		const count = transports[0].frames.length;
		transports[0].answer(transports[0].frames[2], { ...transports[0].state, tag: transports[0].actionTag });
		await new Promise<void>((resolve) => setTimeout(resolve, 80));
		expect(transports[0].frames).toHaveLength(count);
		expect(new PropertyCommandWindowService().get(property(0, PropertyCategory.COMMAND).id)).toBeNull();
	});
	it('STOP needs explicit nonmoving feedback; unchanged position while moving is not proof', async () => {
		transports[0].state.state = 'opening';
		transports[0].post = (raw) => ({ ...raw, state: 'opening' });
		expect((await send('stop', groupCommand, 500)).composite.status).toBe('partial');
	});
	it('direct POSITION supersedes a group COMMAND across the motor scope and is explicitly unavailable', async () => {
		transports[0].post = () => HOLD;
		const pending = send('open', groupCommand, 1500);
		await until(() => transports[0].frames.length >= 3);
		const direct = await send(60, property(0, PropertyCategory.POSITION).id);
		expect(direct.success).toBe(false);
		expect((await pending).composite.children.some((child) => child.status === 'superseded')).toBe(true);
		expect(transports[0].frames.some((frame) => frame.method === 'Cover.GoToPosition')).toBe(false);
	});
	it('blocks a new STOP after an earlier sent action response becomes uncertain, including restart of the ordering service', async () => {
		transports[0].actionResponse = () => HOLD;
		const pending = send('open', groupCommand, 400);
		await until(() => transports[0].frames.some((frame) => frame.method === 'Cover.Open'));
		expect((await pending).composite.status).toBe('partial');
		const ledger = new ShellyCoverOrderingService(db.getRepository(ShellyCoverOrderingEntity));
		expect(await ledger.blocked(`${physical[0].device.canonicalMac}|cover:0`)).toBe(true);
		const before = transports[0].frames.length;
		const stop = await send('stop');
		expect(stop.composite.status).toBe('partial');
		expect(transports[0].frames).toHaveLength(before);
	});
	it.each(['metadata', 'configuration', 'deletion', 'disconnect'] as const)(
		'fences %s while readback is pending',
		async (change) => {
			transports[0].post = () => HOLD;
			const pending = send('open', groupCommand, 1500);
			await until(() => transports[0].frames.length >= 3);
			if (change === 'metadata')
				await db.manager.update(ShellyNgChannelPropertyEntity, property(0, PropertyCategory.STATUS).id, {
					format: ['stopped'],
				});
			if (change === 'configuration')
				await configs.configureLightGroup(
					group,
					Object.assign(new ConfigureVirtualLightGroupDto(), configuration, { expectedRevision: 1 }),
				);
			if (change === 'deletion') await db.manager.delete(ShellyNgChannelEntity, physical[0].channel.id);
			if (change === 'disconnect') transports[0].socketDisconnectForTest();
			transports[0].answer(transports[0].frames[2], { ...transports[0].state, tag: transports[0].actionTag });
			expect((await pending).success).toBe(false);
		},
	);
});
