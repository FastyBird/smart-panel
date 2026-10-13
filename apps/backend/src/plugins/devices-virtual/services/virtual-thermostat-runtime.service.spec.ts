import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

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
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { VirtualDeviceEntity, VirtualDeviceMode } from '../entities/devices-virtual.entity';
import { VirtualThermostatCommandEntity } from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';
import { ThermostatActuationAdapter, VirtualThermostatTransportService } from './virtual-thermostat-transport.service';

jest.setTimeout(30_000);

describe('virtual thermostat durable runtime', () => {
	let directory: string;
	let database: SqliteDataSource;
	let runtime: VirtualThermostatRuntimeService;
	let controllerId: string;
	let sensorId: string;
	let relayId: string;
	const samples = new Map<string, QualifiedPropertySample>();
	const sends: boolean[] = [];
	let onGate: Promise<void> | null;
	let allowLateOn: boolean;
	const sample = (id: string, value: number | boolean): void => {
		const at = new Date();
		samples.set(id, {
			propertyId: id,
			value,
			sampledAt: at,
			receivedAt: at,
			provenance: 'live',
			quality: 'good',
			reasons: [],
		});
	};
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd2-thermostat-runtime-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'runtime.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		}).initialize();
		samples.clear();
		sends.length = 0;
		onGate = null;
		allowLateOn = false;
		controllerId = uuid();
		sensorId = uuid();
		relayId = uuid();
		const sensorDeviceId = uuid(),
			sensorChannelId = uuid(),
			relayDeviceId = uuid(),
			relayChannelId = uuid();
		await database.manager.insert(VirtualDeviceEntity, {
			id: controllerId,
			name: 'Thermostat',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(DeviceEntity, {
			id: sensorDeviceId,
			name: 'Ambient',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(ChannelEntity, {
			id: sensorChannelId,
			device: sensorDeviceId,
			name: 'Temperature',
			identifier: 'temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: sensorId,
			channel: sensorChannelId,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			unit: '°C',
		} as never);
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: relayDeviceId,
			name: '1PM',
			identifier: 'shellyplus1pm-a8032abe5084',
			category: DeviceCategory.SWITCHER,
			enabled: true,
			canonicalMac: 'A8032ABE5084',
		});
		await database.manager.insert(ShellyNgChannelEntity, {
			id: relayChannelId,
			device: relayDeviceId,
			name: 'Switch',
			identifier: 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: relayId,
			channel: relayChannelId,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const sensor = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: sensorId },
			relations: ['channel', 'channel.device'],
		});
		const relay = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: relayId },
			relations: ['channel', 'channel.device'],
		});
		const sensorChannel = sensor.channel as ChannelEntity,
			relayChannel = relay.channel as ChannelEntity;
		await database.manager.insert(VirtualThermostatConfigEntity, {
			controllerId,
			ownerDeviceId: controllerId,
			schemaVersion: 1,
			revision: 1,
			requestedMode: 'heat',
			locked: false,
			policy: {
				heatingSetpoint: 20,
				coolingSetpoint: null,
				coldTolerance: 0.5,
				hotTolerance: 0.5,
				neutralMargin: 1,
				minimumOffMs: 0,
				changeoverMs: 0,
				floor: null,
			},
			heuristic: null,
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(),
			releaseRequestedAt: null,
		});
		await database.manager.insert(VirtualThermostatSourceEntity, {
			id: uuid(),
			controllerId,
			role: 'ambient',
			sourcePropertyId: sensorId,
			sourcePropertyIdentity: sensorId,
			physicalIdentity: `property:${sensorId}`,
			contractFingerprint: thermostatPropertyContract(sensor, sensorChannel, sensorChannel.device as DeviceEntity),
			maximumAgeSeconds: 300,
			openValue: null,
			closedValue: null,
		});
		await database.manager.insert(VirtualThermostatActuatorClaimEntity, {
			id: uuid(),
			controllerId,
			role: 'heating',
			physicalIdentity: thermostatActuatorIdentity(relay, relayChannel, relayChannel.device as DeviceEntity),
			sourcePropertyId: relayId,
			sourcePropertyIdentity: relayId,
			sourceDeviceId: relayDeviceId,
			sourceDeviceIdentity: relayDeviceId,
			contractFingerprint: thermostatPropertyContract(relay, relayChannel, relayChannel.device as DeviceEntity),
			revision: 1,
			state: 'reserved',
			leaseSeconds: 30,
			reason: null,
			releaseRequestedAt: null,
			releasedAt: null,
			releaseEvidence: null,
		});
		sample(sensorId, 21);
		sample(relayId, false);
		const values = {
			readQualifiedSample: jest.fn((property: ChannelPropertyEntity) => samples.get(property.id) ?? null),
		} as unknown as PropertyValueService;
		const qualification = {
			physicalIdentity: thermostatActuatorIdentity(relay, relayChannel, relayChannel.device as DeviceEntity),
		} as ThermostatInstalledQualification;
		const claims = {
			capture: () => ({ isCurrent: () => true }),
			registerRuntimeAdmission: () => () => undefined,
			qualification: () => qualification,
			mintAuthority: () => ({}),
			isAuthorized: () => true,
		} as unknown as VirtualThermostatClaimsService;
		const adapter: ThermostatActuationAdapter = {
			canReconcile: () => true,
			send: async (target, _claim, _qualification, isAdmitted) => {
				if (target.value === true && onGate !== null) await onGate;
				if (!isAdmitted() && !(target.value === true && allowLateOn))
					return { outcome: 'refused' as const, reasons: ['revoked'] };
				const wasOn = samples.get(relayId)?.value === true;
				sends.push(target.value as boolean);
				sample(relayId, target.value as boolean);
				return {
					outcome: 'accepted' as const,
					wasOn,
					outputConfirmed: false as const,
					pendingOnDrained: false as const,
				};
			},
			reconcile: (_target, ids, off, isCurrent) =>
				Promise.resolve(
					isCurrent()
						? {
								proofId: uuid(),
								physicalIdentity: qualification.physicalIdentity,
								connectionIdentity: 'ordered-fake-connection',
								coveredCommandIds: ids,
								externalWriterBarrier: true,
								offSample: off,
							}
						: null,
				),
		};
		const transport = { get: () => adapter } as unknown as VirtualThermostatTransportService;
		const producers = { unregister: jest.fn() } as unknown as PropertyProducerRegistryService;
		runtime = new VirtualThermostatRuntimeService(
			database,
			new DeviceStructureLockService(),
			claims,
			new VirtualThermostatInputsService(database, values),
			transport,
			values,
			producers,
			new EventEmitter2(),
		);
		await runtime.onApplicationBootstrap();
	});
	afterEach(async () => {
		runtime?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});

	it('persists release and ON before transport, then releases at the comfort boundary', async () => {
		sample(sensorId, 18);
		runtime.request(controllerId);
		const settle = async () => {
			const operations = () => [...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()];
			for (let attempt = 0; attempt < 5; attempt++) {
				await runtime.flush();
				await Promise.all(operations());
			}
			await runtime.flush();
		};
		await runtime.inspect(controllerId);
		await settle();
		const energized = runtime.readDiagnostics(controllerId);
		expect(energized?.readiness).toBe('ready');
		expect(energized?.branches[0].activity).toBe('on');
		expect(sends).toEqual([false, true]);
		const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
		expect(journal.map((command) => command.action)).toEqual(['off', 'on']);
		expect(journal[0].status).toBe('confirmed');
		expect(journal[1].status).toBe('accepted');

		sample(sensorId, 21);
		runtime.request(controllerId);
		await settle();
		const released = runtime.readDiagnostics(controllerId);
		expect(released?.branches[0].activity).toBe('off');
		expect(released?.branches[0].release_proven).toBe(true);
		expect(sends).toEqual([false, true, false]);
		expect(
			(await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId })).every(
				(command) => command.status === 'confirmed',
			),
		).toBe(true);
	});

	it('retains pending ON and withholds release proof when a delayed ON arrives after OFF', async () => {
		let resumeOn: () => void = () => undefined;
		onGate = new Promise<void>((resolve) => {
			resumeOn = resolve;
		});
		allowLateOn = true;
		sample(sensorId, 18);
		runtime.request(controllerId);
		let beforeRelease: VirtualThermostatCommandEntity[] = [];
		for (let attempt = 0; attempt < 4; attempt++) {
			await runtime.inspect(controllerId);
			beforeRelease = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId });
			if (beforeRelease.some((command) => command.action === 'on')) break;
		}
		expect(beforeRelease.some((command) => command.action === 'on' && command.status === 'dispatching')).toBe(true);

		sample(sensorId, 21);
		runtime.request(controllerId);
		await runtime.flush();
		expect(runtime.readDiagnostics(controllerId)?.branches[0].release_proven).toBe(false);
		resumeOn();
		await Promise.all([...(runtime as unknown as { inFlight: Map<string, Promise<void>> }).inFlight.values()]);
		await runtime.flush();
		const late = runtime.readDiagnostics(controllerId);
		expect(samples.get(relayId)?.value).toBe(true);
		expect(late?.branches[0].pending_on).toBe(true);
		expect(late?.branches[0].release_proven).toBe(false);
	});
});
