/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-enum-comparison, @typescript-eslint/no-unnecessary-type-assertion */
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

import { Logger } from '@nestjs/common';

import { ChannelCategory, ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';
import { ProtectAdoptDeviceDto } from '../dto/protect-adoption.dto';
import {
	ProtectConsoleUnavailableError,
	ProtectDeviceNotFoundError,
	ProtectUnsupportedDeviceError,
} from '../errors/protect-adoption.error';
import { ProtectMappedChannel, ProtectMappedDevice, evaluateProtectMapping } from '../mappings/mapping-evaluator';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';
import { ProtectAdoptionStatus } from '../models/protect-adoption.model';

import { ProtectAdoptionLockService } from './protect-adoption-lock.service';
import { ProtectAdoptionStreamsService } from './protect-adoption-streams.service';
import { ProtectAdoptionService } from './protect-adoption.service';
import { ProtectMappingPreviewService } from './protect-mapping-preview.service';
import { ProtectStreamAvailabilityStore } from './protect-stream-availability.store';
import { ProtectSynchronizerService } from './protect-synchronizer.service';

type Raw = Record<string, any>;

interface Device {
	id: string;
	identifier: string;
	name: string;
	category: string;
	type: string;
	protectNvrId: string | null;
	protectDeviceId: string | null;
	protectModelKey: string | null;
}

interface Channel {
	id: string;
	deviceId: string;
	identifier: string;
	name: string;
	category: string;
	type: string;
}

interface Property {
	id: string;
	channelId: string;
	identifier: string;
	name: string;
	category: string;
	type: string;
	permissions: string[];
	dataType: string;
	format: unknown[] | null;
	invalid: unknown;
	step: number | null;
	protectMappingName: string | null;
}

const FIXTURES = join(__dirname, '..', '__fixtures__');
const cameras = JSON.parse(readFileSync(join(FIXTURES, 'cameras.json'), 'utf8')) as Raw[];
const NVR = { id: '68b3ace392bf98c9fb76f70c', macKey: '0cea14003a69' };
const IDENTIFIER = '0cea14003a69:600cefafd5f365d6f83c4ef3';
const MESSAGES = [
	'The UniFi Protect console is not connected',
	'The device was not found on the UniFi Protect console',
	'The device has no supported mapping',
	'The device mapping does not satisfy the device specification',
	'The device could not be saved; no change was kept',
	'The device could not be saved and some changes could not be undone',
];

const ENABLING = Object.assign(new ProtectAdoptDeviceDto(), {
	deviceId: '600cefafd5f365d6f83c4ef3',
	modelKey: 'camera',
}) as ProtectAdoptDeviceDto;

/** Structure tests opt out of stream work; the stream tests use ENABLING. */
const SELECTION = Object.assign(new ProtectAdoptDeviceDto(), {
	...ENABLING,
	stream: { enabled: false },
}) as ProtectAdoptDeviceDto;

/** In-memory stand-ins for the device services; `calls` records every mutation in order. */
class Fakes {
	devices: Device[] = [];
	channels: Channel[] = [];
	properties: Property[] = [];
	values = new Map<string, { value: unknown }>();
	calls: { op: string; arg?: any; options?: any }[] = [];
	failCreate = false;
	onCreate: ((dto: any) => void) | null = null;
	failChannelCreateAt: number | null = null;
	failChannelRemove = false;
	failValueFor = new Set<string>();
	channelCreates = 0;
	connectionResult = true;

	count = (op: string): number => this.calls.filter((call) => call.op === op).length;
	ops = (): string[] => this.calls.map((call) => call.op);

	addDevice(device: Device): void {
		this.devices.push(device);
	}

	addChannel(deviceId: string, dto: any): Channel {
		const channel: Channel = {
			id: dto.id,
			deviceId,
			identifier: dto.identifier,
			name: dto.name,
			category: dto.category,
			type: dto.type,
		};

		this.channels.push(channel);

		for (const property of dto.properties ?? []) {
			this.addProperty(channel.id, property);
		}

		return channel;
	}

	addProperty(channelId: string, dto: any): Property {
		const property: Property = {
			id: dto.id,
			channelId,
			identifier: dto.identifier,
			name: dto.name,
			category: dto.category,
			type: dto.type,
			permissions: dto.permissions,
			dataType: dto.data_type,
			format: dto.format ?? null,
			invalid: dto.invalid ?? null,
			step: dto.step ?? null,
			protectMappingName: dto.protectMappingName ?? null,
		};

		this.properties.push(property);

		return property;
	}

	devicesService = {
		findOneBy: jest.fn((_column: string, value: string) =>
			Promise.resolve(this.devices.find((device) => device.identifier === value) ?? null),
		),
		findOne: jest.fn((id: string) => Promise.resolve(this.devices.find((device) => device.id === id) ?? null)),
		create: jest.fn(async (dto: any) => {
			this.calls.push({ op: 'device.create', arg: dto });
			await new Promise((resolve) => setImmediate(resolve));
			this.onCreate?.(dto);

			if (this.failCreate) {
				throw new Error('insert failed');
			}

			this.addDevice({
				id: dto.id,
				identifier: dto.identifier,
				name: dto.name,
				category: dto.category,
				type: dto.type,
				protectNvrId: dto.protectNvrId,
				protectDeviceId: dto.protectDeviceId,
				protectModelKey: dto.protectModelKey,
			});

			for (const channel of dto.channels) {
				this.addChannel(dto.id, channel);
			}

			return dto;
		}),
		update: jest.fn((id: string, dto: any) => {
			this.calls.push({ op: 'device.update', arg: dto });
			Object.assign(this.devices.find((device) => device.id === id)!, {
				name: dto.name,
				category: dto.category,
				identifier: dto.identifier,
			});

			return Promise.resolve();
		}),
	};

	channelsService = {
		findAll: jest.fn((deviceId: string) =>
			Promise.resolve(this.channels.filter((channel) => channel.deviceId === deviceId)),
		),
		findOneBy: jest.fn((_column: string, value: string, deviceId: string) =>
			Promise.resolve(
				this.channels.find((channel) => channel.deviceId === deviceId && channel.identifier === value) ?? null,
			),
		),
		findOne: jest.fn((id: string) => Promise.resolve(this.channels.find((channel) => channel.id === id) ?? null)),
		create: jest.fn((dto: any) => {
			this.calls.push({ op: 'channel.create', arg: dto });
			this.channelCreates += 1;

			if (this.failChannelCreateAt === this.channelCreates) {
				return Promise.reject(new Error('channel create failed'));
			}

			return Promise.resolve(this.addChannel(dto.device, dto));
		}),
		update: jest.fn((id: string, dto: any) => {
			this.calls.push({ op: 'channel.update', arg: dto });

			return Promise.resolve(Object.assign(this.channels.find((channel) => channel.id === id)!, dto));
		}),
		remove: jest.fn((id: string) => {
			this.calls.push({ op: 'channel.remove', arg: id });

			if (this.failChannelRemove) {
				return Promise.reject(new Error('remove failed'));
			}

			this.properties = this.properties.filter((property) => property.channelId !== id);
			this.channels = this.channels.filter((channel) => channel.id !== id);

			return Promise.resolve();
		}),
	};

	propertiesService = {
		findAll: jest.fn((channelId: string) =>
			Promise.resolve(this.properties.filter((property) => property.channelId === channelId)),
		),
		findOne: jest.fn((id: string) => Promise.resolve(this.properties.find((property) => property.id === id) ?? null)),
		create: jest.fn((channelId: string, dto: any) => {
			this.calls.push({ op: 'property.create', arg: dto });

			return Promise.resolve(this.addProperty(channelId, dto));
		}),
		update: jest.fn((id: string, dto: any, options?: any) => {
			if ('value' in dto) {
				this.calls.push({ op: 'property.value', arg: { id, ...dto }, options });

				if (this.failValueFor.has(id)) {
					return Promise.reject(new Error('value failed'));
				}

				if (
					options?.comparePersistedValue &&
					(options.expectedPersistedState?.value ?? null) !== (this.values.get(id)?.value ?? null)
				) {
					return Promise.reject(new Error('stale'));
				}

				this.values.set(id, { value: dto.value });

				return Promise.resolve();
			}

			this.calls.push({ op: 'property.meta', arg: { id, ...dto } });
			const property = this.properties.find((candidate) => candidate.id === id)!;

			Object.assign(property, {
				identifier: dto.identifier,
				name: dto.name,
				permissions: dto.permissions,
				dataType: dto.data_type,
				format: dto.format,
				invalid: dto.invalid,
				step: dto.step,
			});

			return Promise.resolve(property);
		}),
		remove: jest.fn((id: string) => {
			this.calls.push({ op: 'property.remove', arg: id });
			this.properties = this.properties.filter((property) => property.id !== id);

			return Promise.resolve();
		}),
	};

	propertyValueService = {
		readLatestPersisted: jest.fn((property: Property) => Promise.resolve(this.values.get(property.id) ?? null)),
	};

	connectivity = {
		trySetConnectionState: jest.fn((deviceId: string, state: unknown) => {
			this.calls.push({ op: 'connectivity', arg: { deviceId, state } });

			return Promise.resolve(this.connectionResult);
		}),
	};

	/** Writes the mapped hierarchy into the store as an existing adopted device, values included. */
	seed(mapped: ProtectMappedDevice, options: { values?: boolean; name?: string } = {}): Device {
		const device: Device = {
			id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			identifier: mapped.identifier,
			name: options.name ?? mapped.name,
			category: mapped.category,
			type: DEVICES_UNIFI_PROTECT_TYPE,
			protectNvrId: mapped.protectNvrId,
			protectDeviceId: mapped.protectDeviceId,
			protectModelKey: mapped.protectModelKey,
		};
		let index = 0;

		this.addDevice(device);

		for (const channel of mapped.channels) {
			index += 1;
			const stored = this.addChannel(device.id, {
				id: `c-${index}`,
				type: DEVICES_UNIFI_PROTECT_TYPE,
				identifier: channel.identifier,
				name: channel.name,
				category: channel.category,
			});

			for (const property of channel.properties) {
				index += 1;
				const row = this.addProperty(stored.id, {
					id: `p-${index}`,
					type: DEVICES_UNIFI_PROTECT_TYPE,
					identifier: property.identifier,
					name: property.name,
					category: property.category,
					permissions: [...property.permissions],
					data_type: property.dataType,
					format: property.format,
					step: property.step,
					invalid: null,
					protectMappingName: property.mappingName,
				});

				if (options.values !== false && property.value !== null) {
					this.values.set(row.id, { value: property.value });
				}
			}
		}

		return device;
	}

	propertyId(channel: string, identifier: string): string {
		const channelRow = this.channels.find((candidate) => candidate.identifier === channel)!;

		return this.properties.find(
			(property) => property.channelId === channelRow.id && property.identifier === identifier,
		)!.id;
	}
}

describe('ProtectAdoptionService', () => {
	let fakes: Fakes;
	let loader: ProtectMappingLoaderService;
	let preview: { prepare: jest.Mock; toStatusValue: jest.Mock };
	let client: { getRtspsStreams: jest.Mock; createRtspsStreams: jest.Mock };
	let config: { getPluginConfig: jest.Mock };
	let logged: unknown[][];
	let service: ProtectAdoptionService;
	let streamStore: ProtectStreamAvailabilityStore;
	let synchronizer: { refreshDevice: jest.Mock };
	let mapped: ProtectMappedDevice;
	let rawCamera: Raw;
	let contextRun: jest.SpyInstance;

	const map = (raw: Raw): ProtectMappedDevice => {
		const result = evaluateProtectMapping(loader.getMappings(), {
			nvr: NVR,
			modelKey: 'camera',
			device: raw,
			streams: null,
		});

		if (!result.ok) {
			throw new Error('unmappable');
		}

		return result.device;
	};

	const prepared = (device: ProtectMappedDevice, readyToAdopt = true) => ({
		fresh: { client, identity: { nvrId: 'nvr', nvrMacKey: 'mac' }, entry: { raw: rawCamera } },
		device,
		streams: { high: true, medium: false, low: false, package: false },
		streamsObservedAt: 1_000,
		warnings: [],
		readyToAdopt,
	});

	const url = (quality: string) => `rtsps://192.168.1.1:7441/SENTINELALIAS${quality}?enableSrtp`;
	const urls = (...enabled: string[]) =>
		Object.fromEntries(['high', 'medium', 'low', 'package'].map((q) => [q, enabled.includes(q) ? url(q) : null]));

	const channel = (identifier: string): ProtectMappedChannel =>
		mapped.channels.find((candidate) => candidate.identifier === identifier)!;

	const withChannels = (channels: ProtectMappedChannel[]): ProtectMappedDevice => ({ ...mapped, channels });

	const clone = (source: ProtectMappedChannel, identifier: string, name: string): ProtectMappedChannel => ({
		...structuredClone(source),
		identifier,
		name,
	});

	beforeEach(() => {
		contextRun = jest.spyOn(DeviceCreationContext, 'run').mockImplementation((async (
			writer: any,
			_type: string,
			operation: any,
			after: any,
		) => {
			const result = await writer((manager: unknown) => operation({ manager }));

			await after(result);

			return result;
		}) as never);

		loader = new ProtectMappingLoaderService();
		loader.onModuleInit();
		mapped = map(cameras[0]);
		fakes = new Fakes();
		rawCamera = cameras[0];
		logged = [];

		for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args);
			});
		}

		client = {
			getRtspsStreams: jest.fn(() => Promise.resolve(urls())),
			createRtspsStreams: jest.fn((_id: string, qualities: string[]) => Promise.resolve(urls(...qualities))),
		};
		config = { getPluginConfig: jest.fn(() => ({ defaultStreamQuality: 'medium' })) };
		preview = {
			prepare: jest.fn(() => Promise.resolve(prepared(mapped))),
			toStatusValue: jest.fn((_prepared: unknown, availability: unknown) => {
				const result = evaluateProtectMapping(loader.getMappings(), {
					nvr: NVR,
					modelKey: 'camera',
					device: rawCamera,
					streams: availability as never,
				});

				if (!result.ok) {
					throw new Error('unmappable');
				}

				return result.device;
			}),
		};
		streamStore = new ProtectStreamAvailabilityStore();
		// Without a realtime session the synchronizer holds no camera: adoption writes the status itself.
		synchronizer = { refreshDevice: jest.fn().mockResolvedValue(false) };
		service = new ProtectAdoptionService(
			preview as unknown as ProtectMappingPreviewService,
			fakes.devicesService as unknown as DevicesService,
			fakes.channelsService as never,
			fakes.propertiesService as never,
			fakes.propertyValueService as never,
			fakes.connectivity as unknown as DeviceConnectivityService,
			{ runExclusive: (work: () => Promise<unknown>) => work() } as unknown as DeviceStructureLockService,
			new ProtectAdoptionLockService(),
			{ transaction: (work: (manager: unknown) => Promise<unknown>) => work({}) } as unknown as DataSource,
			loader,
			new ProtectAdoptionStreamsService(),
			config as never,
			streamStore,
			synchronizer as unknown as ProtectSynchronizerService,
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates the full hierarchy in one creation transaction and applies initial values after it', async () => {
		const result = await service.adoptOne(SELECTION);
		const dto = fakes.devicesService.create.mock.calls[0][0] as any;

		expect(fakes.devicesService.create).toHaveBeenCalledTimes(1);
		expect(fakes.devicesService.create.mock.calls[0]).toHaveLength(2);
		expect(contextRun).toHaveBeenCalledWith(
			expect.any(Function),
			DEVICES_UNIFI_PROTECT_TYPE,
			expect.any(Function),
			expect.any(Function),
		);
		expect(dto).toMatchObject({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			identifier: IDENTIFIER,
			name: 'Front door',
			protectNvrId: '68b3ace392bf98c9fb76f70c',
			protectDeviceId: '600cefafd5f365d6f83c4ef3',
			protectModelKey: 'camera',
		});
		expect(dto.channels).toHaveLength(12);
		expect(dto.channels.every((item: any) => /^[0-9a-f-]{36}$/.test(item.id))).toBe(true);

		const properties = dto.channels.flatMap((item: any) => item.properties);

		expect(properties.every((property: any) => /^[0-9a-f-]{36}$/.test(property.id))).toBe(true);
		expect(properties.every((property: any) => !('unit' in property) && property.invalid === null)).toBe(true);
		expect(properties.every((property: any) => typeof property.protectMappingName === 'string')).toBe(true);

		const expectedWrites = mapped.channels
			.flatMap((item) => item.properties)
			.filter((property) => property.value !== null && property.identifier !== 'connection_state');

		expect(fakes.count('property.value')).toBe(expectedWrites.length);
		expect(fakes.ops().indexOf('property.value')).toBeGreaterThan(fakes.ops().indexOf('device.create'));
		expect(fakes.calls.find((call) => call.op === 'property.value')!.options).toEqual({
			strictValuePersistence: true,
			comparePersistedValue: true,
			expectedPersistedState: null,
		});
		expect(fakes.connectivity.trySetConnectionState).toHaveBeenCalledWith(dto.id, { state: ConnectionState.CONNECTED });
		expect(result).toMatchObject({
			deviceId: '600cefafd5f365d6f83c4ef3',
			modelKey: 'camera',
			status: 'created',
			panelDeviceId: dto.id,
			failureCode: null,
			message: null,
			warnings: [],
		});
	});

	it('leaves nothing behind when the creation transaction fails', async () => {
		fakes.failCreate = true;

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: 'persistence_failed', panelDeviceId: null });
		expect(fakes.ops()).toEqual(['device.create']);
		expect(fakes.devices).toEqual([]);
	});

	it('hands a lost unique insert over to reconciliation', async () => {
		fakes.devicesService.create.mockImplementationOnce(() => {
			fakes.seed(mapped);

			return Promise.reject(new Error('unique violation'));
		});

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'skipped', panelDeviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
	});

	it('skips an unchanged device and writes nothing', async () => {
		fakes.seed(mapped);

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'skipped', failureCode: null, warnings: [] });
		expect(fakes.ops().filter((op) => /create|remove|update|meta/.test(op) && op !== 'property.value')).toEqual([]);
		expect(
			fakes.calls.filter((call) => call.op === 'property.value').every((call) => call.options.comparePersistedValue),
		).toBe(true);
	});

	it('adds a new detection channel and prunes one Protect no longer reports', async () => {
		const stored = withChannels([
			...mapped.channels,
			clone(channel('object_detection.animal'), 'object_detection.face', 'Face'),
		]);

		fakes.seed(stored);
		mapped = withChannels([
			...mapped.channels,
			clone(channel('object_detection.animal'), 'object_detection.license_plate', 'License plate'),
		]);
		preview.prepare.mockResolvedValue(prepared(mapped));

		const idsBefore = new Map(
			fakes.properties.map((property) => [property.identifier + property.channelId, property.id]),
		);
		const result = await service.adoptOne(SELECTION);

		expect(result.status).toBe(ProtectAdoptionStatus.UPDATED);
		expect(fakes.count('channel.create')).toBe(1);
		expect((fakes.calls.find((call) => call.op === 'channel.create')!.arg as any).identifier).toBe(
			'object_detection.license_plate',
		);
		expect(fakes.count('channel.remove')).toBe(1);
		expect(fakes.channels.map((item) => item.identifier)).not.toContain('object_detection.face');
		expect(fakes.channels.map((item) => item.identifier)).toContain('object_detection.license_plate');
		expect(fakes.ops().lastIndexOf('property.value')).toBeLessThan(fakes.ops().indexOf('channel.remove'));

		for (const property of fakes.properties) {
			const before = idsBefore.get(property.identifier + property.channelId);

			if (before !== undefined) {
				expect(property.id).toBe(before);
			}
		}
	});

	it('keeps the Smart Panel name on re-adoption unless a name is given', async () => {
		fakes.seed(mapped, { name: 'My camera' });

		expect(await service.adoptOne(SELECTION)).toMatchObject({ status: 'skipped' });
		expect(fakes.count('device.update')).toBe(0);

		const renamed = await service.adoptOne({ ...SELECTION, name: 'Porch' } as ProtectAdoptDeviceDto);

		expect(renamed.status).toBe('updated');
		expect(fakes.calls.find((call) => call.op === 'device.update')!.arg).toEqual({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			name: 'Porch',
			category: 'camera',
			identifier: IDENTIFIER,
		});
	});

	it.each([
		['protectModelKey', 'light'],
		['protectDeviceId', 'other'],
		['protectNvrId', 'other'],
	])('fails closed without mutation when the identity column %s disagrees', async (column, value) => {
		const device = fakes.seed(mapped);

		(device as any)[column] = value;

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: 'persistence_failed' });
		expect(fakes.calls).toEqual([]);
	});

	it('updates only the metadata an update accepts when a property drifted', async () => {
		fakes.seed(mapped);

		const property = fakes.properties.find((candidate) => candidate.identifier === 'detected')!;

		property.name = 'Stale';

		const result = await service.adoptOne(SELECTION);
		const update = fakes.calls.find((call) => call.op === 'property.meta')!.arg;

		expect(result.status).toBe('updated');
		expect(Object.keys(update).sort()).toEqual(
			['data_type', 'format', 'id', 'identifier', 'invalid', 'name', 'permissions', 'step', 'type'].sort(),
		);
		expect(property.name).not.toBe('Stale');
	});

	it('fails closed when a stored property differs in category', async () => {
		fakes.seed(mapped);
		fakes.properties.find((candidate) => candidate.identifier === 'detected')!.category = 'tampered';

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: 'persistence_failed' });
		expect(fakes.ops().filter((op) => op !== 'property.value')).toEqual([]);
	});

	it('fails closed when an identifier match carries another mapping name', async () => {
		fakes.seed(mapped);
		fakes.properties.find((candidate) => candidate.identifier === 'detected')!.protectMappingName = 'something_else';

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: 'persistence_failed' });
		expect(fakes.ops()).toEqual([]);
	});

	it('accepts an identifier match without a mapping name and does not write one (A20)', async () => {
		fakes.seed(mapped);
		fakes.properties.find((candidate) => candidate.identifier === 'detected')!.protectMappingName = null;

		const result = await service.adoptOne(SELECTION);

		expect(result.status).not.toBe('failed');
		expect(['updated', 'skipped']).toContain(result.status);
		expect(fakes.properties.find((candidate) => candidate.identifier === 'detected')!.protectMappingName).toBeNull();
		expect(fakes.calls.filter((call) => call.op === 'property.meta' && 'protectMappingName' in call.arg)).toEqual([]);
	});

	it('rolls back completed reconciliation steps when a later step fails', async () => {
		fakes.seed(
			withChannels(
				mapped.channels.filter(
					(item) => !['object_detection.vehicle', 'object_detection.animal'].includes(item.identifier),
				),
			),
		);

		const motion = fakes.channels.find((item) => item.identifier === 'motion')!;

		motion.name = 'Old motion';
		fakes.failChannelCreateAt = 2;

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: 'persistence_failed', message: MESSAGES[4] });
		expect(fakes.channels.map((item) => item.identifier)).not.toContain('object_detection.vehicle');
		expect(motion.name).toBe('Old motion');
		expect(fakes.count('property.value')).toBe(0);
	});

	it('reports rollback_failed when compensation itself fails', async () => {
		fakes.seed(
			withChannels(
				mapped.channels.filter(
					(item) => !['object_detection.vehicle', 'object_detection.animal'].includes(item.identifier),
				),
			),
		);
		fakes.failChannelCreateAt = 2;
		fakes.failChannelRemove = true;

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: 'rollback_failed', message: MESSAGES[5] });
	});

	it('reports structure_incomplete when a stale removal fails and retries it on the next adoption', async () => {
		fakes.seed(
			withChannels([...mapped.channels, clone(channel('object_detection.animal'), 'object_detection.face', 'Face')]),
		);
		preview.prepare.mockResolvedValue(prepared(mapped));
		fakes.failChannelRemove = true;

		const first = await service.adoptOne(SELECTION);

		expect(first).toMatchObject({ status: 'updated', failureCode: null, warnings: ['structure_incomplete'] });
		expect(fakes.channels.map((item) => item.identifier)).toContain('object_detection.face');

		fakes.failChannelRemove = false;

		const second = await service.adoptOne(SELECTION);

		expect(second).toMatchObject({ status: 'updated', warnings: [] });
		expect(fakes.channels.map((item) => item.identifier)).not.toContain('object_detection.face');
	});

	it('never prunes the device information channel or a property without a mapping name', async () => {
		fakes.seed(mapped);

		const motion = fakes.channels.find((item) => item.identifier === 'motion')!;

		fakes.addProperty(motion.id, {
			id: 'custom-1',
			type: DEVICES_UNIFI_PROTECT_TYPE,
			identifier: 'custom',
			name: 'Custom',
			category: 'detected',
			permissions: ['ro'],
			data_type: 'bool',
		});
		mapped = withChannels(mapped.channels.filter((item) => item.category !== ChannelCategory.DEVICE_INFORMATION));
		preview.prepare.mockResolvedValue(prepared(mapped));

		const result = await service.adoptOne(SELECTION);

		expect(result.status).toBe('skipped');
		expect(fakes.count('channel.remove')).toBe(0);
		expect(fakes.count('property.remove')).toBe(0);
		expect(fakes.channels.some((item) => item.category === ChannelCategory.DEVICE_INFORMATION)).toBe(true);
	});

	it('never overwrites a stored constant value but writes a still-unstored one', async () => {
		fakes.seed(mapped);

		const live = fakes.propertyId('motion', 'detected');
		const unstored = fakes.propertyId('smoke', 'detected');

		fakes.values.set(live, { value: true });
		fakes.values.delete(unstored);

		const result = await service.adoptOne(SELECTION);
		const written = fakes.calls.filter((call) => call.op === 'property.value').map((call) => call.arg.id);

		expect(fakes.values.get(live)).toEqual({ value: true });
		expect(written).not.toContain(live);
		expect(written).toContain(unstored);
		expect(fakes.values.get(unstored)).toEqual({ value: false });
		expect(result.status).toBe('updated');
	});

	it('reports values_incomplete and resumes on the next adoption', async () => {
		const failing = new Set<string>();

		fakes.failValueFor = failing;
		// Two writes fail on creation: their property ids come from the creation payload.
		fakes.onCreate = (dto) => {
			failing.add(dto.channels.find((item: any) => item.identifier === 'motion').properties[0].id);
			failing.add(dto.channels.find((item: any) => item.identifier === 'camera.main').properties[1].id);
		};

		const first = await service.adoptOne(SELECTION);

		expect(first).toMatchObject({ status: 'created', failureCode: null, warnings: ['values_incomplete'] });
		expect(fakes.devices).toHaveLength(1);

		failing.clear();

		const mark = fakes.calls.length;
		const second = await service.adoptOne(SELECTION);
		const written = fakes.calls
			.slice(mark)
			.filter((call) => call.op === 'property.value')
			.map((call) => call.arg.id);

		expect(second).toMatchObject({ status: 'updated', warnings: [] });
		expect(written).toEqual(
			expect.arrayContaining([fakes.propertyId('motion', 'detected'), fakes.propertyId('camera.main', 'source')]),
		);
		expect(fakes.values.get(fakes.propertyId('motion', 'detected'))).toEqual({ value: false });
		expect(fakes.values.get(fakes.propertyId('camera.main', 'source'))).toEqual({
			value: 'unifi-protect:600cefafd5f365d6f83c4ef3:main',
		});
	});

	it('reports values_incomplete when the connection state cannot be set', async () => {
		fakes.connectionResult = false;

		expect(await service.adoptOne(SELECTION)).toMatchObject({ status: 'created', warnings: ['values_incomplete'] });
		expect(
			logged.flat().some((line) => JSON.stringify(line).includes('connection state persistence was deferred')),
		).toBe(true);
	});

	it('does not log a deferred connection state when only a value write fails', async () => {
		fakes.onCreate = (dto) => {
			fakes.failValueFor.add(dto.channels.find((item: any) => item.identifier === 'motion').properties[0].id);
		};

		expect(await service.adoptOne(SELECTION)).toMatchObject({ status: 'created', warnings: ['values_incomplete'] });
		expect(logged.flat().some((line) => JSON.stringify(line).includes('connection state persistence'))).toBe(false);
	});

	it.each([
		[new ProtectConsoleUnavailableError(null), 'unavailable'],
		[new ProtectDeviceNotFoundError(), 'device_not_found'],
		[new ProtectUnsupportedDeviceError(), 'unsupported_mapping'],
	])('fails closed before any mutation when the fresh read fails (%s)', async (error, code) => {
		preview.prepare.mockRejectedValue(error);

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: code, panelDeviceId: null });
		expect(fakes.calls).toEqual([]);
		expect(fakes.devicesService.findOneBy).not.toHaveBeenCalled();
	});

	it('fails with not_ready when the mapping does not satisfy the specification', async () => {
		preview.prepare.mockResolvedValue(prepared(mapped, false));

		const result = await service.adoptOne(SELECTION);

		expect(result).toMatchObject({ status: 'failed', failureCode: 'not_ready', message: MESSAGES[3] });
		expect(fakes.calls).toEqual([]);
	});

	it('isolates batch failures and keeps request order', async () => {
		const byId = (id: string) => map({ ...cameras[0], id });

		preview.prepare.mockImplementation((id: string) =>
			id === 'camb' ? Promise.reject(new ProtectDeviceNotFoundError()) : Promise.resolve(prepared(byId(id))),
		);

		const results = await service.adoptBatch(
			['cama', 'camb', 'camc'].map((deviceId) => ({ ...SELECTION, deviceId }) as ProtectAdoptDeviceDto),
		);

		expect(results.map((result) => result.status)).toEqual(['created', 'failed', 'created']);
		expect(results.map((result) => result.deviceId)).toEqual(['cama', 'camb', 'camc']);
	});

	it('serializes two concurrent adoptions of one device', async () => {
		const [first, second] = await Promise.all([service.adoptOne(SELECTION), service.adoptOne(SELECTION)]);

		expect(first.status).toBe('created');
		expect(second.status).toBe('skipped');
		expect(fakes.count('device.create')).toBe(1);
		expect(second.panelDeviceId).toBe(first.panelDeviceId);
	});

	it('returns fixed messages only and never leaks stream secrets', async () => {
		const outcomes = [
			new ProtectConsoleUnavailableError(null),
			new ProtectDeviceNotFoundError(),
			new ProtectUnsupportedDeviceError(),
		];
		const results = [];

		for (const error of outcomes) {
			preview.prepare.mockRejectedValueOnce(error);
			results.push(await service.adoptOne(SELECTION));
		}

		preview.prepare.mockResolvedValueOnce(prepared(mapped, false));
		results.push(await service.adoptOne(SELECTION));
		fakes.failCreate = true;
		results.push(await service.adoptOne(SELECTION));
		fakes.failCreate = false;
		results.push(await service.adoptOne(SELECTION));

		for (const result of results) {
			expect(result.message === null || MESSAGES.includes(result.message)).toBe(true);
		}

		expect(results.map((result) => result.message).filter((message) => message !== null)).toEqual(MESSAGES.slice(0, 5));

		const serialized = JSON.stringify([results, fakes.calls, logged]);

		expect(serialized).not.toMatch(/SENTINELALIAS|PROTECT_SENTINEL_KEY|rtsps:\/\//);
	});

	describe('stream enablement', () => {
		const statusOf = (channelIdentifier: string) =>
			fakes.values.get(fakes.propertyId(channelIdentifier, 'status'))?.value;

		it('records stream availability for the synchronizer', async () => {
			client.getRtspsStreams.mockResolvedValue(urls('high'));

			await service.adoptOne(ENABLING);

			expect(streamStore.get('600cefafd5f365d6f83c4ef3')?.availability).toEqual({
				high: true,
				medium: true,
				low: false,
				package: false,
			});
		});

		it('keeps the enabled result of a POST newer than a read that recorded disabled meanwhile', async () => {
			let clock = 1_000_000;

			jest.spyOn(Date, 'now').mockImplementation(() => clock);

			const id = '600cefafd5f365d6f83c4ef3';
			const disabled = { high: false, medium: false, low: false, package: false };

			// The initial GET sees nothing enabled; a background read then starts and records "disabled" before the POST.
			client.getRtspsStreams.mockImplementation(() => {
				clock += 10;
				streamStore.set(id, disabled, Date.now(), Date.now());
				clock += 10;

				return Promise.resolve(urls());
			});
			client.createRtspsStreams.mockImplementation(() => Promise.resolve(urls('high', 'medium')));

			await service.adoptOne(ENABLING);

			expect(streamStore.get(id)?.availability).toEqual({ high: true, medium: true, low: false, package: false });
		});

		it('writes the status from a newer read instead of the rejected observation of the enablement', async () => {
			const id = '600cefafd5f365d6f83c4ef3';
			const disabled = { high: false, medium: false, low: false, package: false };

			// The enablement read is stamped first; a background read stamped after it completes before it.
			client.getRtspsStreams.mockResolvedValue(urls('high'));
			client.createRtspsStreams.mockImplementation(() => {
				streamStore.set(id, disabled, streamStore.nextObservation());

				return Promise.resolve(urls('high', 'medium'));
			});

			const result = await service.adoptOne(ENABLING);

			expect(result.stream).toMatchObject({ status: 'enabled' });
			expect(streamStore.get(id)?.availability).toEqual(disabled);
			expect(statusOf('camera.main')).toBe('unavailable');
		});

		it('leaves the status write to the synchronizer when it holds the camera', async () => {
			synchronizer.refreshDevice.mockResolvedValue(true);
			client.getRtspsStreams.mockResolvedValue(urls('high'));

			const direct = jest.spyOn(service as any, 'updateStreamStatuses');
			const result = await service.adoptOne(ENABLING);

			expect(result).toMatchObject({ warnings: [], stream: { status: 'enabled' } });
			expect(synchronizer.refreshDevice).toHaveBeenCalledWith(
				{ nvrId: 'nvr', nvrMacKey: 'mac' },
				'camera',
				'600cefafd5f365d6f83c4ef3',
			);
			expect(direct).not.toHaveBeenCalled();
		});

		it('records nothing and sends no stream request once the prepared session has ended', async () => {
			const createDevice = fakes.devicesService.create.getMockImplementation()!;

			streamStore.nextObservation();
			fakes.devicesService.create.mockImplementation(async (...args: unknown[]) => {
				const created = await (createDevice as (...input: unknown[]) => Promise<unknown>)(...args);

				// The console session ends while the device is persisted.
				streamStore.clear();

				return created;
			});

			const result = await service.adoptOne(ENABLING);

			expect(client.getRtspsStreams).not.toHaveBeenCalled();
			expect(client.createRtspsStreams).not.toHaveBeenCalled();
			expect(result.stream).toMatchObject({ status: 'failed', failureCategory: 'unavailable' });
			expect(streamStore.get('600cefafd5f365d6f83c4ef3')).toBeNull();
		});

		it('stops the enablement between requests when the session ends during it', async () => {
			client.getRtspsStreams.mockImplementation(() => {
				streamStore.clear();

				return Promise.resolve(urls());
			});

			const result = await service.adoptOne(ENABLING);

			expect(client.createRtspsStreams).not.toHaveBeenCalled();
			expect(result.stream).toMatchObject({ status: 'failed', failureCategory: 'unavailable' });
			expect(streamStore.get('600cefafd5f365d6f83c4ef3')).toBeNull();
		});

		it('records the prepared availability when the console rejects the stream request', async () => {
			client.createRtspsStreams.mockRejectedValue(new Error('console down'));

			await service.adoptOne(ENABLING);

			expect(streamStore.get('600cefafd5f365d6f83c4ef3')?.availability).toEqual({
				high: true,
				medium: false,
				low: false,
				package: false,
			});
		});

		it('does not overwrite a newer read with the stale prepared availability', async () => {
			// A read requested after the prepare saw the stream disabled while adoption was persisting.
			streamStore.set('600cefafd5f365d6f83c4ef3', { high: false, medium: false, low: false, package: false }, 2_000);

			await service.adoptOne(SELECTION);

			expect(streamStore.get('600cefafd5f365d6f83c4ef3')).toMatchObject({
				availability: { high: false, medium: false, low: false, package: false },
				observedAt: 2_000,
			});
		});

		it('records the prepared availability when stream enablement is declined', async () => {
			await service.adoptOne(SELECTION);

			expect(streamStore.get('600cefafd5f365d6f83c4ef3')?.availability).toEqual({
				high: true,
				medium: false,
				low: false,
				package: false,
			});
		});

		it('enables the stream after the device is persisted and updates the camera status', async () => {
			client.getRtspsStreams.mockResolvedValue(urls('high'));

			const result = await service.adoptOne(ENABLING);

			expect(client.createRtspsStreams).toHaveBeenCalledWith('600cefafd5f365d6f83c4ef3', ['high', 'medium']);
			expect(fakes.devicesService.create.mock.invocationCallOrder[0]).toBeLessThan(
				client.createRtspsStreams.mock.invocationCallOrder[0],
			);
			expect(result).toMatchObject({
				status: 'created',
				warnings: [],
				stream: { status: 'enabled', quality: 'medium', enabledQualities: ['high', 'medium'], failureCategory: null },
			});
			expect(statusOf('camera.main')).toBe('available');

			const write = fakes.calls.filter((call) => call.op === 'property.value').pop()!;

			expect(write.options).toMatchObject({ strictValuePersistence: true, comparePersistedValue: true });
			expect(write.arg.value).toBe('available');
		});

		it('uses the configured default quality when the request names none', async () => {
			config.getPluginConfig.mockReturnValue({ defaultStreamQuality: 'low' });
			client.getRtspsStreams.mockResolvedValue(urls('high'));

			await service.adoptOne(ENABLING);

			expect(client.createRtspsStreams).toHaveBeenCalledWith('600cefafd5f365d6f83c4ef3', ['high', 'low']);
		});

		it('falls back to medium when the configuration cannot be read and honours the request quality', async () => {
			config.getPluginConfig.mockImplementation(() => {
				throw new Error('no config');
			});
			await service.adoptOne(ENABLING);

			expect(client.createRtspsStreams).toHaveBeenLastCalledWith('600cefafd5f365d6f83c4ef3', ['medium']);

			const other = Object.assign(new ProtectAdoptDeviceDto(), {
				...ENABLING,
				stream: { quality: 'high' },
			}) as ProtectAdoptDeviceDto;

			client.getRtspsStreams.mockResolvedValue(urls());
			await service.adoptOne(other);

			expect(client.createRtspsStreams).toHaveBeenLastCalledWith('600cefafd5f365d6f83c4ef3', ['high']);
		});

		it('adds the package quality for a package camera', async () => {
			rawCamera = { ...cameras[0], hasPackageCamera: true };
			mapped = map(rawCamera);
			preview.prepare.mockResolvedValue(prepared(mapped));

			await service.adoptOne(ENABLING);

			expect(client.createRtspsStreams).toHaveBeenCalledWith('600cefafd5f365d6f83c4ef3', ['medium', 'package']);
		});

		it('skips stream work when not requested', async () => {
			const result = await service.adoptOne(
				Object.assign(new ProtectAdoptDeviceDto(), { ...ENABLING, stream: { enabled: false } }),
			);

			expect(result.stream).toMatchObject({ status: 'not_requested', quality: null, enabledQualities: ['high'] });
			expect(client.getRtspsStreams).not.toHaveBeenCalled();
			expect(client.createRtspsStreams).not.toHaveBeenCalled();
		});

		it('skips stream work for sensors and when persistence failed', async () => {
			preview.prepare.mockResolvedValue(prepared({ ...mapped, protectModelKey: 'sensor' } as never));

			const sensor = await service.adoptOne(ENABLING);

			expect(sensor).toMatchObject({ status: 'created', stream: null });

			fakes.failCreate = true;
			preview.prepare.mockResolvedValue(prepared(mapped));

			const failed = await service.adoptOne(ENABLING);

			expect(failed).toMatchObject({ status: 'failed', stream: null });
			expect(client.getRtspsStreams).not.toHaveBeenCalled();
			expect(client.createRtspsStreams).not.toHaveBeenCalled();
		});

		it('reports a stream failure without failing the adoption', async () => {
			client.createRtspsStreams.mockRejectedValue(new Error('console down'));

			const result = await service.adoptOne(ENABLING);

			expect(result).toMatchObject({
				status: 'created',
				failureCode: null,
				warnings: [],
				stream: { status: 'failed', failureCategory: 'unavailable' },
			});
			expect(fakes.count('property.value')).toBeGreaterThan(0);
			expect(statusOf('camera.main')).toBe('unavailable');
		});

		it('enables streams when re-adopting an existing device and updates the changed status', async () => {
			fakes.seed(mapped);
			client.getRtspsStreams.mockResolvedValue(urls());

			const result = await service.adoptOne(ENABLING);

			expect(result).toMatchObject({ status: 'skipped', stream: { status: 'enabled' } });
			expect(statusOf('camera.main')).toBe('available');
		});

		it('reports values_incomplete when the status write fails, without changing the status', async () => {
			fakes.seed(mapped);
			fakes.failValueFor.add(fakes.propertyId('camera.main', 'status'));

			const result = await service.adoptOne(ENABLING);

			expect(result).toMatchObject({
				status: 'skipped',
				warnings: ['values_incomplete'],
				stream: { status: 'enabled' },
			});
		});

		it('keeps aliases out of the result and every log line', async () => {
			client.getRtspsStreams.mockResolvedValue(urls('high'));

			const results = [await service.adoptOne(ENABLING), await service.adoptOne(ENABLING)];

			client.createRtspsStreams.mockRejectedValue(new Error(url('high')));
			results.push(await service.adoptOne({ ...ENABLING, deviceId: '600cefafd5f365d6f83c4ef4' } as never));

			expect(logged.length).toBeGreaterThan(0);
			expect(JSON.stringify([results, logged, fakes.calls])).not.toMatch(/SENTINELALIAS|rtsps/);
		});
	});
});
