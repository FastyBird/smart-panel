/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
/*
Reason: The test setup involves dynamic assignment and interaction with HTTP response bodies typed
as `any` by supertest, which TypeScript cannot strictly type-check. These casts are necessary for
effective testing and mirror the pattern already used by the other e2e specs in this directory.
*/
import { instanceToPlain } from 'class-transformer';
import { useContainer } from 'class-validator';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { createSqliteDataSource } from '../src/common/database/sqlite-data-source';
import { ConfigService } from '../src/modules/config/services/config.service';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	DeviceHiddenBy,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../src/modules/devices/devices.constants';
import {
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../src/modules/devices/entities/climate-automation.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../src/modules/devices/entities/devices.entity';
import { ChannelsPropertiesTypeMapperService } from '../src/modules/devices/services/channels.properties-type-mapper.service';
import { ClimateAutomationLedgerService } from '../src/modules/devices/services/climate-automation-ledger.service';
import { ClimateAutomationRegistryService } from '../src/modules/devices/services/climate-automation.registry.service';
import { DeviceConnectivityService } from '../src/modules/devices/services/device-connectivity.service';
import { DeviceStructureLockService } from '../src/modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { PropertyValueSourceRegistryService } from '../src/modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../src/modules/devices/services/property-value.service';
import { getPropertyMetadata } from '../src/modules/devices/utils/schema.utils';
import { StorageService } from '../src/modules/storage/services/storage.service';
import { SwaggerDocumentService } from '../src/modules/swagger/services/swagger-document.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../src/plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import { DEVICES_VIRTUAL_TYPE } from '../src/plugins/devices-virtual/devices-virtual.constants';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
} from '../src/plugins/devices-virtual/entities/devices-virtual.entity';
import { ThermostatCoolingDependencyEntity } from '../src/plugins/devices-virtual/entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../src/plugins/devices-virtual/entities/thermostat-member-protection.entity';
import { VirtualThermostatRuntimeEntity } from '../src/plugins/devices-virtual/entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSettingEntity,
	VirtualThermostatSourceEntity,
} from '../src/plugins/devices-virtual/entities/virtual-thermostat.entity';
import { VirtualDeviceInformationListener } from '../src/plugins/devices-virtual/listeners/virtual-device-information.listener';
import { VirtualStatusListener } from '../src/plugins/devices-virtual/listeners/virtual-status.listener';
import { VirtualCreatedThermostatModel } from '../src/plugins/devices-virtual/models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationModel } from '../src/plugins/devices-virtual/models/thermostat-response.model';
import { VirtualDependencyGraphService } from '../src/plugins/devices-virtual/services/virtual-dependency-graph.service';
import { VirtualDewPointConfigService } from '../src/plugins/devices-virtual/services/virtual-dew-point-config.service';
import { DEW_POINT_FORMULA } from '../src/plugins/devices-virtual/services/virtual-dew-point.utils';
import { VirtualPropertyIndexService } from '../src/plugins/devices-virtual/services/virtual-property-index.service';
import { VirtualThermostatConfigService } from '../src/plugins/devices-virtual/services/virtual-thermostat-config.service';
import { VirtualThermostatRuntimeService } from '../src/plugins/devices-virtual/services/virtual-thermostat-runtime.service';
import { InfluxV1ConfigModel } from '../src/plugins/influx-v1/models/config.model';
import { SimulatorDevicePlatform } from '../src/plugins/simulator/platforms/simulator-device.platform';
import { SIMULATOR_TYPE } from '../src/plugins/simulator/simulator.constants';
import { RoomSpaceEntity } from '../src/plugins/spaces-home-control/entities/room-space.entity';
import { ZoneSpaceEntity } from '../src/plugins/spaces-home-control/entities/zone-space.entity';

import { createProtectionProbe } from './support/thermostat-protection-fixture';

interface PropertyValueBody {
	value: string | number | boolean | null;
	last_updated: string | null;
	trend: string | null;
	producer?: {
		quality: 'good' | 'degraded' | 'unavailable';
		reasons: string[];
		sampled_at: string | null;
		evaluated_at: string;
		expires_at: string | null;
		revision: number;
	};
}

interface ChannelPropertyBody {
	id: string;
	type?: string;
	data_type?: DataTypeType;
	category: PropertyCategory;
	value: PropertyValueBody | null;
	value_origin?: string;
	source_property?: string | null;
}

interface ChannelBody {
	id: string;
	category: string;
	properties: ChannelPropertyBody[];
}

interface DeviceStatusBody {
	online: boolean;
	status: string;
	last_changed: string | null;
}

interface DeviceBody {
	id: string;
	type: string;
	category: string;
	enabled: boolean;
	hidden: boolean;
	hidden_by: string | null;
	status: DeviceStatusBody;
	channels: ChannelBody[];
}

interface ValidationIssueBody {
	type: string;
	severity: string;
	channel_id?: string;
	property_category?: string;
	message: string;
}

interface DeviceValidationBody {
	is_valid: boolean;
	issues: ValidationIssueBody[];
}

/**
 * Polls `fetchAndCheck` until it reports `done: true`, returning its `value`. Used wherever a write
 * is followed by a fire-and-forget side effect (command forwarding, event-driven aggregation) so the
 * assertion isn't racing an in-flight promise the HTTP response didn't wait for.
 *
 * `intervalMs` is deliberately not tighter than this. DisplayAwareThrottlerGuard applies
 * `{ ttl: 60000, limit: 30 }`, and @nestjs/throttler keys that counter per *client and route
 * handler* — the client being the address, which is loopback for every request this file makes. So
 * every poll of a given endpoint, in every test here, shares one budget of 30 requests, and the whole
 * file runs well inside a single 60-second window. At a 100ms interval a single three-second poll
 * spends that entire budget by itself, and every later request to that handler — from any test —
 * comes back 429 for the rest of the minute: a failure that reads as "the thing under test never
 * happened" but is really "the test asked too often", and which lands on whichever test happens to be
 * running rather than on the one that overspent.
 *
 * Prefer awaiting the in-process call a fire-and-forget handler would have made (see "reports the
 * source device connected") over polling for its effect, whenever the test can reach it. That costs
 * nothing from this budget and is deterministic besides.
 */
async function waitUntil<T>(
	fetchAndCheck: () => Promise<{ done: boolean; value: T }>,
	label = 'condition',
	timeoutMs = 3000,
	intervalMs = 250,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;

	for (;;) {
		const { done, value } = await fetchAndCheck();

		if (done) {
			return value;
		}

		// `label` and the last observed value are in the message because several calls in this file poll
		// different things with the same helper: without them a timeout says only that *something* never
		// settled, which is the least useful part of what this already knows.
		if (Date.now() >= deadline) {
			throw new Error(`waitUntil: ${label} was not met within ${timeoutMs}ms (last value: ${JSON.stringify(value)})`);
		}

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}

/**
 * Waits for VirtualPropertyIndexService's in-memory maps to catch up with a link that has already
 * been written.
 *
 * Read off the service in the test's own process rather than through an endpoint, because no
 * endpoint reports the maps any more and none should: `GET /devices/:id/source-devices` deliberately
 * resolves the wiring from the database on every call, so that a client which has just written sees
 * its own write (read-after-write). That makes it useless as a synchronisation point for the tests
 * below, which need the *index* to be current — the auto-unhide and the connection-state recompute
 * are both driven by rebuild() diffing the previous index against the new one, so a structural change
 * that lands before the index has caught up produces no transition and no recompute at all.
 *
 * Polled tightly and without HTTP: this touches no route, so it is outside the throttler budget
 * `waitUntil` has to respect, and the rebuild it waits on is a single query.
 */
async function waitForIndexedLink(
	index: VirtualPropertyIndexService,
	virtualDeviceId: string,
	timeoutMs = 5000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (index.findLinksByVirtualDevice(virtualDeviceId).length === 0) {
		if (Date.now() >= deadline) {
			throw new Error(`waitForIndexedLink: virtual device ${virtualDeviceId} had no indexed link after ${timeoutMs}ms`);
		}

		await new Promise((resolve) => setTimeout(resolve, 25));
	}
}

/**
 * Deletes a device, working around a known, external, timing-dependent 500.
 *
 * `DELETE /devices/:id` is the only call in this spec that opens `DataSource.transaction()`
 * (`DevicesService.remove`) — and the only e2e spec in this whole suite that ever calls it at all.
 * SQLite only allows one transaction at a time on the shared connection, and `Zigbee2mqttService`'s
 * own background reconnect loop (confirmed pre-existing and unrelated to devices-virtual by four
 * earlier tasks — see the "Known environment issue" note this task was briefed with) intermittently
 * leaves a transaction open without committing or rolling it back, which makes the next
 * `BEGIN TRANSACTION` fail with `SQLITE_ERROR: cannot start a transaction within a transaction`.
 * Confirmed directly by temporarily un-silencing the Nest Logger during debugging: the 500 traced
 * straight to `DevicesService.remove -> EntityManager.transaction -> SqliteQueryRunner.startTransaction`,
 * with `Zigbee2mqttService`'s reconnect/sync errors interleaved around it in the log.
 *
 * A plain "retry the DELETE on 500" is not safe here: TypeORM rolls back on a mid-transaction
 * failure, but observed behaviour across repeated runs was not always a clean "device still exists,
 * try again" — occasionally a later attempt came back 404 (device already gone) after an earlier
 * attempt had reported 500, which only makes sense if that earlier attempt's transaction actually
 * committed despite the collision. So after any non-204/404 response, this checks the device's
 * *actual* state via GET rather than trusting the DELETE response's status code, and only retries the
 * DELETE itself if the device demonstrably still exists. This works around the external flake without
 * weakening what the caller asserts afterward — either way, by the time this returns, the device is
 * confirmed gone by direct observation, not by assumption.
 */
async function ensureDeviceDeleted(
	authGetFn: (path: string) => request.Test,
	authDeleteFn: (path: string) => request.Test,
	deviceId: string,
	attempts = 6,
	delayMs = 250,
): Promise<void> {
	const devicePath = `/modules/devices/devices/${deviceId}`;

	for (let attempt = 0; attempt < attempts; attempt++) {
		const response = await authDeleteFn(devicePath);

		if (response.status === 204) {
			return;
		}

		const check = await authGetFn(devicePath);

		if (check.status === 404) {
			// Gone despite the non-204 response above — the delete's transaction committed before the
			// collision surfaced. Nothing left to do.
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	throw new Error(`Failed to delete device ${deviceId} after ${attempts} attempts (still present)`);
}

// Test-only point DATA observation. Query-wrapper functions are not persisted sample fields.
function observeAmbientPointData(rows: unknown, memory: boolean) {
	if (!Array.isArray(rows)) throw new Error('Expected physical point rows');
	const raw: Record<string, unknown>[] = [];
	const data = rows.map((row: unknown) => {
		if (!row || typeof row !== 'object' || Object.getOwnPropertySymbols(row).length)
			throw new Error('Invalid point row');
		const result: Record<string, string | number | boolean | null | undefined> = {};
		const observed: Record<string, unknown> = {};
		for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(row))) {
			if (!('value' in descriptor)) throw new Error('Non-data physical point field');
			const value: unknown = descriptor.value;
			if (key === 'time') {
				if (!value || typeof value !== 'object') throw new Error('Missing native point timestamp');
				const fields = Object.getOwnPropertyDescriptors(value);
				const own: Record<string, unknown> = {};
				for (const [name, field] of Object.entries(fields)) {
					if (!('value' in field)) throw new Error('Non-data timestamp wrapper field');
					const entry: unknown = field.value;
					if (typeof entry === 'function') {
						if (!(memory ? ['toISOString', 'getTime'] : ['toNanoISOString', 'getNanoTime']).includes(name))
							throw new Error('Unknown timestamp function');
						own[name] = { kind: 'query-wrapper-function', name };
					} else own[name] = { kind: typeof entry, value: entry };
				}
				observed.time = { ownFields: own, nativePrecision: memory ? 'milliseconds' : 'nanoseconds' };
				const method = fields[memory ? 'toISOString' : 'toNanoISOString'];
				if (!method || !('value' in method) || typeof method.value !== 'function')
					throw new Error('Missing native timestamp method');
				const stamp: unknown = Reflect.apply(method.value as (...args: never[]) => unknown, value, []);
				if (typeof stamp !== 'string') throw new Error('Invalid native point timestamp');
				if (memory && fields._nanoISO?.value !== stamp) throw new Error('Memory timestamp data disagrees');
				result.time = stamp;
			} else {
				if (
					value !== null &&
					value !== undefined &&
					typeof value !== 'string' &&
					typeof value !== 'boolean' &&
					!(typeof value === 'number' && Number.isFinite(value))
				)
					throw new Error('Non-scalar persisted point field');
				observed[key] = { kind: typeof value, value };
				result[key] =
					value === undefined && ['numberValue', 'stringValue'].includes(key)
						? null
						: (value as string | number | boolean | null | undefined);
			}
		}
		if (!Object.hasOwn(result, 'time') || typeof result.propertyId !== 'string')
			throw new Error('Incomplete physical point');
		// Only the two optional storage-protocol value fields have absence/null equivalence.
		for (const key of ['numberValue', 'stringValue']) if (!Object.hasOwn(result, key)) result[key] = null;
		raw.push(Object.freeze(observed));
		return Object.freeze(result);
	});
	return Object.freeze({ raw: Object.freeze(raw), data: Object.freeze(data) });
}

interface ThermostatWireScenario {
	replaceBeforeCreate: boolean;
	variant: string;
	failure: string;
	overlapKinds?: boolean;
	duplicateKind?: boolean;
	storageAudit?: boolean;
	interleave?: {
		afterPublication?: (root: string) => Promise<void>;
		afterHydration?: (device: VirtualDeviceEntity) => Promise<void>;
		expectedFallback?: boolean;
		foreignGraphWrites?: () => number;
		auditName?: string;
	};
}
interface ThermostatHttpFixture {
	app: INestApplication;
	moduleRef: TestingModule;
	dataSource: DataSource;
	accessToken: string;
}
async function verifyThermostatWire(
	{ app, moduleRef, dataSource, accessToken }: ThermostatHttpFixture,
	{
		replaceBeforeCreate,
		variant,
		failure,
		interleave,
		overlapKinds,
		duplicateKind,
		storageAudit,
	}: ThermostatWireScenario,
) {
	const hasHeating = variant !== 'cooling';
	const hasCooling = variant === 'dual' || variant === 'cooling';
	const hasFloor = variant === 'dual' || variant === 'floor';
	let publicRequest: Record<string, unknown> | undefined;
	const authPost = (path: string) =>
		request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${accessToken}`);

	const sensorDevice = uuid(),
		sensorChannel = uuid(),
		ambient = uuid();
	const relayDevice = uuid(),
		relayChannel = uuid(),
		relay = uuid(),
		canonicalMac = uuid().replaceAll('-', '').slice(0, 12).toUpperCase();
	await dataSource.manager.insert(DeviceEntity, {
		id: sensorDevice,
		name: 'P05a ambient',
		category: DeviceCategory.SENSOR,
		enabled: true,
	});
	await dataSource.manager.insert(ChannelEntity, {
		id: sensorChannel,
		device: sensorDevice,
		name: 'Temperature',
		category: ChannelCategory.TEMPERATURE,
	} as never);
	await dataSource.manager.insert(ChannelPropertyEntity, {
		id: ambient,
		channel: sensorChannel,
		identifier: 'temperature',
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		unit: '°C',
		permissions: [PermissionType.READ_ONLY],
	} as never);
	await dataSource.manager.insert(ShellyNgDeviceEntity, {
		id: relayDevice,
		name: 'P05a relay',
		identifier: 'p05a-' + uuid(),
		canonicalMac,
		category: DeviceCategory.SWITCHER,
		enabled: true,
	});
	await dataSource.manager.insert(ShellyNgChannelEntity, {
		id: relayChannel,
		device: relayDevice,
		identifier: 'switch:0',
		name: 'Switch',
		category: ChannelCategory.SWITCHER,
	} as never);
	await dataSource.manager.insert(ShellyNgChannelPropertyEntity, {
		id: relay,
		channel: relayChannel,
		identifier: 'output',
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		permissions: [PermissionType.READ_WRITE],
	} as never);
	const settings: { setting: string; property: string }[] = [];
	function property(channel: ChannelCategory, category: PropertyCategory, setting?: string) {
		const metadata = getPropertyMetadata(channel, category),
			id = uuid();
		if (setting) settings.push({ setting, property: id });
		return {
			id,
			type: 'virtual',
			identifier: category,
			category,
			data_type: metadata.data_type,
			permissions: [PermissionType.READ_ONLY],
			value_origin: 'local',
			format: metadata.format,
		};
	}
	function channel(category: ChannelCategory, properties: ReturnType<typeof property>[]) {
		return { id: uuid(), type: 'virtual', identifier: category, name: category, category, properties };
	}
	const room = uuid(),
		zone = uuid();
	await dataSource.manager.insert(RoomSpaceEntity, { id: room, name: 'P05b room' });
	await dataSource.manager.insert(ZoneSpaceEntity, { id: zone, name: 'P05b zone' });
	const device = {
		room_id: room,
		zone_ids: [zone],
		controls: [],
		id: uuid(),
		type: 'virtual',
		name: 'P05a complete thermostat',
		category: DeviceCategory.THERMOSTAT,
		mode: 'climate_controller',
		channels: [
			channel(ChannelCategory.TEMPERATURE, [property(ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE)]),
			channel(ChannelCategory.THERMOSTAT, [property(ChannelCategory.THERMOSTAT, PropertyCategory.LOCKED, 'locked')]),
			channel(
				ChannelCategory.DEVICE_INFORMATION,
				[
					PropertyCategory.MANUFACTURER,
					PropertyCategory.MODEL,
					PropertyCategory.SERIAL_NUMBER,
					PropertyCategory.STATUS,
				].map((category) => property(ChannelCategory.DEVICE_INFORMATION, category)),
			),
			...(hasHeating
				? [
						channel(ChannelCategory.HEATER, [
							property(ChannelCategory.HEATER, PropertyCategory.ON, 'heating_enabled'),
							property(ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, 'heating_setpoint'),
							property(ChannelCategory.HEATER, PropertyCategory.STATUS),
						]),
					]
				: []),
		],
	};

	let coolingRelay: string, floorProbe: string, surfaceProbe: string, dew: string;
	if (overlapKinds) {
		device.channels[0].id = device.id;
		device.channels[0].properties[0].id = device.id;
	}
	if (duplicateKind) device.channels[2].properties[1].id = device.channels[2].properties[0].id;
	let coolingMac: string;
	if (hasFloor) floorProbe = (await createProtectionProbe(dataSource, relay)).sourceId;
	if (hasCooling) {
		const coolingDevice = uuid(),
			coolingChannel = uuid();
		coolingRelay = uuid();
		coolingMac = uuid().replaceAll('-', '').slice(0, 12).toUpperCase();
		await dataSource.manager.insert(ShellyNgDeviceEntity, {
			id: coolingDevice,
			name: 'P05b cooler',
			identifier: uuid(),
			canonicalMac: coolingMac,
			category: DeviceCategory.SWITCHER,
			enabled: true,
		});
		await dataSource.manager.insert(ShellyNgChannelEntity, {
			id: coolingChannel,
			device: coolingDevice,
			identifier: 'switch:0',
			name: 'Cooler',
			category: ChannelCategory.SWITCHER,
		} as never);
		await dataSource.manager.insert(ShellyNgChannelPropertyEntity, {
			id: coolingRelay,
			channel: coolingChannel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		surfaceProbe = (await createProtectionProbe(dataSource, coolingRelay)).sourceId;
		const humidityChannel = uuid(),
			humidity = uuid(),
			dewDevice = uuid(),
			dewChannel = uuid();
		dew = uuid();
		await dataSource.manager.insert(ChannelEntity, {
			id: humidityChannel,
			device: sensorDevice,
			name: 'Humidity',
			category: ChannelCategory.HUMIDITY,
		} as never);
		await dataSource.manager.insert(ChannelPropertyEntity, {
			id: humidity,
			channel: humidityChannel,
			identifier: 'humidity',
			category: PropertyCategory.HUMIDITY,
			dataType: DataTypeType.FLOAT,
			unit: '%',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		await dataSource.manager.insert(VirtualDeviceEntity, {
			id: dewDevice,
			name: 'P05b dedicated dew point',
			category: DeviceCategory.SENSOR,
			mode: 'sensor_transform',
			enabled: true,
		} as never);
		await dataSource.manager.insert(VirtualChannelEntity, {
			id: dewChannel,
			device: dewDevice,
			name: 'Dew point',
			category: ChannelCategory.ANALOG_INPUT,
		} as never);
		await dataSource.manager.insert(VirtualChannelPropertyEntity, {
			id: dew,
			channel: dewChannel,
			identifier: 'value',
			category: PropertyCategory.VALUE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			valueOrigin: 'derived',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		const dewPoints = moduleRef.get(VirtualDewPointConfigService);
		await dataSource.transaction(async (manager) => {
			const prepared = await dewPoints.prepare(manager, dew, {
				schemaVersion: 1,
				formulaVersion: DEW_POINT_FORMULA,
				expectedRevision: 0,
				maximumAgeSeconds: 300,
				maximumSkewSeconds: 60,
				sources: [
					{ role: 'dry_bulb', sourcePropertyId: ambient },
					{ role: 'relative_humidity', sourcePropertyId: humidity },
				],
			});
			await dewPoints.persist(manager, prepared);
		});
		device.channels.push(
			channel(ChannelCategory.COOLER, [
				property(ChannelCategory.COOLER, PropertyCategory.ON, 'cooling_enabled'),
				property(ChannelCategory.COOLER, PropertyCategory.TEMPERATURE, 'cooling_setpoint'),
				property(ChannelCategory.COOLER, PropertyCategory.STATUS),
			]),
		);
	}

	const graph = moduleRef.get(VirtualDependencyGraphService),
		revision = await graph.revision();
	const foreignGraphBaseline = interleave?.foreignGraphWrites?.() ?? 0;
	// Own every temporary hook, observer and spy before the next await can reject.
	const restore: Array<() => void> = [];
	let rejection: { cause: unknown } | undefined;
	try {
		const legacyWrites = jest.spyOn(graph, 'withStructuralWrite');
		restore.push(() => legacyWrites.mockRestore());
		const mapper = moduleRef.get(ChannelsPropertiesTypeMapperService);
		const mapping = mapper.getMapping('virtual'),
			originalHook = mapping.beforeCreate;
		const values = moduleRef.get(PropertyValueService);
		const ambientProperty = await dataSource.manager.findOneByOrFail(ChannelPropertyEntity, { id: ambient });
		await values.write(ambientProperty, 18);
		const historyBefore = await values.readLatest(ambientProperty);
		expect(historyBefore?.value).toBe(18);
		const writes = jest.spyOn(values, 'write');
		restore.push(() => writes.mockRestore());
		const storage = moduleRef.get(StorageService);
		let physicalAmbientHistory: ReturnType<typeof observeAmbientPointData>;
		const proofWindows: { before: number[]; after?: number[] }[] = [];
		if (storageAudit) {
			physicalAmbientHistory = observeAmbientPointData(
				await storage.queryStrict(`SELECT * FROM property_value WHERE propertyId = '${ambient}' ORDER BY time ASC`),
				storage.isUsingFallback(),
			);
			expect(physicalAmbientHistory.data).toHaveLength(1);
			expect(physicalAmbientHistory.data[0].propertyId).toBe(ambient);
			expect(physicalAmbientHistory.data[0].numberValue).toBe(18);
			const points = jest.spyOn(storage, 'writePoints'),
				strictPoints = jest.spyOn(storage, 'writePointsStrict'),
				deletes = jest.spyOn(values, 'delete');
			restore.push(
				() => points.mockRestore(),
				() => strictPoints.mockRestore(),
				() => deletes.mockRestore(),
			);
			const counts = () => [
				writes.mock.calls.length,
				points.mock.calls.length,
				strictPoints.mock.calls.length,
				deletes.mock.calls.length,
			];
			const pending = new WeakMap<import('typeorm').QueryRunner, { before: number[]; after?: number[] }>();
			const observer = {
				beforeQuery(event: import('typeorm').BeforeQueryEvent<unknown>) {
					if (event.query.startsWith('WITH root AS')) {
						const window = { before: counts() };
						pending.set(event.queryRunner, window);
						proofWindows.push(window);
					}
				},
				afterQuery(event: import('typeorm').AfterQueryEvent<unknown>) {
					if (event.query.startsWith('WITH root AS')) {
						const window = pending.get(event.queryRunner);
						if (window) window.after = counts();
					}
				},
			};
			dataSource.subscribers.push(observer);
			restore.push(() => {
				const index = dataSource.subscribers.indexOf(observer);
				if (index >= 0) dataSource.subscribers.splice(index, 1);
			});
		}

		const emitted = jest.spyOn(moduleRef.get(EventEmitter2), 'emit');
		restore.push(() => emitted.mockRestore());
		const originalAfterCreate = mapping.afterCreate;
		restore.push(() => {
			mapping.beforeCreate = originalHook;
			mapping.afterCreate = originalAfterCreate;
			if (replaceBeforeCreate) mapper.registerMapping(mapping);
		});
		if (replaceBeforeCreate)
			mapping.beforeCreate = async function (...args) {
				await originalHook.call(this, ...args);
				mapper.registerMapping(mapping);
			};

		const configs = moduleRef.get(VirtualThermostatConfigService),
			devices = moduleRef.get(DevicesService);
		let loaded: VirtualDeviceEntity,
			originalConfiguration: VirtualThermostatConfigurationModel,
			originalWire: unknown,
			healthyWire: unknown;
		const wire = (selected: VirtualDeviceEntity, configuration: VirtualThermostatConfigurationModel): unknown =>
			JSON.parse(
				JSON.stringify(
					instanceToPlain(Object.assign(new VirtualCreatedThermostatModel(), { device: selected, configuration }), {
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
						ignoreDecorators: false,
						groups: ['api'],
						enableCircularCheck: true,
					}),
				),
			) as unknown;
		const observer = {
			afterLoad(entity: object) {
				if (entity instanceof VirtualDeviceEntity && entity.id === device.id) loaded = entity;
			},
		};
		dataSource.subscribers.push(observer);
		restore.push(() => {
			const index = dataSource.subscribers.indexOf(observer);
			if (index >= 0) dataSource.subscribers.splice(index, 1);
		});
		const snapshot = configs.snapshot.bind(configs) as VirtualThermostatConfigService['snapshot'];
		const snapshotSpy = jest.spyOn(configs, 'snapshot');
		restore.push(() => snapshotSpy.mockRestore());
		snapshotSpy.mockImplementation(async (...args) => {
			const configuration = await snapshot(...args);
			originalConfiguration = configuration;
			originalWire = wire(loaded, configuration);
			return configuration;
		});
		let configured = false,
			finalHydrations = 0,
			catalogJobs = 0;
		const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		const configSpy = jest.spyOn(configs, 'afterCommit');
		restore.push(() => configSpy.mockRestore());
		configSpy.mockImplementation(async (...args) => {
			const result = await afterCommit(...args);
			configured = true;
			await interleave?.afterPublication?.(device.id);
			if (failure === 'configuration') {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy post-ACK cause.
				return Promise.reject(0);
			}
			return result;
		});
		const find = devices.findOne.bind(devices) as DevicesService['findOne'];
		const findSpy = jest.spyOn(devices, 'findOne');
		restore.push(() => findSpy.mockRestore());
		findSpy.mockImplementation(async (...args) => {
			const finalPhaseAtEntry = configured;
			const result = await find(...args);
			if (finalPhaseAtEntry && args[0] === device.id) {
				finalHydrations++;
				healthyWire = wire(result as VirtualDeviceEntity, originalConfiguration);
				await interleave?.afterHydration?.(result as VirtualDeviceEntity);
				if (failure === 'hydration') {
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy post-ACK cause.
					return Promise.reject(null);
				}
			}
			return result;
		});
		const originalPropertyIds = new Set(
			device.channels.flatMap((entry) => entry.properties.map((property) => property.id)),
		);
		mapping.afterCreate = async function (...args) {
			await originalAfterCreate?.call(this, ...args);
			// Fault only this request's finite catalog jobs, leaving unrelated background repair intact.
			if (!originalPropertyIds.has(args[0].id)) return;
			catalogJobs++;
			if (failure === 'catalog') {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy post-ACK cause.
				return Promise.reject('');
			}
		};

		publicRequest = {
			device,
			configuration: {
				schema_version: 1,
				expected_revision: 0,
				expected_graph_revision: revision,
				requested_mode: 'off',
				policy: {
					heatingSetpoint: hasHeating ? 20 : null,
					coolingSetpoint: hasCooling ? 25 : null,
					...(hasCooling ? { cooling: { schemaVersion: 1, marginC: 2, recoveryHysteresisC: 1 } } : {}),
					coldTolerance: 0.5,
					hotTolerance: 0.5,
					neutralMargin: 1,
					minimumOffMs: 0,
					changeoverMs: 0,
					floor: hasFloor ? { limit: 30, recoveryHysteresis: 2 } : null,
				},
				contact_opening_ms: 0,
				contact_closing_ms: 0,
				sources: [{ role: 'ambient', source_property: ambient, maximum_age_seconds: 300 }],
				actuators: [
					...(hasHeating
						? [
								{
									role: 'heating',
									source_property: relay,
									lease_seconds: 30,
									...(hasFloor
										? {
												protection: {
													schema_version: 1,
													kind: 'local_floor',
													source_property: floorProbe,
													maximum_age_seconds: 5,
												},
											}
										: {}),
								},
							]
						: []),
					...(hasCooling
						? [
								{
									role: 'cooling',
									source_property: coolingRelay,
									lease_seconds: 30,
									cooling_protection: {
										schemaVersion: 1,
										purpose: 'cooled_surface',
										dew_point_property: dew,
										surface_property: surfaceProbe,
										maximum_age_seconds: 5,
									},
								},
							]
						: []),
				],
				settings,
			},
		};
		const response = await authPost('/plugins/devices-virtual/producers/thermostats').send(publicRequest);
		if (interleave?.auditName && process.env.P05B1B_TEST_ARTIFACT_DIR)
			writeFileSync(
				path.join(process.env.P05B1B_TEST_ARTIFACT_DIR, `wire-${interleave.auditName}.json`),
				JSON.stringify({ originalWire, healthyWire, response: response.body as unknown, finalHydrations }),
			);
		const expectedStatus = replaceBeforeCreate ? 500 : duplicateKind ? 422 : 201;
		if (response.status !== expectedStatus)
			throw new Error(JSON.stringify({ status: response.status, body: response.body as unknown }));
		expect(response.status).toBe(expectedStatus);
		if (replaceBeforeCreate || duplicateKind) {
			if (duplicateKind)
				expect(JSON.stringify(response.body)).toContain('Every catalog UUID must be explicit and distinct.');
			expect(await dataSource.manager.countBy(DeviceEntity, { id: device.id })).toBe(0);
			for (const expected of device.channels) {
				expect(await dataSource.manager.countBy(ChannelEntity, { id: expected.id })).toBe(0);
				for (const property of expected.properties)
					expect(await dataSource.manager.countBy(ChannelPropertyEntity, { id: property.id })).toBe(0);
			}
			expect(await dataSource.manager.countBy(VirtualThermostatConfigEntity, { controllerId: device.id })).toBe(0);
			expect(await dataSource.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId: device.id })).toBe(
				0,
			);
			expect(await graph.revision()).toBe(revision);
			expect(writes).not.toHaveBeenCalled();
			expect(
				emitted.mock.calls.filter(([event]) =>
					[EventType.DEVICE_CREATED, EventType.CHANNEL_CREATED, EventType.CHANNEL_PROPERTY_CREATED].includes(
						event as EventType,
					),
				),
			).toEqual([]);
			expect(await values.readLatest(ambientProperty)).toEqual(historyBefore);
		} else {
			const result = (
				response.body as {
					data: {
						device: DeviceBody;
						configuration: {
							controller: string;
							revision: number;
							readiness: string;
							requested_mode: string;
							graph_revision: number;
						};
					};
				}
			).data;
			expect(response.body).toEqual({
				status: 'success',
				timestamp: expect.any(String) as unknown,
				request_id: expect.any(String) as unknown,
				path: '/plugins/devices-virtual/producers/thermostats',
				method: 'POST',
				data: failure === 'none' && !interleave?.expectedFallback ? healthyWire : originalWire,
				metadata: {
					request_duration_ms: expect.any(Number) as unknown,
					server_time: expect.any(String) as unknown,
					cpu_usage: expect.any(Number) as unknown,
				},
			});
			expect(finalHydrations).toBe(1);
			if (storageAudit) {
				expect(proofWindows).toHaveLength(3);
				for (const window of proofWindows) expect(window.after).toEqual(window.before);
				const physicalAmbientAfter = observeAmbientPointData(
					await storage.queryStrict(`SELECT * FROM property_value WHERE propertyId = '${ambient}' ORDER BY time ASC`),
					storage.isUsingFallback(),
				);
				console.info(
					'physical-point-data-comparison',
					JSON.stringify({
						before: physicalAmbientHistory,
						after: physicalAmbientAfter,
						qualification:
							'Only optional numberValue/stringValue absence-null and known native query timestamp function handles differ in representation. All tag/scalar fields, order, actual18 and exact native timestamp remain in point DATA.',
					}),
				);
				expect(physicalAmbientAfter.data).toHaveLength(1);
				expect(physicalAmbientAfter.data[0].propertyId).toBe(ambient);
				expect(physicalAmbientAfter.data[0].numberValue).toBe(18);
				expect(physicalAmbientAfter.data).toStrictEqual(physicalAmbientHistory.data);
				const settingHistory: Record<string, unknown> = {};
				for (const setting of settings) {
					const rows = await storage.queryStrict(
						`SELECT * FROM property_value WHERE propertyId = '${setting.property}' ORDER BY time ASC`,
					);
					expect(rows.length).toBeGreaterThan(0);
					settingHistory[setting.setting] = rows;
				}
				const observation = {
					nativeQueryEventWindows: proofWindows,
					physicalAmbientHistory,
					physicalAmbientAfter,
					settingHistory,
					primaryAvailable: storage.isPrimaryAvailable(),
					fallback: storage.isUsingFallback(),
					qualification:
						'Native query event interval only; not TypeORM async afterQuery joining or all M1/M2 destination fencing. Ordinary hydration cache/producer effects remain inherited.',
				};
				console.info('actual-storage-catalog-observation', JSON.stringify(observation));
				if (process.env.P05B1B_TEST_ARTIFACT_DIR)
					writeFileSync(
						path.join(
							process.env.P05B1B_TEST_ARTIFACT_DIR,
							`storage-${storage.isUsingFallback() ? 'memory' : 'influx'}.json`,
						),
						JSON.stringify(observation),
					);
			}

			if (failure === 'none' && !interleave?.expectedFallback) {
				const setpoint = settings.find(
					(entry) => entry.setting === (hasHeating ? 'heating_setpoint' : 'cooling_setpoint'),
				);
				expect(
					result.device.channels.flatMap((entry) => entry.properties).find((entry) => entry.id === setpoint.property)
						.value.value,
				).toBe(hasHeating ? 20 : 25);
				const information = result.device.channels.find(
					(entry) => entry.category === (ChannelCategory.DEVICE_INFORMATION as string),
				);
				for (const category of [PropertyCategory.MANUFACTURER, PropertyCategory.MODEL, PropertyCategory.SERIAL_NUMBER])
					expect(information.properties.find((entry) => entry.category === category).value).toBeNull();
			}
			expect(catalogJobs).toBe(device.channels.reduce((count, entry) => count + entry.properties.length, 0));
			expect(result.device.id).toBe(device.id);
			expect(result.configuration).toMatchObject({
				controller: device.id,
				revision: 1,
				readiness: 'draft',
				requested_mode: 'off',
			});
			for (const expected of device.channels) {
				const storedChannel = await dataSource.manager.findOneOrFail(ChannelEntity, {
					where: { id: expected.id },
					relations: ['device'],
				});
				expect((storedChannel.device as DeviceEntity).id).toBe(device.id);
				for (const expectedProperty of expected.properties) {
					const stored = await dataSource.manager.findOneOrFail(ChannelPropertyEntity, {
						where: { id: expectedProperty.id },
						relations: ['channel'],
					});
					expect((stored.channel as ChannelEntity).id).toBe(expected.id);
					expect(stored.permissions).toEqual([
						settings.some((setting) => setting.property === stored.id)
							? PermissionType.READ_WRITE
							: PermissionType.READ_ONLY,
					]);
				}
			}
			expect(
				await dataSource.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: device.id }),
			).toMatchObject({ revision: 1, requestedMode: 'off' });
			expect(
				await dataSource.manager.findBy(VirtualThermostatActuatorClaimEntity, { controllerId: device.id }),
			).toEqual([
				...(hasHeating
					? [
							expect.objectContaining({
								physicalIdentity: `shelly-ng:${canonicalMac}:switch:0:output`,
								sourcePropertyId: relay,
								state: 'reserved',
								revision: 1,
							}) as unknown,
						]
					: []),
				...(hasCooling
					? [
							expect.objectContaining({
								physicalIdentity: `shelly-ng:${coolingMac}:switch:0:output`,
								sourcePropertyId: coolingRelay,
								state: 'reserved',
								revision: 1,
							}) as unknown,
						]
					: []),
			]);
			expect({
				sources: await dataSource.manager.countBy(VirtualThermostatSourceEntity, { controllerId: device.id }),
			}).toEqual({ sources: 1 });
			expect(await dataSource.manager.countBy(VirtualThermostatSettingEntity, { controllerId: device.id })).toBe(
				settings.length,
			);
			// This one-branch default does not require an explicit floor or cooled-surface dependency.
			expect(await dataSource.manager.count(ThermostatMemberProtectionEntity)).toBe(hasFloor ? 1 : 0);
			expect(await dataSource.manager.count(ThermostatCoolingDependencyEntity)).toBe(hasCooling ? 1 : 0);
			// The creating transaction increments once; ordinary asynchronous status writes retain their legacy graph path.
			expect(result.configuration.graph_revision).toBe(revision + 1);
			expect(await graph.revision()).toBe(
				revision +
					1 +
					legacyWrites.mock.calls.length +
					(interleave?.foreignGraphWrites?.() ?? 0) -
					foreignGraphBaseline,
			);
			expect(moduleRef.get(ClimateAutomationRegistryService).captureProvider('virtual-thermostat:v1')).toBeNull();
		}
	} catch (cause: unknown) {
		rejection = { cause };
	} finally {
		for (const cleanup of restore.reverse()) {
			try {
				cleanup();
			} catch (cause: unknown) {
				// Attempt every owned cleanup while retaining the exact first failure, including falsy causes.
				rejection ??= { cause };
			}
		}
	}
	if (rejection) throw rejection.cause;
	return { publicRequest, device, settings };
}

describe('devices-virtual plugin (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;
	let moduleRef: TestingModule;
	let dataSource: DataSource;
	let valueSourceRegistry: PropertyValueSourceRegistryService;
	let virtualPropertyIndex: VirtualPropertyIndexService;

	beforeAll(async () => {
		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [],
		});

		const moduleFixture = await Test.createTestingModule({
			imports: [dynamicAppModule],
		}).compile();

		app = moduleFixture.createNestApplication();

		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize
		await new Promise((resolve) => setTimeout(resolve, 100));

		moduleRef = moduleFixture;
		dataSource = moduleFixture.get<DataSource>(DataSource);
		valueSourceRegistry = moduleFixture.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);
		virtualPropertyIndex = moduleFixture.get<VirtualPropertyIndexService>(VirtualPropertyIndexService);

		// Register and login to obtain an access token
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: {
					username: 'virtualdevicestest',
					password: 'securePassword123!',
					email: 'virtualdevicestest@example.com',
				},
			});

		const loginResponse = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: {
					username: 'virtualdevicestest',
					password: 'securePassword123!',
				},
			});

		const loginBody = loginResponse.body as { data?: { access_token?: string } };

		if (!loginBody.data?.access_token) {
			throw new Error(
				`E2E setup failed: login returned status ${loginResponse.status} — ${JSON.stringify(loginResponse.body)}`,
			);
		}

		accessToken = loginBody.data.access_token;
	}, 60_000);

	afterAll(async () => {
		await app.close();
	});

	it('boots the dormant ownership core through the real module and entity discovery without registering climate authority', async () => {
		const registry = moduleRef.get(ClimateAutomationRegistryService);
		const ledger = moduleRef.get(ClimateAutomationLedgerService);
		await expect(
			ledger.runReserved(async (manager, scope) => {
				expect((await ledger.readSource(manager, scope, 'activity:v1', 'boot-probe')).facts).toBeNull();
			}),
		).resolves.toEqual({ outcome: 'committed' });
		expect(registry.captureProvider('virtual-thermostat:v1')).toBeNull();
		for (const key of ['activity:v1', 'schedule:v1', 'presence:v1']) {
			expect(registry.captureProducer(key)).toBeNull();
		}
		expect(dataSource.hasMetadata(ClimateAutomationSourceEntity)).toBe(true);
		expect(dataSource.hasMetadata(ClimateAutomationSlotEntity)).toBe(true);
		expect(await dataSource.getRepository(ClimateAutomationSourceEntity).count()).toBe(0);
		expect(await dataSource.getRepository(ClimateAutomationSlotEntity).count()).toBe(0);
	});

	it.each([
		{ replaceBeforeCreate: true, variant: 'heating', failure: 'none' },
		{ replaceBeforeCreate: false, variant: 'heating', failure: 'none' },
	])('uses the actual AppModule POST with complete wire parity: %j', async (scenario) => {
		await verifyThermostatWire({ app, moduleRef, dataSource, accessToken }, scenario);
	});

	// Helper to make authenticated requests
	function authGet(path: string) {
		return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authPost(path: string) {
		return request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authPatch(path: string) {
		return request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${accessToken}`);
	}

	function authDelete(path: string) {
		return request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${accessToken}`);
	}

	// ─── Full lifecycle, against a real simulator device as the source ─────────────────

	describe('virtual device lifecycle', () => {
		let sourceDeviceId: string;
		let sourceChannelId: string;
		let sourceOnPropertyId: string;
		let sourceInUsePropertyId: string;
		let sourceSecondaryOnPropertyId: string;
		let sourceSecondaryChannelId: string;

		let virtualDeviceId: string;
		let lightChannelId: string;
		let lightOnPropertyId: string;

		it('creates a simulator source device with an outlet channel (the relay)', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Source Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: false,
									},
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.IN_USE,
										identifier: 'in_use',
										name: 'In use',
										permissions: [PermissionType.READ_ONLY],
										data_type: DataTypeType.BOOL,
										value: false,
									},
								],
							},
							// A second relay on the same physical device — `outlet` is `multiple` for this
							// category. The orphaning test needs a source it can delete without disturbing
							// `sourceOnPropertyId`, and it has to be writable: the slot it feeds is `light.on`,
							// which requires a writable source, so the read-only `in_use` it used to borrow is
							// refused now that compatibility is enforced at persistence.
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet-secondary',
								name: 'Outlet 2',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: false,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			sourceDeviceId = body.data.id;

			// ChannelBody carries no identifier, and both relays share the `outlet` category, so they are
			// told apart by content: only the first was given an `in_use` property.
			const outletChannels = body.data.channels.filter(
				(channel) => channel.category === String(ChannelCategory.OUTLET),
			);
			const primaryChannel = outletChannels.find((channel) =>
				channel.properties.some((property) => property.category === PropertyCategory.IN_USE),
			);
			const secondaryChannel = outletChannels.find(
				(channel) => !channel.properties.some((property) => property.category === PropertyCategory.IN_USE),
			);

			expect(primaryChannel).toBeDefined();
			expect(secondaryChannel).toBeDefined();

			sourceChannelId = primaryChannel.id;
			sourceSecondaryChannelId = secondaryChannel.id;

			const sourceProperties = primaryChannel.properties;

			sourceOnPropertyId = sourceProperties.find((property) => property.category === PropertyCategory.ON)?.id ?? '';
			sourceInUsePropertyId =
				sourceProperties.find((property) => property.category === PropertyCategory.IN_USE)?.id ?? '';
			sourceSecondaryOnPropertyId =
				secondaryChannel.properties.find((property) => property.category === PropertyCategory.ON)?.id ?? '';

			expect(sourceSecondaryOnPropertyId).toBeTruthy();

			expect(sourceDeviceId).toBeTruthy();
			expect(sourceOnPropertyId).toBeTruthy();
			expect(sourceInUsePropertyId).toBeTruthy();
		});

		// ─── Step 1: virtual device + light channel + on property linked to the source ───

		it('creates a virtual device with category lighting', async () => {
			const information = moduleRef.get<VirtualDeviceInformationListener>(VirtualDeviceInformationListener);
			const synthesize = information.handleDeviceCreated.bind(
				information,
			) as VirtualDeviceInformationListener['handleDeviceCreated'];
			let synthesis: Promise<void> | undefined;
			const listener = jest.spyOn(information, 'handleDeviceCreated').mockImplementation((device) => {
				synthesis = synthesize(device);
				return synthesis;
			});

			try {
				const response = await authPost('/modules/devices/devices')
					.send({
						data: {
							type: DEVICES_VIRTUAL_TYPE,
							category: DeviceCategory.LIGHTING,
							name: 'E2E Virtual Light',
						},
					})
					.expect(201);

				const body = response.body as { data: DeviceBody };

				virtualDeviceId = body.data.id;

				expect(body.data.type).toBe(DEVICES_VIRTUAL_TYPE);
				expect(body.data.category).toBe(DeviceCategory.LIGHTING);
				// Await the real DEVICE_CREATED listener, including its later metadata graph writes.
				// Merely observing LOCAL status does not mean those fire-and-forget writes have finished.
				expect(synthesis).toBeDefined();
				await synthesis;
			} finally {
				listener.mockRestore();
			}
		});

		// Regression test for every virtual device being permanently uncommandable. The `status`
		// property under device_information is synthesized by DeviceConnectivityService — generic module
		// code with no `value_origin` to give — so on a virtual device it took the SOURCE column default
		// with a null source: verbatim VirtualPropertyIndexService's definition of an ORPHAN. Once the
		// device had any linked property, the next source connection change made
		// VirtualStatusListener.aggregateState() return DISCONNECTED however healthy the real sources
		// were, and PropertyCommandService rejects every command against an offline device. The property
		// is owned by the virtual device and projected from nowhere, so it must be `local`.
		it('synthesizes the connection state property as owned, not as an orphaned projection', async () => {
			// VirtualDeviceInformationListener runs fire-and-forget off DEVICE_CREATED, so poll rather
			// than assume the synthesis finished before the POST above returned.
			const statusProperty = await waitUntil(async () => {
				const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`);

				if (response.status !== 200) {
					return { done: false, value: null };
				}

				const body = response.body as { data: DeviceBody };

				const informationChannel = body.data.channels.find(
					(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
				);

				const property = informationChannel?.properties.find(
					(candidate) => candidate.category === PropertyCategory.STATUS,
				);

				return { done: property?.value_origin === 'local', value: property ?? null };
			}, 'the synthesized connection state property becoming local');

			expect(statusProperty?.value_origin).toBe('local');
			// Owned means owned outright: `local` with a lingering source_property would still be read
			// through the source registry.
			expect(statusProperty?.source_property).toBeNull();
		});

		it('adds a light channel to the virtual device', async () => {
			const response = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light-main',
						name: 'Main Light',
						device: virtualDeviceId,
					},
				})
				.expect(201);

			const body = response.body as { data: ChannelBody };

			lightChannelId = body.data.id;

			expect(body.data.category).toBe(ChannelCategory.LIGHT);
		});

		it("adds an on property linked to the simulator's relay on", async () => {
			const response = await authPost(`/modules/devices/channels/${lightChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: sourceOnPropertyId,
					},
				})
				.expect(201);

			const body = response.body as { data: ChannelPropertyBody };

			lightOnPropertyId = body.data.id;

			expect(body.data.source_property).toBe(sourceOnPropertyId);
			expect(body.data.value_origin).toBe('source');
		});

		// ─── The configuration-time write guard ─────────────────────────────────────────
		//
		// The mirror of the data-loss guard asserted at the end of this block. `value` is inherited from
		// the generic create DTO, and `ChannelsPropertiesService.create()` writes it through
		// `PropertyValueService`, which for a linked property resolves the storage key to the *source's*
		// id — so the number would be persisted as a real measurement of a device that was never
		// commanded and never reported it. Unlike the PATCH path there is no command dispatch behind a
		// POST at all, so the value could only ever have been that fabrication.
		//
		// Linked against `in_use` rather than the relay, so this test cannot disturb the value the
		// lifecycle steps around it assert on. A refused create persists nothing, so no property is
		// added to the virtual device either.
		it("refuses a value supplied when linking a property, leaving the source's series untouched", async () => {
			const before = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceInUsePropertyId}`,
			).expect(200);
			const beforeBody = (before.body as { data: ChannelPropertyBody }).data;

			expect(beforeBody.value?.value).toBe(false);

			const response = await authPost(`/modules/devices/channels/${lightChannelId}/properties`).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: PropertyCategory.IN_USE,
					identifier: 'in_use',
					name: 'In use',
					permissions: [PermissionType.READ_ONLY],
					data_type: DataTypeType.BOOL,
					source_property: sourceInUsePropertyId,
					value: true,
				},
			});

			expect(response.status).toBe(422);

			// The source's stored series — its latest value, and the timestamp that would have moved had
			// a point been written — is exactly what it was. This is the assertion that matters: a
			// rejection alone would not prove the write never reached the source.
			const after = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceInUsePropertyId}`,
			).expect(200);
			const afterBody = (after.body as { data: ChannelPropertyBody }).data;

			expect(afterBody.value?.value).toBe(false);
			expect(afterBody.value?.last_updated).toBe(beforeBody.value?.last_updated);

			// And nothing was half-created: the refused property is not on the channel.
			const channelProperties = await authGet(`/modules/devices/channels/${lightChannelId}/properties`).expect(200);

			expect(
				(channelProperties.body as { data: ChannelPropertyBody[] }).data.map((property) => property.category),
			).not.toContain(PropertyCategory.IN_USE);
		});

		// ─── Step 2: GET returns the value read from the source ──────────────────────────

		it('GET /devices/:id returns the virtual device with the value read from the source', async () => {
			const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);

			const body = response.body as { data: DeviceBody };
			const channel = body.data.channels.find((candidate) => candidate.id === lightChannelId);
			const property = channel?.properties.find((candidate) => candidate.id === lightOnPropertyId);

			expect(property).toBeDefined();
			expect(property?.source_property).toBe(sourceOnPropertyId);
			// The source property was created with an initial value of `false` — this is the
			// dereferencing path (PropertyValueSourceRegistryService via the STI-hydrated entity)
			// actually resolving to the source's stored value, not the virtual property's own
			// (never-written) series.
			if (property?.value?.value !== false) {
				// Diagnostic only: retain the original failed HTTP observation without issuing another read.
				process.stderr.write(
					`Virtual source value mismatch: ${JSON.stringify({
						sourceDeviceId,
						sourceChannelId,
						sourceOnPropertyId,
						virtualDeviceId,
						lightChannelId,
						lightOnPropertyId,
						propertyPresent: property !== undefined,
						property: property && {
							id: property.id,
							type: property.type,
							data_type: property.data_type,
							value_origin: property.value_origin,
							source_property: property.source_property,
							value: property.value && {
								value: property.value.value,
								last_updated: property.value.last_updated,
								trend: property.value.trend,
								producer: property.value.producer && {
									quality: property.value.producer.quality,
									reasons: property.value.producer.reasons,
									sampled_at: property.value.producer.sampled_at,
									evaluated_at: property.value.producer.evaluated_at,
									expires_at: property.value.producer.expires_at,
									revision: property.value.producer.revision,
								},
							},
						},
					})}\n`,
				);
			}
			expect(property?.value?.value).toBe(false);
		});

		// ─── Step 3: commanding the virtual property changes the source ──────────────────

		/**
		 * The state the whole command path below runs in, and a regression test for follow-up 2.12.
		 *
		 * The simulator plugin is disabled by default and so never reports a connection state, which
		 * makes this source exactly the common case: `DeviceConnectionStateService.readLatest()` answers
		 * `{online: false, status: UNKNOWN}` for it — as it does for *every* source on a fresh install,
		 * right after a restart, or whenever storage is unavailable.
		 *
		 * `aggregateState()` used to collapse that into DISCONNECTED, and PropertyCommandService refuses
		 * every command against a device that is definitively offline — so the virtual device rendered
		 * fine, showed plausible values read straight through from the source, and silently refused
		 * every command, while VirtualDevicePlatform (which applies the same UNKNOWN-is-commandable rule
		 * to the source) would have forwarded happily had it ever been asked. UNKNOWN now propagates
		 * instead, which is both what is true and what keeps the device commandable.
		 *
		 * The aggregation is awaited directly rather than polled over HTTP. `ThrottlerGuard` keys its
		 * `30 req / 60s` budget per client *and route handler*, and every request in this file comes from
		 * the same loopback address inside a single 60-second window — so a poll of `GET /devices/:id`
		 * spends a budget eight other tests here already share, and exhausting it 429s everything
		 * downstream rather than failing anything locally. `recompute()` is the exact call the
		 * fire-and-forget handlers make, so awaiting it is both cheaper and more deterministic.
		 */
		it('reports unknown, not disconnected, while its source has never reported a connection state', async () => {
			const statusListener = moduleRef.get<VirtualStatusListener>(VirtualStatusListener);

			// aggregateState() reads the index, so the link has to be in it before the recompute can see
			// the source at all. Polled off the service, without HTTP, exactly as elsewhere in this file.
			await waitForIndexedLink(virtualPropertyIndex, virtualDeviceId);

			await statusListener.recompute(virtualDeviceId, 'e2e: aggregating over a source that never reported');

			const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const status = (response.body as { data: DeviceBody }).data.status;

			expect(status.status).toBe(ConnectionState.UNKNOWN);
			// UNKNOWN is not online — the point is precisely that `online: false` alone must stop meaning
			// "definitively offline", not that the device pretends to be up.
			expect(status.online).toBe(false);
		});

		it("commanding the virtual property changes the source property's value", async () => {
			// Proves the *forward* rather than only its outcome. The value assertion below is necessary
			// but was not sufficient on its own: it passed for the wrong reason for as long as
			// `ChannelsPropertiesService.update()` dereferenced a projected write into the source's own
			// series, which moved the source's value whether or not any command was ever dispatched.
			// Spying on the source device's own platform closes that gap directly — the simulator
			// platform is the last hop, reached only via PropertyCommandService -> VirtualDevicePlatform
			// -> PlatformRegistryService, so a call here cannot have come from anywhere else.
			const simulatorPlatform = moduleRef.get<SimulatorDevicePlatform>(SimulatorDevicePlatform, { strict: false });
			const forwarded = jest.spyOn(simulatorPlatform, 'processBatch');

			try {
				// `type` is required on the update DTO too (UpdateVirtualChannelPropertyDto.type has no
				// @IsOptional — the same pattern every plugin's update DTO uses), so it must be sent even
				// though only `value` is actually changing.
				await authPatch(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`)
					.send({ data: { type: DEVICES_VIRTUAL_TYPE, value: true } })
					.expect(200);

				// The PATCH handler's command forward to the source device's own platform is
				// fire-and-forget, so poll rather than assume the write already landed the instant the
				// HTTP response returned.
				const sourceValue = await waitUntil(async () => {
					const response = await authGet(
						`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
					);
					const body = response.body as { data: ChannelPropertyBody };

					return { done: body.data.value?.value === true, value: body.data.value?.value ?? null };
				}, 'the command reaching the source property');

				expect(sourceValue).toBe(true);

				// The source's platform was asked to move the source's own property to the commanded
				// value — the device, channel and property in the forwarded batch are all the *source's*,
				// which is what "the command reached the source" means. Read off `mock.calls` and reduced
				// to plain ids rather than asserted with nested `expect.objectContaining`, which returns
				// `any` and would need the unsafe-assignment rule silenced to nest at all.
				const forwardedBatches = forwarded.mock.calls.map(([updates]) =>
					updates.map((update) => ({
						deviceId: update.device.id,
						channelId: update.channel.id,
						propertyId: update.property.id,
						value: update.value,
					})),
				);

				expect(forwardedBatches).toContainEqual([
					{
						deviceId: sourceDeviceId,
						channelId: sourceChannelId,
						propertyId: sourceOnPropertyId,
						value: true,
					},
				]);
			} finally {
				forwarded.mockRestore();
			}

			// The virtual property reads the same, shared value back too.
			const virtualResponse = await authGet(
				`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`,
			).expect(200);
			const virtualBody = virtualResponse.body as { data: ChannelPropertyBody };

			expect(virtualBody.data.value?.value).toBe(true);
		});

		/**
		 * The other end of the aggregation, so the UNKNOWN case above cannot pass by the rule simply
		 * never reporting CONNECTED: once the source's integration does report, the virtual device
		 * follows it up.
		 *
		 * Driven through DeviceConnectivityService rather than an endpoint because there is none — a
		 * device's connection state is written by its integration, not by the API. This models the
		 * integration. Awaited directly rather than polled for the same throttler-budget reason as above.
		 */
		it('reports connected once its source integration reports connected', async () => {
			const connectivity = moduleRef.get<DeviceConnectivityService>(DeviceConnectivityService);
			const statusListener = moduleRef.get<VirtualStatusListener>(VirtualStatusListener);

			await connectivity.setConnectionState(sourceDeviceId, {
				state: ConnectionState.CONNECTED,
				reason: 'e2e: standing in for the source integration',
			});

			await statusListener.recompute(virtualDeviceId, 'e2e: standing in for the source integration');

			const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const status = (response.body as { data: DeviceBody }).data.status;

			expect(status.status).toBe(ConnectionState.CONNECTED);
			expect(status.online).toBe(true);
		});

		// ─── The same guard on the PATCH path, where the value is a real command ─────────
		//
		// A PATCH carrying a value is not refused the way a POST is: both property controllers dispatch
		// it to the device's platform straight afterwards, and for a virtual device that platform
		// forwards it to the source's — so the request is coherent and rejecting it would remove the
		// only way to command a virtual device over REST (the step above depends on it). What must not
		// happen is the *optimistic echo* landing in the source's series before, or instead of, the
		// hardware confirming anything.
		//
		// Disabling the virtual device is what makes that observable: VirtualDevicePlatform refuses to
		// forward for a disabled device, so nothing downstream can write the value, and any change to
		// the source's series could only have come from the echo.
		it("does not write a commanded value into the source's series when the command is refused", async () => {
			await authPatch(`/modules/devices/devices/${virtualDeviceId}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, enabled: false } })
				.expect(200);

			try {
				// The relay is `true` from the step above; command the opposite, so an echo is impossible
				// to confuse with the value already there.
				await authPatch(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`)
					.send({ data: { type: DEVICES_VIRTUAL_TYPE, value: false } })
					.expect(200);

				// The command forward is fire-and-forget, so give it comfortably longer than the refusal
				// takes before concluding the source was left alone.
				await new Promise((resolve) => setTimeout(resolve, 750));

				const source = await authGet(
					`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
				).expect(200);

				expect((source.body as { data: ChannelPropertyBody }).data.value?.value).toBe(true);
			} finally {
				await authPatch(`/modules/devices/devices/${virtualDeviceId}`)
					.send({ data: { type: DEVICES_VIRTUAL_TYPE, enabled: true } })
					.expect(200);
			}
		});

		// ─── Additional coverage 3: the source-device read resolves the live wiring ──────

		it('lists the source device behind a virtual device, resolved live from the wiring', async () => {
			// GET .../devices/:id/source-devices (VirtualDevicesService.findSourceDevices) walks
			// property -> sourceProperty -> channel -> device in the database on every call
			// (VirtualPropertyIndexService.loadLinksByVirtualDevice), then loads each distinct source
			// device by id so the caller gets a current connection status rather than a cached one.
			//
			// It deliberately does *not* read the in-memory index maps. Those only catch up once
			// VirtualIndexMaintenanceListener's fire-and-forget rebuild has run, and no mutation
			// response waits for it — so a client that had just linked, remapped or unlinked a property
			// could be handed the wiring from before its own write. The maps stay for the two consumers
			// that genuinely need an O(1), no-I/O answer on system-wide per-event traffic (the
			// projection and connection-status listeners); this is a once-per-request read of a single
			// device, where a query is the cheaper mistake to make.
			//
			// This whole chain was created over HTTP in the tests above, after a boot whose one-time
			// hydration ran against an empty database — so the relations resolved here are the ones
			// those requests wrote.
			const response = await authGet(`/plugins/devices-virtual/devices/${virtualDeviceId}/source-devices`).expect(200);
			const body = response.body as { data: DeviceBody[] };

			expect(body.data.map((device) => device.id)).toContain(sourceDeviceId);
		});

		// Regression test for the same route accepting any device that merely exists. The simulator
		// device below is a real, ordinary physical device with no linked virtual properties of its own,
		// so an existence-only check let it through to a 200 with `data: []` — the identical response a
		// genuine virtual device assembled purely from owned properties gives, which made "this device
		// draws from nothing" and "you asked the wrong kind of question" indistinguishable to a client.
		// 422 rather than 404 because the device demonstrably exists; see the controller for the
		// codebase precedent that split follows.
		it('rejects a non-virtual device on the source-devices route instead of reporting no sources', async () => {
			await authGet(`/plugins/devices-virtual/devices/${sourceDeviceId}/source-devices`).expect(422);
		});

		// ─── Additional coverage 1: STI hydration through the BASE repository ────────────

		it('resolves a linked property loaded through the BASE ChannelPropertyEntity repository (STI hydration)', async () => {
			// The child (VirtualChannelPropertyEntity) repository would trivially prove nothing here —
			// TypeORM is guaranteed to hydrate correctly when you already tell it which subclass to
			// use. The whole point is that PropertyValueService reaches properties through the generic,
			// type-unaware base repository (ChannelsPropertiesService.findOne with no `type` argument),
			// so that is exactly what must be exercised here.
			const baseRepository = dataSource.getRepository(ChannelPropertyEntity);

			const reloaded = await baseRepository.findOne({ where: { id: lightOnPropertyId } });

			expect(reloaded).not.toBeNull();
			expect(reloaded).toBeInstanceOf(VirtualChannelPropertyEntity);

			// This is the registry call PropertyValueService.write/readLatest/delete makes internally.
			// If STI hydration had silently produced a base ChannelPropertyEntity instead, `instanceof
			// VirtualChannelPropertyEntity` would be false, VirtualValueSourceService.resolve() would
			// return null, and this would resolve to the property's own id instead of the source's.
			expect(valueSourceRegistry.resolve(reloaded)).toBe(sourceOnPropertyId);
		});

		// ─── The `hidden` flag on the replaced source device ────────────────────────────

		it('hides the source device the virtual device replaces, and keeps it hidden across later edits', async () => {
			// The design's "optionally hide the source device" (see the spec's DeviceEntity.hidden
			// section). Until `hidden` was exposed on the update DTO there was no way to set it at all,
			// so `?hidden=true` could only ever return an empty list.
			await authPatch(`/modules/devices/devices/${sourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, hidden: true } })
				.expect(200);

			const hiddenList = await authGet('/modules/devices/devices?hidden=true').expect(200);

			expect((hiddenList.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(sourceDeviceId);

			const visibleList = await authGet('/modules/devices/devices?hidden=false').expect(200);

			expect((visibleList.body as { data: DeviceBody[] }).data.map((device) => device.id)).not.toContain(
				sourceDeviceId,
			);

			// The half that a unit test cannot show end to end: an unrelated PATCH must not silently
			// un-hide it. DeviceEntity.hidden carries no class field initializer precisely so that
			// `omitBy(toInstance(...), isUndefined)` yields no `hidden` key for a patch that omits it.
			await authPatch(`/modules/devices/devices/${sourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, name: 'Renamed Source' } })
				.expect(200);

			const reloaded = await authGet(`/modules/devices/devices/${sourceDeviceId}`).expect(200);

			expect((reloaded.body as { data: DeviceBody }).data.hidden).toBe(true);

			// Unhide again so the remaining lifecycle steps see the source exactly as they did before.
			await authPatch(`/modules/devices/devices/${sourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, hidden: false } })
				.expect(200);
		});

		// ─── Owned properties stay owned across an unrelated PATCH ──────────────────────

		it('keeps a synthesized device_information property owned when it is renamed', async () => {
			// VirtualDeviceInformationListener synthesizes manufacturer / model / serial_number as
			// `local` (owned) properties. A PATCH that only renames one must not flip it to `source`:
			// that would make it a projection with no source — an orphan — and lose its stored value.
			// VirtualChannelPropertyEntity.valueOrigin carries no class field initializer for exactly
			// this reason.
			const deviceResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };

			const informationChannel = deviceBody.data.channels.find(
				(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
			);

			expect(informationChannel).toBeDefined();

			const manufacturer = informationChannel?.properties.find(
				(property) => property.category === PropertyCategory.MANUFACTURER,
			);

			expect(manufacturer?.value_origin).toBe('local');

			const patched = await authPatch(
				`/modules/devices/channels/${informationChannel?.id}/properties/${manufacturer?.id}`,
			)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, name: 'Vendor' } })
				.expect(200);

			const patchedBody = patched.body as { data: ChannelPropertyBody };

			expect(patchedBody.data.value_origin).toBe('local');
			expect(patchedBody.data.value?.value).toBe('FastyBird');
		});

		// ─── A partial PATCH cannot merge into `local` + a source ───────────────────────
		//
		// The one (value_origin, source_property) pair VirtualChannelPropertyEntity's state model has
		// no state for. `ValidateOwnedPropertyHasNoSource` on the DTO rejects it when both halves are
		// in one payload, but a PATCH carrying only one half validates perfectly on its own and only
		// becomes that pair once ChannelsPropertiesService.update() merges it into the stored row —
		// producing a property that neither mirrors (VirtualValueSourceService resolves an owned
		// property to its own key) nor forwards (it is not in the index, so VirtualDevicePlatform
		// refuses the write). Both directions are checked, and each asserts the row is *unchanged*
		// rather than merely that the request failed.

		it('rejects switching a linked property to local without dropping its source', async () => {
			await authPatch(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, value_origin: 'local' } })
				.expect(422);

			const response = await authGet(`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`);
			const body = response.body as { data: ChannelPropertyBody };

			expect(body.data.value_origin).toBe('source');
			expect(body.data.source_property).toBe(sourceOnPropertyId);
		});

		it('rejects giving an owned property a source without dropping its local origin', async () => {
			const deviceResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };

			const informationChannel = deviceBody.data.channels.find(
				(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
			);
			const manufacturer = informationChannel?.properties.find(
				(property) => property.category === PropertyCategory.MANUFACTURER,
			);

			expect(manufacturer?.value_origin).toBe('local');

			await authPatch(`/modules/devices/channels/${informationChannel?.id}/properties/${manufacturer?.id}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, source_property: sourceOnPropertyId } })
				.expect(422);

			const response = await authGet(
				`/modules/devices/channels/${informationChannel?.id}/properties/${manufacturer?.id}`,
			);
			const body = response.body as { data: ChannelPropertyBody };

			expect(body.data.value_origin).toBe('local');
			expect(body.data.source_property).toBeNull();
			// The stored value survives too: had the source landed, the property would have started
			// reading the relay's series instead of its own synthesized one.
			expect(body.data.value?.value).toBe('FastyBird');
		});

		it('still rejects both halves in one payload, at the DTO layer', async () => {
			const rejected = await authPatch(
				`/modules/devices/channels/${lightChannelId}/properties/${lightOnPropertyId}`,
			).send({
				data: { type: DEVICES_VIRTUAL_TYPE, value_origin: 'local', source_property: sourceOnPropertyId },
			});

			expect(rejected.status).toBe(400);
			expect(JSON.stringify(rejected.body)).toContain('an owned property stores its own value');
		});

		// ─── Step 4: deleting the source orphans the (still-required) property ───────────

		it('orphans a required property instead of breaking the device when its source is deleted', async () => {
			// A second `light` channel instance (the light channel category allows `multiple`), linked
			// to a *different* source property than the one used above and below — so orphaning it here
			// cannot interfere with the data-loss guard assertion, which needs `sourceOnPropertyId` to
			// still exist and still hold the value written in step 3.
			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light-secondary',
						name: 'Secondary Light',
						device: virtualDeviceId,
					},
				})
				.expect(201);

			const secondaryChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			const propertyResponse = await authPost(`/modules/devices/channels/${secondaryChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: sourceSecondaryOnPropertyId,
					},
				})
				.expect(201);

			const secondaryPropertyBody = propertyResponse.body as { data: ChannelPropertyBody };
			const secondaryPropertyId = secondaryPropertyBody.data.id;

			expect(secondaryPropertyBody.data.source_property).toBe(sourceSecondaryOnPropertyId);

			// Delete the source property directly (not through the virtual device).
			await authDelete(
				`/modules/devices/channels/${sourceSecondaryChannelId}/properties/${sourceSecondaryOnPropertyId}`,
			).expect(204);

			// The virtual device — and its property — survive. Graceful degradation, not breakage.
			const deviceResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };
			const secondaryChannel = deviceBody.data.channels.find((candidate) => candidate.id === secondaryChannelId);
			const secondaryProperty = secondaryChannel?.properties.find((candidate) => candidate.id === secondaryPropertyId);

			expect(secondaryProperty).toBeDefined();
			// The FK's ON DELETE SET NULL fired: the property still exists, but no longer points at a
			// source. It was NOT switched to a `local` value_origin — it stays a dangling `source`
			// projection until a client remaps it (VirtualChannelPropertyEntity.isOrphaned).
			expect(secondaryProperty?.source_property).toBeNull();
			expect(secondaryProperty?.value_origin).toBe('source');

			// DeviceValidationService.validateChannelProperties() is a generic, category-presence
			// check: it asks "does a property of category `on` exist on this channel", not "can this
			// property currently produce a value". An orphaned property still structurally exists, so
			// no MISSING_PROPERTY issue is raised for it — this is the actual, current behavior, not
			// the brief's original guess; see the task report for the full analysis of why the two
			// diverge and whether that's worth a follow-up.
			const validationResponse = await authGet(`/modules/devices/devices/${virtualDeviceId}/validation`).expect(200);
			const validationBody = validationResponse.body as { data: DeviceValidationBody };

			const missingPropertyIssues = validationBody.data.issues.filter(
				(issue) => issue.type === 'missing_property' && issue.channel_id === secondaryChannelId,
			);

			expect(missingPropertyIssues).toEqual([]);

			// Regression test for a virtual device staying reported as connected with nothing behind it.
			// The orphan above invalidates the device's aggregated state — aggregateState() degrades on
			// any orphaned link — but no DEVICE_CONNECTION_CHANGED event was involved in a property
			// deletion, and VirtualStatusListener runs on nothing else. The structural rebuild that
			// recorded the orphan is now what triggers the recompute, which is the only signal that can
			// reach a device whose last source is gone: such a device has dropped out of the source-device
			// reverse index entirely, so no connection event can ever select it again.
			const status = await waitUntil(async () => {
				const response = await authGet(`/modules/devices/devices/${virtualDeviceId}`);

				if (response.status !== 200) {
					return { done: false, value: null };
				}

				const body = response.body as { data: DeviceBody };

				return { done: body.data.status.online === false, value: body.data.status };
			}, 'the virtual device degrading to disconnected after its source property was deleted');

			expect(status.online).toBe(false);
			expect(status.status).toBe('disconnected');
		});

		// ─── Step 5 / additional coverage 2: the data-loss guard ─────────────────────────

		it('does not delete the source device history when the virtual device is deleted (data-loss guard)', async () => {
			// Confirm the source still reads the value written back in step 3, before touching anything.
			const before = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
			).expect(200);

			expect((before.body as { data: ChannelPropertyBody }).data.value?.value).toBe(true);

			await ensureDeviceDeleted(authGet, authDelete, virtualDeviceId);

			// The virtual device is gone.
			await authGet(`/modules/devices/devices/${virtualDeviceId}`).expect(404);

			// The source device is untouched, and its property's value — the source's entire history,
			// as far as this test can observe it — still reads back exactly as it did before the
			// virtual device (and its now-deleted projecting property) ever existed. If
			// PropertyValueService.delete() dereferenced instead of guarding, deleting the virtual
			// device would have deleted the virtual property, which would have deleted the *source's*
			// series out from under it.
			const sourceDeviceResponse = await authGet(`/modules/devices/devices/${sourceDeviceId}`).expect(200);

			expect((sourceDeviceResponse.body as { data: DeviceBody }).data.id).toBe(sourceDeviceId);

			const after = await authGet(
				`/modules/devices/channels/${sourceChannelId}/properties/${sourceOnPropertyId}`,
			).expect(200);

			expect((after.body as { data: ChannelPropertyBody }).data.value?.value).toBe(true);
		});
	});

	// ─── Additional coverage 4: creation-time guards ────────────────────────────────────

	describe('creation guards', () => {
		it('rejects creating a virtual device with a blocked category', async () => {
			const response = await authPost('/modules/devices/devices').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: DeviceCategory.HEATING_UNIT,
					name: 'E2E Blocked Virtual Device',
				},
			});

			expect(response.status).toBe(400);
			expect(JSON.stringify(response.body)).toContain('closed-loop control');
		});

		// `id` is client-suppliable and `save()` treats an existing primary key as an update, so a create
		// naming an id already in use overwrote that device — and the nested-creation rollback then removed
		// it. A malformed request destroying a device it had nothing to do with, which is why this is
		// checked end to end rather than only at the unit level.
		it('refuses a create naming an id that already exists, leaving that device alone', async () => {
			const firstResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Id Collision Original',
					},
				})
				.expect(201);
			const takenId = (firstResponse.body as { data: DeviceBody }).data.id;

			// The failure has to happen *after* the device row is saved, or the rollback never runs and the
			// test proves nothing about it. A zone that does not exist does that with one request: the
			// device is written, `setDeviceZones` then refuses, and the rollback removes what it believes
			// this request created — which, without the guard, is the original device.
			const collision = await authPost('/modules/devices/devices').send({
				data: {
					id: takenId,
					type: DEVICES_VIRTUAL_TYPE,
					category: DeviceCategory.LIGHTING,
					name: 'E2E Id Collision Impostor',
					zone_ids: [uuid()],
				},
			});

			expect(collision.status).not.toBe(201);

			// The original is untouched: still there, still its own name.
			const readBack = await authGet(`/modules/devices/devices/${takenId}`).expect(200);

			expect((readBack.body as { data: DeviceBody & { name: string } }).data.name).toBe('E2E Id Collision Original');
		});

		// A virtual device's channels and properties are derived from its category, and a device PATCH
		// writes no property, so no property-level guard ever sees a recategorisation. The admin does not
		// offer the field; an API client can still send it.
		//
		// One device, three PATCHes. Split across three tests this cost roughly a dozen requests, and
		// every request in this file draws on one shared throttler budget — the file was intermittently
		// red for it. The three assertions are independent of each other, so sharing the fixture costs
		// nothing but the setup.
		it('judges a recategorisation by what it breaks, and lets every other edit through', async () => {
			const deviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Recategorisation Guard Device',
					},
				})
				.expect(201);
			const deviceId = (deviceResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: deviceId,
					},
				})
				.expect(201);
			const channelId = (channelResponse.body as { data: ChannelBody }).data.id;

			await authPost(`/modules/devices/channels/${channelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_ONLY],
						data_type: DataTypeType.BOOL,
						value_origin: 'local',
					},
				})
				.expect(201);

			// A category whose required channels this device plainly lacks.
			const refused = await authPatch(`/modules/devices/devices/${deviceId}`).send({
				data: { type: DEVICES_VIRTUAL_TYPE, category: DeviceCategory.DOOR },
			});

			expect(refused.status).toBe(422);
			expect(JSON.stringify(refused.body)).toContain('cannot change category');

			// And the case an `isValid` check waves through: `generic` requires nothing this device lacks
			// once `device_information` has been synthesized, so its only complaint about the stored
			// `light` channel is a *warning* — while every projection under that channel would stay
			// attached to a slot `generic` never defines.
			await waitUntil(
				async () => {
					const current = await authGet(`/modules/devices/devices/${deviceId}`);

					if (current.status !== 200) {
						return { done: false, value: null };
					}

					const channels = (current.body as { data: DeviceBody }).data.channels;

					return {
						done: channels.some((channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION)),
						value: channels.map((channel) => channel.category),
					};
					// Polled at half the usual rate: every request here draws on the same shared throttler
					// budget, and the channel is synthesized off DEVICE_CREATED in well under a second.
				},
				'the synthesized device_information channel appearing',
				3000,
				500,
			);

			const warningOnly = await authPatch(`/modules/devices/devices/${deviceId}`).send({
				data: { type: DEVICES_VIRTUAL_TYPE, category: DeviceCategory.GENERIC },
			});

			expect(warningOnly.status).toBe(422);
			expect(JSON.stringify(warningOnly.body)).toContain('is not defined in specification');

			// Every other PATCH keeps working: the guard only runs when the category actually moves, so a
			// device whose structure would fail today's specification can still be renamed.
			await authPatch(`/modules/devices/devices/${deviceId}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, name: 'E2E Renamed Device' } })
				.expect(200);

			// Read back rather than trusting the response envelope, so this pins what was stored — and the
			// category is still what the refusals above left it.
			const readBack = await authGet(`/modules/devices/devices/${deviceId}`).expect(200);
			const stored = (readBack.body as { data: DeviceBody & { name: string } }).data;

			expect(stored.name).toBe('E2E Renamed Device');
			expect(stored.category).toBe(DeviceCategory.LIGHTING);
		});

		it("rejects a source_property pointing at another virtual device's property", async () => {
			// An independent virtual device/channel/property, unrelated to the lifecycle flow above, to
			// serve as "another virtual device's property". An owned (local) property is enough — the
			// guard only cares that the target property's own device is of type virtual, not how that
			// property gets its value.
			const otherDeviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Nesting Guard Source Device',
					},
				})
				.expect(201);
			const otherDeviceId = (otherDeviceResponse.body as { data: DeviceBody }).data.id;

			const otherChannelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: otherDeviceId,
					},
				})
				.expect(201);
			const otherChannelId = (otherChannelResponse.body as { data: ChannelBody }).data.id;

			const otherPropertyResponse = await authPost(`/modules/devices/channels/${otherChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_ONLY],
						data_type: DataTypeType.BOOL,
						value_origin: 'local',
					},
				})
				.expect(201);
			const otherPropertyId = (otherPropertyResponse.body as { data: ChannelPropertyBody }).data.id;

			// A separate virtual device whose property will attempt to nest onto the one above.
			const targetDeviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Nesting Guard Target Device',
					},
				})
				.expect(201);
			const targetDeviceId = (targetDeviceResponse.body as { data: DeviceBody }).data.id;

			const targetChannelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: targetDeviceId,
					},
				})
				.expect(201);
			const targetChannelId = (targetChannelResponse.body as { data: ChannelBody }).data.id;

			const rejected = await authPost(`/modules/devices/channels/${targetChannelId}/properties`).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: PropertyCategory.ON,
					identifier: 'on',
					name: 'On',
					permissions: [PermissionType.READ_WRITE],
					data_type: DataTypeType.BOOL,
					source_property: otherPropertyId,
				},
			});

			expect(rejected.status).toBe(400);
			expect(JSON.stringify(rejected.body)).toContain('belongs to another virtual device');
		});
	});

	// ─── Atomic creation: device, channel and linked property in one POST ───────────────

	// Regression test for the whole nested-creation shape being rejected outright. `@Type` metadata is
	// inherited, so CreateVirtualDeviceDto.channels built its children as the generic
	// CreateDeviceChannelDto / CreateDeviceChannelPropertyDto — neither of which declares
	// `source_property` or `value_origin` — and both the controller and DevicesService validate with
	// `whitelist: true` + `forbidNonWhitelisted: true`. So the request came back 400 "property
	// source_property should not exist" before ChannelsPropertiesTypeMapperService could pick the
	// virtual DTO for the insert, and the only way to build a virtual device was the three-request
	// sequence the lifecycle block above uses.
	//
	// This is also the shape the plugin's ordering work exists to serve: nested properties emit
	// CHANNEL_PROPERTY_CREATED *before* the device's own DEVICE_CREATED, which is what
	// VirtualDeviceInformationListener's `afterCreate` ownership claim and its aggregated-and-serialized
	// initial status were written for. Until this fix that path was unreachable for a linked property,
	// so those guards had never actually been exercised end to end by anything.
	describe('creating a virtual device with its wiring nested in one request', () => {
		let atomicSourceDeviceId: string;
		let atomicSourcePropertyId: string;
		let atomicReadOnlySourcePropertyId: string;
		let atomicVirtualDeviceId: string;

		it('creates the source device it will draw from', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Atomic Source Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: true,
									},
									// A read-only sibling on the same channel, so the compatibility test below can
									// project something the spec slot genuinely refuses without needing a second
									// device. `outlet.in_use` is `ro` in the spec and `light.on` requires a
									// writable source, so the pair is incompatible on permissions alone.
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.IN_USE,
										identifier: 'in_use',
										name: 'In use',
										permissions: [PermissionType.READ_ONLY],
										data_type: DataTypeType.BOOL,
										value: true,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			atomicSourceDeviceId = body.data.id;

			// Selected by category, not by index: the response's property order is not the request's, and
			// picking positionally here silently swapped the writable source for the read-only one.
			const sourceProperties = body.data.channels[0].properties;

			const writableSource = sourceProperties.find((property) => property.category === PropertyCategory.ON);
			const readOnlySource = sourceProperties.find((property) => property.category === PropertyCategory.IN_USE);

			expect(writableSource).toBeDefined();
			expect(readOnlySource).toBeDefined();

			atomicSourcePropertyId = writableSource.id;
			atomicReadOnlySourcePropertyId = readOnlySource.id;

			expect(atomicSourcePropertyId).toBeTruthy();
			expect(atomicReadOnlySourcePropertyId).toBeTruthy();
			expect(atomicSourcePropertyId).not.toBe(atomicReadOnlySourcePropertyId);
		});

		it('accepts the device, its channel and its linked property in a single POST', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Atomic Virtual Light',
						channels: [
							{
								type: DEVICES_VIRTUAL_TYPE,
								category: ChannelCategory.LIGHT,
								identifier: 'light',
								name: 'Light',
								properties: [
									{
										type: DEVICES_VIRTUAL_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										source_property: atomicSourcePropertyId,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			atomicVirtualDeviceId = body.data.id;

			const lightChannel = body.data.channels.find((channel) => channel.category === String(ChannelCategory.LIGHT));
			const onProperty = lightChannel?.properties.find((property) => property.category === PropertyCategory.ON);

			// The nested property was created as a *virtual* property, with the wiring the request asked
			// for — not as a generic one with the two virtual fields quietly dropped.
			expect(onProperty?.source_property).toBe(atomicSourcePropertyId);
			expect(onProperty?.value_origin).toBe('source');
			// And it projects: the source was created holding `true`, and this reads through to it rather
			// than to the virtual property's own (never-written) series.
			expect(onProperty?.value?.value).toBe(true);
		});

		it('returns committed nested wiring as unavailable when post-commit graph validation fails', async () => {
			const graph = moduleRef.get(VirtualDependencyGraphService);
			const propertyId = uuid();
			const failure = new Error('injected nested post-commit validation failure');
			const rejectedValidation = jest.fn();
			const stop = graph.observeValidation(async () => {
				if (await dataSource.getRepository(VirtualChannelPropertyEntity).countBy({ id: propertyId })) {
					rejectedValidation();
					throw failure;
				}
			});
			let deviceId: string | undefined;
			try {
				const response = await authPost('/modules/devices/devices')
					.send({
						data: {
							type: DEVICES_VIRTUAL_TYPE,
							category: DeviceCategory.LIGHTING,
							name: 'Committed unavailable wiring',
							channels: [
								{
									type: DEVICES_VIRTUAL_TYPE,
									category: ChannelCategory.LIGHT,
									identifier: 'light',
									name: 'Light',
									properties: [
										{
											id: propertyId,
											type: DEVICES_VIRTUAL_TYPE,
											category: PropertyCategory.ON,
											identifier: 'on',
											name: 'On',
											permissions: [PermissionType.READ_WRITE],
											data_type: DataTypeType.BOOL,
											source_property: atomicSourcePropertyId,
										},
									],
								},
							],
						},
					})
					.expect(201);
				const body = response.body as { data: DeviceBody };
				deviceId = body.data.id;
				const property = body.data.channels
					.flatMap((channel) => channel.properties)
					.find((candidate) => candidate.id === propertyId);
				expect(property?.source_property).toBe(atomicSourcePropertyId);
				expect(property?.value?.value).toBeNull();
				expect(graph.isValidated()).toBe(false);
				expect(rejectedValidation).toHaveBeenCalled();
				expect(
					(await dataSource.getRepository(VirtualChannelPropertyEntity).findOneByOrFail({ id: propertyId }))
						.sourcePropertyId,
				).toBe(atomicSourcePropertyId);
			} finally {
				stop();
				await graph.refreshQuarantine();
				if (deviceId) await ensureDeviceDeleted(authGet, authDelete, deviceId);
			}
		});

		// The device_information synthesis has to survive being raced by the nested property's own
		// CHANNEL_PROPERTY_CREATED, which on this path is emitted *before* DEVICE_CREATED — so
		// DeviceConnectivityService's find-or-create for that same channel, driven by the rebuild's
		// recompute, is genuinely in flight while VirtualDeviceInformationListener runs its own. That
		// collision used to leave roughly one run in four with no device_information channel at all; see
		// ensureDeviceInformationChannel()'s docstring.
		//
		// Polled through `/devices/:id/channels` rather than `/devices/:id`: the throttler budgets 30
		// requests per 60s per route across the whole run (see waitUntil), and `/devices/:id` is the
		// busiest route in this file. On a timeout the poll reports what it *did* see rather than a bare
		// `null`, because "the channel never appeared" and "the channel appeared without the property"
		// are different failures with different causes.
		it('still synthesizes the connection state property as owned', async () => {
			const observed = await waitUntil<{ property: ChannelPropertyBody | null; seenChannels: string[] }>(async () => {
				const response = await authGet(`/modules/devices/devices/${atomicVirtualDeviceId}/channels`);

				if (response.status !== 200) {
					return { done: false, value: { property: null, seenChannels: [`HTTP ${response.status}`] } };
				}

				const channels = (response.body as { data: ChannelBody[] }).data;

				const informationChannel = channels.find(
					(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
				);

				const property =
					informationChannel?.properties.find((candidate) => candidate.category === PropertyCategory.STATUS) ?? null;

				// Waits for the state it is about to assert, not merely for the row to exist. The claim that
				// makes this property owned is an `afterCreate` hook — it runs after the row is written, so
				// a poll that stops at "the property is there" can catch it in its pre-claim `source` state
				// and then assert against a value that had not arrived yet. On a timeout `waitUntil` reports
				// the last thing it saw, so a property that genuinely never becomes owned still says so.
				return {
					done: property?.value_origin === 'local',
					value: { property, seenChannels: channels.map((channel) => channel.category) },
				};
			}, 'the synthesized connection state property on an atomically created device becoming owned');

			// Owned, not an orphaned projection — the `afterCreate` claim doing its job on the one path
			// that can actually race it.
			expect(observed.property?.value_origin).toBe('local');
			expect(observed.property?.source_property).toBeNull();
		});

		// The initial status write is what the serialized recompute exists to protect: on this path a
		// rebuild-driven recompute (which sees the link) and the DEVICE_CREATED synthesis (which may not
		// yet) genuinely overlap, and whichever landed second used to win regardless of which had read
		// the fresher index. Whatever the interleaving, the settled answer must be the one the wiring
		// implies — UNKNOWN here, since this source has never reported a connection state.
		it('settles on the state its wiring implies, not on whichever write landed last', async () => {
			const statusListener = moduleRef.get<VirtualStatusListener>(VirtualStatusListener);

			await waitForIndexedLink(virtualPropertyIndex, atomicVirtualDeviceId);

			await statusListener.recompute(atomicVirtualDeviceId, 'e2e: settling the atomically created device');

			const response = await authGet(`/modules/devices/devices/${atomicVirtualDeviceId}`).expect(200);
			const status = (response.body as { data: DeviceBody }).data.status;

			expect(status.status).toBe(ConnectionState.UNKNOWN);
		});

		// The wiring is real, not merely recorded on the row: the source-devices endpoint resolves it
		// from the database and names the device the nested property was linked to.
		it('resolves the source device behind the atomically created wiring', async () => {
			const response = await authGet(`/plugins/devices-virtual/devices/${atomicVirtualDeviceId}/source-devices`).expect(
				200,
			);

			expect((response.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(atomicSourceDeviceId);
		});

		// The plugin's own constraints still reach three levels down — retyping the nested DTOs widened
		// the schema to the virtual fields, it did not switch validation off for them.
		it('rejects a nested owned property that also names a source', async () => {
			const rejected = await authPost('/modules/devices/devices').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: DeviceCategory.LIGHTING,
					name: 'E2E Atomic Invalid Virtual Light',
					channels: [
						{
							type: DEVICES_VIRTUAL_TYPE,
							category: ChannelCategory.LIGHT,
							identifier: 'light',
							name: 'Light',
							properties: [
								{
									type: DEVICES_VIRTUAL_TYPE,
									category: PropertyCategory.ON,
									identifier: 'on',
									name: 'On',
									permissions: [PermissionType.READ_WRITE],
									data_type: DataTypeType.BOOL,
									value_origin: 'local',
									source_property: atomicSourcePropertyId,
								},
							],
						},
					],
				},
			});

			expect(rejected.status).toBe(400);
			expect(JSON.stringify(rejected.body)).toContain('an owned property stores its own value');
		});

		// The wizard previews compatibility before it writes, but the preview is not atomic with the
		// write and a direct POST like this one never makes it at all. Without enforcement at
		// persistence, a read-only source lands on a writable slot and only fails much later, when a
		// command is forwarded to a source that cannot accept it.
		it('rejects a nested property projecting a read-only source onto a writable slot', async () => {
			const rejected = await authPost('/modules/devices/devices').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: DeviceCategory.LIGHTING,
					name: 'E2E Atomic Incompatible Virtual Light',
					channels: [
						{
							type: DEVICES_VIRTUAL_TYPE,
							category: ChannelCategory.LIGHT,
							identifier: 'light',
							name: 'Light',
							properties: [
								{
									type: DEVICES_VIRTUAL_TYPE,
									category: PropertyCategory.ON,
									identifier: 'on',
									name: 'On',
									permissions: [PermissionType.READ_WRITE],
									data_type: DataTypeType.BOOL,
									value_origin: 'source',
									source_property: atomicReadOnlySourcePropertyId,
								},
							],
						},
					],
				},
			});

			// Refused at persistence, so nothing is written. The nested device-create path reports its own
			// generic envelope rather than the guard's reason — the same shape every other nested failure
			// gets here — so the status is what this pins; the reason itself is covered by the service's
			// own unit tests.
			expect(rejected.status).toBe(422);

			// Not just "the response carried no device": the parent device row is saved before its channels
			// are built, so a rejection here has to roll it back or the client sees a failure while the
			// database keeps a half-built device, and a retry adds a second one.
			//
			// Asked of the rejected device by name rather than by comparing totals before and after. The app
			// under test is live — the simulator plugin discovers devices of its own on a timer — so a
			// total is only stable if nothing else happens to create one inside this window, which is a
			// race rather than an invariant, and it broke as soon as two tests were added ahead of this
			// one. The name states exactly what the rollback is being held to, and costs one request
			// instead of two.
			const after = await authGet('/modules/devices/devices?hidden=all').expect(200);
			const afterDevices = (after.body as { data: (DeviceBody & { name: string })[] }).data;

			expect(afterDevices.filter((entry) => entry.name === 'E2E Atomic Incompatible Virtual Light')).toHaveLength(0);
		});

		// The remap path, which is the one the preview covers least well: the wizard checked this pairing
		// before it wrote, and a source's permissions can change afterwards. The update hook has to judge
		// the merged row, not the payload — the PATCH here carries only `source_property`.
		it('rejects remapping a linked property onto a read-only source', async () => {
			const deviceResponse = await authGet(`/modules/devices/devices/${atomicVirtualDeviceId}`).expect(200);
			const deviceBody = deviceResponse.body as { data: DeviceBody };

			const lightChannel = deviceBody.data.channels.find(
				(channel) => channel.category === String(ChannelCategory.LIGHT),
			);
			const onProperty = lightChannel?.properties.find((property) => property.category === PropertyCategory.ON);

			expect(lightChannel).toBeDefined();
			expect(onProperty?.id).toBeTruthy();

			await authPatch(`/modules/devices/channels/${lightChannel.id}/properties/${onProperty.id}`)
				.send({ data: { type: DEVICES_VIRTUAL_TYPE, source_property: atomicReadOnlySourcePropertyId } })
				.expect(422);

			// The stored link is untouched — a refused remap must not half-apply.
			const after = await authGet(`/modules/devices/channels/${lightChannel.id}/properties/${onProperty.id}`).expect(
				200,
			);

			expect((after.body as { data: ChannelPropertyBody }).data.source_property).toBe(atomicSourcePropertyId);
		});
	});

	// ─── Deleting the last virtual device unhides the source it replaced ────────────────

	// Regression test for the spec's "Deleting the last virtual device referencing a hidden source
	// auto-unhides it". The DEVICE_DELETED handler discarded its payload and only rebuilt the index, so
	// a physical device hidden because a virtual device replaced it stayed hidden once that replacement
	// was gone: excluded from every picker, absent from the default device list, and — since `hidden` is
	// only reachable through a PATCH the admin no longer offers for a device it does not show — with no
	// route back through the UI.
	//
	// A self-contained device pair rather than the lifecycle flow's, so the hide/delete sequence here
	// cannot perturb what those steps observe.
	// ─── A connection-state property deleted by hand comes back owned ────────────────────

	// Regression test for follow-up 2.7. VirtualDeviceInformationListener synthesizes the
	// connection-state property as owned, but only on DEVICE_CREATED. The property is deletable
	// through DELETE /channels/:id/properties/:id, and the next setConnectionState recreated it
	// through the generic DeviceConnectivityService find-or-create — module code with no
	// `value_origin` to give, so it came back with the SOURCE column default and a null source: an
	// orphan. Nothing re-ran the synthesis, VirtualStatusListener.aggregateState() returns
	// DISCONNECTED for any device with an orphaned property however healthy its real sources are, and
	// PropertyCommandService refuses every command against an offline device. The device was
	// permanently offline and uncommandable, exactly as before the original fix.
	//
	// Fixed by claiming the property inside ChannelsPropertiesService.create() itself, through the
	// plugin's afterCreate mapping hook — so the recreation comes back owned whoever performed it,
	// with no deletion event to subscribe to and no special case on a generic endpoint.
	describe('recreating a manually deleted connection state property', () => {
		it('brings it back owned, and leaves the device online', async () => {
			const sourceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Resynthesis Source Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: false,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const resynthSourcePropertyId = (sourceResponse.body as { data: DeviceBody }).data.channels[0].properties[0].id;

			const virtualResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Resynthesis Virtual Light',
					},
				})
				.expect(201);

			const resynthVirtualDeviceId = (virtualResponse.body as { data: DeviceBody }).data.id;

			// Synthesis is fire-and-forget off DEVICE_CREATED, so poll for it rather than assume the POST
			// above waited for it. Polled through `/devices/:id/channels` rather than `/devices/:id`
			// because the throttler budgets 30 requests per 60s *per route* across the whole run (see
			// waitUntil), and `/devices/:id` is already the busiest route in this file — this one is
			// otherwise unused, and carries the channel's properties just the same.
			const synthesized = await waitUntil<{ channelId: string; statusPropertyId: string }>(async () => {
				const response = await authGet(`/modules/devices/devices/${resynthVirtualDeviceId}/channels`);

				if (response.status !== 200) {
					return { done: false, value: { channelId: '', statusPropertyId: '' } };
				}

				const channel = (response.body as { data: ChannelBody[] }).data.find(
					(candidate) => candidate.category === String(ChannelCategory.DEVICE_INFORMATION),
				);

				const status = channel?.properties.find((property) => property.category === PropertyCategory.STATUS);

				return {
					done: !!status,
					value: { channelId: channel?.id ?? '', statusPropertyId: status?.id ?? '' },
				};
			}, 'the synthesized device_information channel and its connection state property');

			const propertiesPath = `/modules/devices/channels/${synthesized.channelId}/properties`;

			expect(synthesized.statusPropertyId).toBeTruthy();

			// A linked property, so that deleting it later re-wires the virtual device and makes the
			// index rebuild recompute its connection state — which is what drives setConnectionState
			// into recreating the property this test deletes.
			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: resynthVirtualDeviceId,
					},
				})
				.expect(201);

			const resynthLightChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			const linkedResponse = await authPost(`/modules/devices/channels/${resynthLightChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: resynthSourcePropertyId,
					},
				})
				.expect(201);

			const linkedPropertyId = (linkedResponse.body as { data: ChannelPropertyBody }).data.id;

			// Read immediately, with no polling — findSourceDevices() resolves the wiring from the
			// database on every call, so the link the POST above just created is visible to the very
			// next request. This is a read-after-write assertion in its own right: answering it from the
			// in-memory index instead, as it once did, would return an empty list here.
			const linkedSources = await authGet(
				`/plugins/devices-virtual/devices/${resynthVirtualDeviceId}/source-devices`,
			).expect(200);

			expect((linkedSources.body as { data: DeviceBody[] }).data).not.toHaveLength(0);

			// Separately, the *index* has to hold the link before the deletion below, or removing it is
			// not a transition and no recompute follows. That is a different fact from the one just
			// asserted, and since the endpoint above stopped reporting the index it needs its own wait.
			await waitForIndexedLink(virtualPropertyIndex, resynthVirtualDeviceId);

			// The deletion the finding is about. Reachable by any admin through the public API.
			await authDelete(`${propertiesPath}/${synthesized.statusPropertyId}`).expect(204);

			// Removing the only link re-wires the virtual device, which makes the rebuild recompute its
			// state, which calls setConnectionState — the path that recreates the property just deleted.
			await authDelete(`/modules/devices/channels/${resynthLightChannelId}/properties/${linkedPropertyId}`).expect(204);

			const recreated = await waitUntil<ChannelPropertyBody | null>(
				async () => {
					const response = await authGet(propertiesPath);

					if (response.status !== 200) {
						return { done: false, value: null };
					}

					const property =
						(response.body as { data: ChannelPropertyBody[] }).data.find(
							(candidate) => candidate.category === PropertyCategory.STATUS,
						) ?? null;

					// `local` is the assertion; the value confirms the device did not simply come back
					// offline, which is the harm the orphan actually caused.
					return { done: property?.value_origin === 'local' && !!property.value?.value, value: property };
				},
				'the connection state property being recreated as owned',
				6000,
				500,
			);

			expect(recreated?.value_origin).toBe('local');
			// Owned means owned outright — `local` with a lingering source would still be read through
			// the source registry.
			expect(recreated?.source_property).toBeNull();
			// No links left at all, so the aggregate is vacuously connected. An orphaned status property
			// would have forced `disconnected` here instead, permanently.
			expect(recreated?.value?.value).toBe('connected');
		});
	});

	describe('unhiding an abandoned source device', () => {
		let ownSourceDeviceId: string;
		let ownSourcePropertyId: string;
		let ownVirtualDeviceId: string;

		it('unhides the source once the last virtual device referencing it is deleted, without re-enabling it', async () => {
			const sourceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Unhide Source Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: false,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const sourceBody = sourceResponse.body as { data: DeviceBody };

			ownSourceDeviceId = sourceBody.data.id;
			ownSourcePropertyId = sourceBody.data.channels[0].properties[0].id;

			const virtualResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Unhide Virtual Light',
					},
				})
				.expect(201);

			ownVirtualDeviceId = (virtualResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: ownVirtualDeviceId,
					},
				})
				.expect(201);

			const virtualChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			await authPost(`/modules/devices/channels/${virtualChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'on',
						name: 'On',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.BOOL,
						source_property: ownSourcePropertyId,
					},
				})
				.expect(201);

			// The source is hidden because the virtual device now stands in for it, and disabled because
			// the user does not want it polled either. The auto-unhide must give back exactly the one
			// flag it took: `DevicesService.update()` builds the mapped entity class from the DTO before
			// saving, and DeviceEntity.enabled carries a `= true` class field initializer that
			// class-transformer cannot drop, so a patch of `{hidden: false}` alone silently re-enables a
			// device the user had explicitly disabled (follow-up 3.1, whose root fix is blocked on
			// devices-shelly-v1's afterInsert subscriber).
			//
			// `hidden_by: system` is the provenance the admin's own hide carries, and it is load-bearing
			// twice over. The auto-unhide only reverses a hide the *system* performed — an operator's own
			// hide of a device a virtual device happened to reference is theirs to keep — so without it
			// nothing below would fire at all. And it is what the unhide then has to clear, which is the
			// one part of an unhide UpdateDeviceDto cannot express (its `@Transform` reads an explicit
			// `null` as "field not provided") and therefore the one part no mocked test can prove against
			// the real schema.
			await authPatch(`/modules/devices/devices/${ownSourceDeviceId}`)
				.send({ data: { type: SIMULATOR_TYPE, hidden: true, enabled: false, hidden_by: DeviceHiddenBy.SYSTEM } })
				.expect(200);

			// Read immediately, with no polling — the same read-after-write assertion as in the
			// re-synthesis test above, here also confirming the endpoint names the right source device.
			const ownSources = await authGet(`/plugins/devices-virtual/devices/${ownVirtualDeviceId}/source-devices`).expect(
				200,
			);

			expect((ownSources.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(ownSourceDeviceId);

			// And the index has to hold the link before the deletion, or there would be no record of
			// which source the deleted device referenced — that capture is the whole mechanism.
			await waitForIndexedLink(virtualPropertyIndex, ownVirtualDeviceId);

			await ensureDeviceDeleted(authGet, authDelete, ownVirtualDeviceId);

			// The unhide runs off the rebuild that follows the deletion, which is deferred past the
			// deleting transaction's commit — so poll rather than read once.
			const unhidden = await waitUntil<DeviceBody | string>(
				async () => {
					const response = await authGet(`/modules/devices/devices/${ownSourceDeviceId}`);

					// This poll runs immediately after the only call in this spec that opens a transaction, so
					// it is the one most exposed to the Zigbee2mqtt transaction collision documented on
					// ensureDeviceDeleted() — which surfaces here as a transient 500 on an unrelated read.
					// Treated as "not settled yet" rather than dereferenced blindly: a polling loop that throws
					// on one bad sample turns an external flake into a failure of the thing under test, while
					// retrying costs nothing and leaves the assertion below just as strict.
					if (response.status !== 200) {
						return { done: false, value: `HTTP ${response.status}: ${JSON.stringify(response.body)}` };
					}

					const body = response.body as { data: DeviceBody };

					// Both halves of the unhide, because they are two writes: DevicesService.update() clears
					// `hidden`, and a targeted column update clears `hidden_by` immediately after it. Polling
					// on `hidden` alone would sample the row in between and read a stale provenance.
					return { done: body.data.hidden === false && body.data.hidden_by === null, value: body.data };
					// Slower and longer than the default: this poll shares its route budget (see waitUntil)
					// with two other polls in this file, and it waits on the longest chain of deferred work in
					// the plugin — a deletion, a rebuild deferred past that deletion's commit, and only then
					// the unhide.
				},
				'the abandoned source device being unhidden and its provenance cleared',
				6000,
				500,
			);

			expect(typeof unhidden === 'string' ? unhidden : unhidden.hidden).toBe(false);
			// The unhide gives back the flag it took and nothing else — a device the user disabled stays
			// disabled.
			expect(typeof unhidden === 'string' ? unhidden : unhidden.enabled).toBe(false);
			// And the row is left clean: a device that is no longer hidden must not keep claiming who hid
			// it. This write cannot go through the update DTO at all, so this is the only place it is
			// exercised against the real STI schema.
			expect(typeof unhidden === 'string' ? unhidden : unhidden.hidden_by).toBeNull();

			// Unhidden means genuinely back in the pickers, not merely a flipped column.
			const visibleList = await authGet('/modules/devices/devices?hidden=false').expect(200);

			expect((visibleList.body as { data: DeviceBody[] }).data.map((device) => device.id)).toContain(ownSourceDeviceId);
		});
	});

	// ─── Containment: nothing virtual ever hangs off a device that is not virtual ────────

	/**
	 * The virtual layer is strictly additive: it may not degrade a device that is not part of it.
	 *
	 * `type` is chosen from the request payload, so the generic property route happily built a
	 * VirtualChannelPropertyEntity inside an ordinary physical channel, and nothing downstream
	 * re-checked the owner. VirtualPropertyIndexService resolves a virtual property's owning device
	 * from its own channel relation and files it under `byVirtualDevice` — so the *physical* device
	 * became, to the index, a virtual device. From there VirtualStatusListener would overwrite that
	 * device's real connectivity with the projection aggregate (a source-less property indexes as an
	 * orphan, which aggregates to DISCONNECTED), and PropertyCommandService refuses every command
	 * against an offline device: a real device's own commands start failing, caused entirely by a
	 * plugin it was never enrolled in.
	 *
	 * The same shape exists one level up — `POST /channels` takes `device` from the payload too, so a
	 * virtual channel could be hung off a physical device and then filled with virtual properties.
	 *
	 * The assertion at the end of this block is the property itself, read straight from the database
	 * rather than inferred from status codes: *no* virtual row, of either kind, is reachable from a
	 * non-virtual device. Status codes alone would only say that the request shapes tried here are
	 * refused; this says the state cannot exist.
	 */
	// The metadata-change orphaning had unit coverage only, and its unit tests stub the query builder —
	// so nothing proved the write's own predicates (the link, and each judged row's version) actually
	// match in SQL. A binding that did not compare equal would disable orphaning outright and every test
	// would still pass. This exercises the real statement end to end.
	describe('a source whose metadata stops fitting the slot it fills', () => {
		it('orphans the projection reading it', async () => {
			const sourceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Demoted Source Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value: false,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const sourceBody = sourceResponse.body as { data: DeviceBody };
			const demotedPropertyId = sourceBody.data.channels
				.find((channel) => channel.category === String(ChannelCategory.OUTLET))
				?.properties.find((property) => String(property.category) === String(PropertyCategory.ON))?.id;

			expect(demotedPropertyId).toBeDefined();

			const virtualResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Demoted Source Virtual Light',
						channels: [
							{
								type: DEVICES_VIRTUAL_TYPE,
								category: ChannelCategory.LIGHT,
								identifier: 'light',
								name: 'Light',
								properties: [
									{
										type: DEVICES_VIRTUAL_TYPE,
										category: PropertyCategory.ON,
										identifier: 'on',
										name: 'On',
										permissions: [PermissionType.READ_WRITE],
										data_type: DataTypeType.BOOL,
										value_origin: 'source',
										source_property: demotedPropertyId,
									},
								],
							},
						],
					},
				})
				.expect(201);

			const virtualDeviceId = (virtualResponse.body as { data: DeviceBody }).data.id;

			// Demoting the source to read-only makes it unable to fill a writable `light.on`, which is the
			// judgement the listener makes and the write it then has to land.
			await authPatch(`/modules/devices/channels/${sourceBody.data.channels[0].id}/properties/${demotedPropertyId}`)
				.send({ data: { type: SIMULATOR_TYPE, permissions: [PermissionType.READ_ONLY] } })
				.expect(200);

			const orphaned = await waitUntil(
				async () => {
					const current = await authGet(`/modules/devices/devices/${virtualDeviceId}`);

					if (current.status !== 200) {
						return { done: false, value: null };
					}

					const property = (current.body as { data: DeviceBody }).data.channels
						.find((channel) => channel.category === String(ChannelCategory.LIGHT))
						?.properties.find((candidate) => String(candidate.category) === String(PropertyCategory.ON));

					// `?? 'absent'` would be wrong here: `null` is the answer this is waiting for, and coalescing
					// past it reports success as if the property were missing.
					return {
						done: property?.source_property === null,
						value: property === undefined ? 'absent' : property.source_property,
					};
				},
				'the projection losing the source that stopped fitting its slot',
				5000,
				500,
			);

			expect(orphaned).toBeNull();
		});
	});

	describe('containment: no virtual row attaches to a non-virtual device', () => {
		let physicalDeviceId: string;
		let physicalChannelId: string;

		const strayProperty = {
			type: DEVICES_VIRTUAL_TYPE,
			category: PropertyCategory.ON,
			name: 'Stray On',
			permissions: [PermissionType.READ_ONLY],
			data_type: DataTypeType.BOOL,
		};

		it('creates the physical device the attachments will be attempted against', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Containment Physical Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.OUTLET,
								identifier: 'outlet',
								name: 'Outlet',
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			physicalDeviceId = body.data.id;
			physicalChannelId =
				body.data.channels.find((channel) => channel.category === String(ChannelCategory.OUTLET))?.id ?? '';

			expect(physicalChannelId).toBeTruthy();
		});

		it('refuses a virtual property posted into a physical channel (channel-scoped route)', async () => {
			const response = await authPost(`/modules/devices/channels/${physicalChannelId}/properties`).send({
				data: { ...strayProperty, identifier: 'stray_channel_scoped' },
			});

			expect(response.status).toBe(422);
		});

		it('refuses a virtual property posted into a physical channel (device-scoped route)', async () => {
			const response = await authPost(
				`/modules/devices/devices/${physicalDeviceId}/channels/${physicalChannelId}/properties`,
			).send({
				data: { ...strayProperty, identifier: 'stray_device_scoped' },
			});

			expect(response.status).toBe(422);
		});

		// One level up: the channel route takes `device` from the payload, so this is the same gap with
		// one more hop in it. Rejected at the DTO layer, hence 400 rather than 422 — the offending value
		// is a field of the request, so the error can name it.
		it('refuses a virtual channel hung off a physical device', async () => {
			const response = await authPost('/modules/devices/channels').send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: ChannelCategory.LIGHT,
					identifier: 'stray_light',
					name: 'Stray Light',
					device: physicalDeviceId,
				},
			});

			expect(response.status).toBe(400);
			expect(JSON.stringify(response.body)).toContain('virtual device');
		});

		// The nested shape, which re-validates each channel through ChannelsService.create() rather than
		// through the device DTO — so a guard placed only on the standalone route would miss it.
		it('refuses a virtual channel nested into a physical device create', async () => {
			const response = await authPost('/modules/devices/devices').send({
				data: {
					type: SIMULATOR_TYPE,
					category: DeviceCategory.OUTLET,
					name: 'E2E Containment Nested Stray',
					channels: [
						{
							type: DEVICES_VIRTUAL_TYPE,
							category: ChannelCategory.LIGHT,
							identifier: 'stray_nested_light',
							name: 'Stray Nested Light',
						},
					],
				},
			});

			expect(response.status).toBe(422);
		});

		// The update path, which on this branch has repeatedly reached states a create-time check
		// missed. Here it cannot, and for a structural reason rather than a guard: neither update DTO
		// declares the parent link at all — UpdateChannelDto has no `device` and UpdateChannelPropertyDto
		// has no `channel` — and both controllers validate with `forbidNonWhitelisted`, so an attempt to
		// re-parent is rejected as an unknown field rather than silently ignored. These two assertions
		// are what would notice if either field were ever added without a matching guard.
		it('offers no way to re-parent a virtual channel or property onto a physical device', async () => {
			const deviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Containment Reparent Target',
					},
				})
				.expect(201);
			const reparentDeviceId = (deviceResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: reparentDeviceId,
					},
				})
				.expect(201);
			const reparentChannelId = (channelResponse.body as { data: ChannelBody }).data.id;

			const propertyResponse = await authPost(`/modules/devices/channels/${reparentChannelId}/properties`)
				.send({
					data: { ...strayProperty, identifier: 'reparent_on' },
				})
				.expect(201);
			const reparentPropertyId = (propertyResponse.body as { data: ChannelPropertyBody }).data.id;

			const movedChannel = await authPatch(`/modules/devices/channels/${reparentChannelId}`).send({
				data: { type: DEVICES_VIRTUAL_TYPE, device: physicalDeviceId },
			});

			expect(movedChannel.status).toBe(400);

			const movedProperty = await authPatch(
				`/modules/devices/channels/${reparentChannelId}/properties/${reparentPropertyId}`,
			).send({
				data: { type: DEVICES_VIRTUAL_TYPE, channel: physicalChannelId },
			});

			expect(movedProperty.status).toBe(400);
		});

		// The property this block is actually about: not "those requests were refused" but "the state
		// they were reaching for does not exist anywhere in the database".
		//
		// A relation that came back unloaded (a bare id string) counts as a stray rather than a pass:
		// this assertion is only worth anything if it can actually see the owner, so "could not tell"
		// has to fail loudly instead of quietly reporting containment.
		it('leaves no virtual channel or property reachable from a non-virtual device', async () => {
			// `null` is a stray too, and reported rather than thrown on: a property whose channel relation
			// resolves to nothing is exactly the state this assertion exists to catch, and crashing on it
			// hides which row it was behind a TypeError.
			const ownerIsVirtual = (channel: ChannelEntity | string | null): boolean =>
				channel !== null &&
				typeof channel !== 'string' &&
				channel.device !== null &&
				typeof channel.device !== 'string' &&
				channel.device.type === DEVICES_VIRTUAL_TYPE;

			const strayProperties = (
				await dataSource.getRepository(VirtualChannelPropertyEntity).find({ relations: ['channel', 'channel.device'] })
			).filter((property) => !ownerIsVirtual(property.channel));

			// Identified by what is wrong with them, not by id alone — a bare uuid says nothing about
			// whether the channel was missing, unloaded, or owned by the wrong kind of device.
			expect(
				strayProperties.map((property) => ({
					id: property.id,
					category: property.category,
					identifier: property.identifier,
					// The synthesized device_information properties carry their own device's id as their
					// value, so this says *whose* row was left behind; `createdAt` says when in the run.
					value: property.value,
					createdAt: property.createdAt,
					channel:
						property.channel === null
							? null
							: typeof property.channel === 'string'
								? property.channel
								: property.channel.id,
				})),
			).toEqual([]);

			const strayChannels = (
				await dataSource.getRepository(VirtualChannelEntity).find({ relations: ['device'] })
			).filter((channel) => typeof channel.device === 'string' || channel.device.type !== DEVICES_VIRTUAL_TYPE);

			expect(strayChannels.map((channel) => channel.id)).toEqual([]);
		});
	});

	// ─── v1 has no write semantics for an owned property ─────────────────────────────────

	/**
	 * An owned property (`value_origin: local`) stores its own value and forwards nothing.
	 * VirtualDevicePlatform.processBatch() therefore refuses every one of them outright — "owned
	 * properties are read-only in this release". The API used to accept writable permissions on one
	 * anyway, producing a control that can never work.
	 *
	 * It is worse than inert. `ChannelsPropertiesService.update()` writes the optimistic value into the
	 * property's own series *before* the controller dispatches the command, and the dispatch is
	 * fire-and-forget — so the switch visibly moves, the refusal lands in a log nobody is reading, and
	 * nothing at all happens in the house.
	 *
	 * The scope decision here is deliberate and recorded (TECH-VIRTUAL-DEVICES-FOLLOWUPS, controller
	 * support): v1 is wiring only, and the only owned properties that exist are the synthesized,
	 * read-only device_information strings. So this restricts rather than implements — writable owned
	 * properties come back with the release that can actually act on them.
	 */
	describe('an owned property cannot be writable while v1 has no write semantics', () => {
		let ownedDeviceId: string;
		let ownedChannelId: string;
		let ownedPropertyId: string;
		let orphanPropertyId: string;

		it('creates a virtual device with a channel to hold the owned properties', async () => {
			const deviceResponse = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: DeviceCategory.LIGHTING,
						name: 'E2E Owned Writable Guard Device',
					},
				})
				.expect(201);

			ownedDeviceId = (deviceResponse.body as { data: DeviceBody }).data.id;

			const channelResponse = await authPost('/modules/devices/channels')
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.LIGHT,
						identifier: 'light',
						name: 'Light',
						device: ownedDeviceId,
					},
				})
				.expect(201);

			ownedChannelId = (channelResponse.body as { data: ChannelBody }).data.id;
		});

		// The exact payload the P2 report names: a switcher's `on` as an owned control.
		it('refuses creating an owned property with writable permissions', async () => {
			const response = await authPost(`/modules/devices/channels/${ownedChannelId}/properties`).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					category: PropertyCategory.ON,
					identifier: 'owned_on',
					name: 'On',
					permissions: [PermissionType.READ_WRITE],
					data_type: DataTypeType.BOOL,
					value_origin: 'local',
				},
			});

			expect(response.status).toBe(400);
			expect(JSON.stringify(response.body)).toContain('read-only');
		});

		it('accepts the same owned property when it is read-only', async () => {
			const response = await authPost(`/modules/devices/channels/${ownedChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.ON,
						identifier: 'owned_on',
						name: 'On',
						permissions: [PermissionType.READ_ONLY],
						data_type: DataTypeType.BOOL,
						value_origin: 'local',
					},
				})
				.expect(201);

			const body = (response.body as { data: ChannelPropertyBody }).data;

			ownedPropertyId = body.id;

			expect(body.value_origin).toBe('local');
		});

		// The PATCH that reaches the same state the create-time check refuses. Judged on the merged row,
		// since the payload carries only one half of the pair.
		it('refuses making an existing owned property writable by PATCH', async () => {
			const response = await authPatch(
				`/modules/devices/channels/${ownedChannelId}/properties/${ownedPropertyId}`,
			).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					permissions: [PermissionType.READ_WRITE],
				},
			});

			expect(response.status).toBe(422);

			const readBack = await authGet(
				`/modules/devices/channels/${ownedChannelId}/properties/${ownedPropertyId}`,
			).expect(200);

			expect((readBack.body as { data: { permissions: string[] } }).data.permissions).toEqual([
				PermissionType.READ_ONLY,
			]);
		});

		// The other half of the same merged-row hole, approached from the opposite side: a *writable
		// orphan* is legal (it is a projection waiting to be remapped), and switching its origin to local
		// would land on exactly the state the create-time check refuses.
		it('refuses switching a writable orphan to local', async () => {
			const orphanResponse = await authPost(`/modules/devices/channels/${ownedChannelId}/properties`)
				.send({
					data: {
						type: DEVICES_VIRTUAL_TYPE,
						category: PropertyCategory.BRIGHTNESS,
						identifier: 'orphan_brightness',
						name: 'Brightness',
						permissions: [PermissionType.READ_WRITE],
						data_type: DataTypeType.UCHAR,
					},
				})
				.expect(201);

			orphanPropertyId = (orphanResponse.body as { data: ChannelPropertyBody }).data.id;

			const response = await authPatch(
				`/modules/devices/channels/${ownedChannelId}/properties/${orphanPropertyId}`,
			).send({
				data: {
					type: DEVICES_VIRTUAL_TYPE,
					value_origin: 'local',
				},
			});

			expect(response.status).toBe(422);
		});

		// The guard must not block this plugin's own listeners. Every synthesized device_information
		// field is owned *and* read-only, so all four have to survive validation that the plugin's own
		// creation path performs on itself — a guard that rejected them would leave the device with no
		// connection state at all, which is a permanently offline device.
		it('still synthesizes all four owned device_information properties, owned and read-only', async () => {
			const informationProperties = await waitUntil(async () => {
				const response = await authGet(`/modules/devices/devices/${ownedDeviceId}`);

				if (response.status !== 200) {
					return { done: false, value: [] as ChannelPropertyBody[] };
				}

				const properties =
					(response.body as { data: DeviceBody }).data.channels.find(
						(channel) => channel.category === String(ChannelCategory.DEVICE_INFORMATION),
					)?.properties ?? [];

				return { done: properties.length >= 4, value: properties };
			}, 'the four synthesized device_information properties appearing');

			expect(informationProperties.map((property) => property.category).sort()).toEqual(
				[
					PropertyCategory.MANUFACTURER,
					PropertyCategory.MODEL,
					PropertyCategory.SERIAL_NUMBER,
					PropertyCategory.STATUS,
				].sort(),
			);

			for (const property of informationProperties) {
				expect(property.value_origin).toBe('local');
				expect((property as unknown as { permissions: string[] }).permissions).toEqual([PermissionType.READ_ONLY]);
			}
		});
	});

	// ─── One meter, one claimant ─────────────────────────────────────────────────────────
	//
	// A source property may legitimately feed several virtual devices — one sensor serves two rooms'
	// climate — and for a reading that is coherent. Energy is not: a kWh billed to two rooms is
	// arithmetic nobody asked for, and attribution needs one accountable device. The rule is enforced
	// where it cannot be raced, on the row itself, and this is the API's view of it.

	describe('a meter already presented by another virtual device', () => {
		let meterDeviceId: string;
		let meterPropertyId: string;
		let firstClaimantId: string;

		const virtualOutlet = (name: string, meter: string) => ({
			data: {
				type: DEVICES_VIRTUAL_TYPE,
				category: DeviceCategory.OUTLET,
				name,
				channels: [
					{
						type: DEVICES_VIRTUAL_TYPE,
						category: ChannelCategory.ELECTRICAL_ENERGY,
						identifier: 'electrical_energy',
						name: 'Energy',
						properties: [
							{
								type: DEVICES_VIRTUAL_TYPE,
								category: PropertyCategory.CONSUMPTION,
								identifier: 'consumption',
								name: 'Consumption',
								permissions: [PermissionType.READ_ONLY],
								data_type: DataTypeType.FLOAT,
								format: [0, null],
								source_property: meter,
							},
						],
					},
				],
			},
		});

		it('creates a physical device carrying a cumulative meter', async () => {
			const response = await authPost('/modules/devices/devices')
				.send({
					data: {
						type: SIMULATOR_TYPE,
						category: DeviceCategory.OUTLET,
						name: 'E2E Metered Outlet',
						channels: [
							{
								type: SIMULATOR_TYPE,
								category: ChannelCategory.ELECTRICAL_ENERGY,
								identifier: 'electrical_energy',
								name: 'Energy',
								properties: [
									{
										type: SIMULATOR_TYPE,
										category: PropertyCategory.CONSUMPTION,
										identifier: 'consumption',
										name: 'Consumption',
										permissions: [PermissionType.READ_ONLY],
										data_type: DataTypeType.FLOAT,
										format: [0, null],
									},
								],
							},
						],
					},
				})
				.expect(201);

			const body = response.body as { data: DeviceBody };

			meterDeviceId = body.data.id;
			meterPropertyId =
				body.data.channels
					.find((channel) => channel.category === String(ChannelCategory.ELECTRICAL_ENERGY))
					?.properties.find((property) => property.category === PropertyCategory.CONSUMPTION)?.id ?? '';

			expect(meterPropertyId).toBeTruthy();
		});

		it('lets the first virtual device present it', async () => {
			const response = await authPost('/modules/devices/devices')
				.send(virtualOutlet('E2E Kitchen Meter', meterPropertyId))
				.expect(201);

			firstClaimantId = (response.body as { data: DeviceBody }).data.id;

			expect(firstClaimantId).toBeTruthy();
		});

		// The nested device-create path reports its own generic envelope rather than the guard's reason —
		// the same shape every other nested failure gets here — so the status is what this pins. The
		// reason has to reach the user somewhere, and the case below is where: the wizard asks before it
		// writes.
		it('refuses a second one', async () => {
			const rejected = await authPost('/modules/devices/devices').send(
				virtualOutlet('E2E Office Meter', meterPropertyId),
			);

			expect(rejected.status).toBe(422);
		});

		// A false green is the one answer a user acts on. `reportCompatibility` compares a candidate
		// against a slot and a claimed meter fits an energy slot as well as any other, so without the
		// claim folded in the wizard would offer this pairing and the create would then refuse it.
		it('tells the wizard the pairing is incompatible, and why', async () => {
			const preview = await authPost('/plugins/devices-virtual/devices/compatibility')
				.send({
					data: {
						category: DeviceCategory.OUTLET,
						candidates: [
							{
								spec_channel: ChannelCategory.ELECTRICAL_ENERGY,
								spec_property: PropertyCategory.CONSUMPTION,
								source_property: meterPropertyId,
							},
						],
					},
				})
				.expect(201);

			const [report] = (preview.body as { data: { compatible: boolean; reason: string }[] }).data;

			expect(report.compatible).toBe(false);
			expect(report.reason).toContain('is already the energy meter of virtual property');
		});

		// The claim and the projection are one row written by one statement, so a refusal cannot leave
		// half of either behind — but that is the kind of thing worth asserting rather than reasoning
		// about, since the failure mode is a device that exists and bills nothing.
		it('leaves nothing of the refused device behind', async () => {
			const devices = await authGet('/modules/devices/devices').expect(200);

			const names = (devices.body as { data: { id: string; name: string }[] }).data.map((device) => device.name);

			expect(names).toContain('E2E Kitchen Meter');
			expect(names).not.toContain('E2E Office Meter');
		});

		// Deleting the holder takes its claim with the row, and the meter is free again — which is also
		// the path `reconcileEnergyClaims` sweeps behind, since a delete cannot name what it released.
		it('lets the meter be presented again once the holder is gone', async () => {
			await ensureDeviceDeleted(authGet, authDelete, firstClaimantId);

			const successor = await authPost('/modules/devices/devices')
				.send(virtualOutlet('E2E Office Meter', meterPropertyId))
				.expect(201);

			// Tidied up in reverse, so nothing is deleted out from under a projection that still reads it.
			await ensureDeviceDeleted(authGet, authDelete, (successor.body as { data: DeviceBody }).data.id);
			await ensureDeviceDeleted(authGet, authDelete, meterDeviceId);
		});
	});

	// ─── Auth enforcement ────────────────────────────────────────────────────────────────

	describe('authentication', () => {
		it('should return 401 for unauthenticated requests', async () => {
			await request(app.getHttpServer()).get('/modules/devices/devices').expect(401);
		});
	});
});

// Each added failure fixture owns its background services. The legacy wiring suite keeps its
// original shared AppModule and both original thermostat cases above.
describe('thermostat creation response (isolated real AppModule e2e)', () => {
	let app: INestApplication;
	let moduleRef: TestingModule;
	let dataSource: DataSource;
	let accessToken: string;
	beforeEach(async () => {
		const dynamicAppModule = AppModule.register({
			moduleExtensions: [],
			pluginExtensions: [],
		});

		const moduleFixture = await Test.createTestingModule({
			imports: [dynamicAppModule],
		}).compile();

		app = moduleFixture.createNestApplication();

		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);

		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();

		// Wait for all modules to initialize
		await new Promise((resolve) => setTimeout(resolve, 100));

		moduleRef = moduleFixture;
		dataSource = moduleFixture.get<DataSource>(DataSource);

		// Register and login to obtain an access token
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: {
					username: 'virtualdevicestest',
					password: 'securePassword123!',
					email: 'virtualdevicestest@example.com',
				},
			});

		const loginResponse = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: {
					username: 'virtualdevicestest',
					password: 'securePassword123!',
				},
			});

		const loginBody = loginResponse.body as { data?: { access_token?: string } };

		if (!loginBody.data?.access_token) {
			throw new Error(
				`E2E setup failed: login returned status ${loginResponse.status} — ${JSON.stringify(loginResponse.body)}`,
			);
		}

		accessToken = loginBody.data.access_token;
	});
	afterEach(async () => {
		await app?.close();
		useContainer({ get: <T>(type: new () => T): T => new type() }, { fallbackOnErrors: true });
	});
	it.each([
		{ replaceBeforeCreate: false, variant: 'heating', failure: 'catalog' },
		{ replaceBeforeCreate: false, variant: 'heating', failure: 'configuration' },
		{ replaceBeforeCreate: false, variant: 'heating', failure: 'hydration' },
		{ replaceBeforeCreate: false, variant: 'dual', failure: 'none' },
	])('preserves the complete HTTP wire and durable creation: %j', async (scenario) => {
		await verifyThermostatWire({ app, moduleRef, dataSource, accessToken }, scenario);
	});
});

function captureChannelWriterProgress(a: TestingModule, b: TestingModule) {
	type Runner = import('typeorm').QueryRunner;
	type NativeMethod = (this: unknown, ...args: unknown[]) => unknown;
	type Owner = { active: boolean; accepting: boolean; mode: string };
	const gate = () => {
		let release: () => void;
		const promise = new Promise<void>((resolve) => (release = resolve));
		return { promise, release: () => release() };
	};
	const evaluation = gate(),
		written = gate(),
		finished = gate(),
		writer = gate();
	const selected = new AsyncLocalStorage<boolean>();
	const sourceA = a.get(DataSource),
		sourceB = b.get(DataSource);
	const lock = a.get(DeviceStructureLockService);
	const context = Reflect.get(lock, 'context') as { getStore(): Owner | undefined };
	const runtime = a.get(VirtualThermostatRuntimeService);
	const originalEvaluate = Reflect.get(runtime, 'evaluate') as NativeMethod;
	const ownEvaluate = Object.getOwnPropertyDescriptor(runtime, 'evaluate');
	const jobs: Promise<unknown>[] = [],
		callbacks: Promise<void>[] = [],
		restore: (() => void)[] = [];
	const facts: { source: string; query: string; edge: string; selected: boolean; runner: Runner; success: boolean }[] =
		[];
	let target = '',
		channel = '',
		owner: Owner,
		held = false,
		window = false,
		unknown = false;
	let aRunner: Runner, bRunner: Runner;
	const depth = (runner: Runner) => Reflect.get(runner, 'transactionDepth') as number;
	try {
		for (const [label, source] of [
			['A', sourceA],
			['B', sourceB],
		] as const) {
			const native = Reflect.get(source.driver, 'databaseConnection') as object;
			const admissions: { query: string; parameters: unknown; runner: Runner; selected: boolean }[] = [];
			const observer: import('typeorm').EntitySubscriberInterface = {
				beforeQuery(event) {
					if (admissions.length === 512) {
						unknown = true;
						return;
					}
					admissions.push({
						query: event.query,
						parameters: event.parameters,
						runner: event.queryRunner,
						selected: selected.getStore() === true,
					});
				},
			};
			source.subscribers.push(observer);
			restore.push(() => {
				const index = source.subscribers.indexOf(observer);
				if (index >= 0) source.subscribers.splice(index, 1);
			});
			for (const method of ['all', 'run']) {
				const original = Reflect.get(native, method) as NativeMethod;
				const own = Object.getOwnPropertyDescriptor(native, method);
				const wrapper: NativeMethod = function (...args) {
					const query = args[0] as string,
						callback = args.at(-1);
					const matches = admissions.filter((entry) => entry.query === query && entry.parameters === args[1]);
					for (const entry of matches) admissions.splice(admissions.indexOf(entry), 1);
					const admission = matches.length === 1 ? matches[0] : undefined;
					const relevant = admission && (label === 'A' ? admission.selected : window);
					const record = (edge: string, error?: unknown) => {
						if (!relevant) return;
						if (facts.length === 256) {
							unknown = true;
							return;
						}
						facts.push({
							source: label,
							query,
							edge,
							selected: admission.selected,
							runner: admission.runner,
							success: edge === 'ack' && error == null,
						});
					};
					if (typeof callback !== 'function') return original.apply(this, args) as unknown;
					const done = gate();
					callbacks.push(done.promise);
					record('submit');
					const forwarded = args.slice();
					forwarded[forwarded.length - 1] = function (this: unknown, ...values: unknown[]) {
						record('ack', values[0]);
						try {
							return (callback as NativeMethod).apply(this, values) as unknown;
						} finally {
							done.release();
						}
					};
					try {
						const result: unknown = original.apply(this, forwarded);
						if (label === 'B' && window && query === 'BEGIN IMMEDIATE TRANSACTION') {
							if (!held || !admission || depth(admission.runner) !== 0) unknown = true;
							bRunner = admission?.runner;
							writer.release();
						}
						return result;
					} catch (error) {
						done.release();
						throw error;
					}
				};
				Object.defineProperty(native, method, { configurable: true, writable: true, value: wrapper });
				restore.push(() => {
					if (Reflect.get(native, method) !== wrapper) throw new Error('Progress observer replaced');
					if (own) Object.defineProperty(native, method, own);
					else Reflect.deleteProperty(native, method);
				});
			}
		}
		const wrappedEvaluate: NativeMethod = function (...args) {
			const first = !target;
			if (first) {
				target = args[0] as string;
				owner = context.getStore();
			}
			const job = (async () => {
				if (first) await evaluation.promise;
				try {
					return await selected.run(first, () => originalEvaluate.apply(this, args) as unknown);
				} finally {
					if (first) finished.release();
				}
			})();
			if (first) jobs.push(job);
			return job;
		};
		Object.defineProperty(runtime, 'evaluate', { configurable: true, writable: true, value: wrappedEvaluate });
		restore.push(() => {
			if (Reflect.get(runtime, 'evaluate') !== wrappedEvaluate)
				throw new Error('Progress evaluation observer replaced');
			if (ownEvaluate) Object.defineProperty(runtime, 'evaluate', ownEvaluate);
			else Reflect.deleteProperty(runtime, 'evaluate');
		});
		const after = async (
			event:
				| import('typeorm').InsertEvent<VirtualThermostatRuntimeEntity>
				| import('typeorm').UpdateEvent<VirtualThermostatRuntimeEntity>,
		) => {
			if (
				held ||
				!selected.getStore() ||
				!(event.entity instanceof VirtualThermostatRuntimeEntity) ||
				event.entity.controllerId !== target
			)
				return;
			const ack = [...facts]
				.reverse()
				.find(
					(row) =>
						row.source === 'A' &&
						row.runner === event.queryRunner &&
						row.edge === 'ack' &&
						/^(INSERT|UPDATE) .*"devices_virtual_thermostat_runtime"/.test(row.query),
				);
			expect(ack?.success).toBe(true);
			expect(context.getStore()).toBe(owner);
			expect(owner).toMatchObject({ active: true, accepting: true, mode: 'exclusive' });
			expect(event.queryRunner.isTransactionActive).toBe(true);
			expect(depth(event.queryRunner)).toBe(1);
			aRunner = event.queryRunner;
			held = true;
			written.release();
			await writer.promise;
		};
		const subscriber: import('typeorm').EntitySubscriberInterface = { afterInsert: after, afterUpdate: after };
		sourceA.subscribers.push(subscriber);
		restore.push(() => {
			const index = sourceA.subscribers.indexOf(subscriber);
			if (index >= 0) sourceA.subscribers.splice(index, 1);
		});
	} catch (cause) {
		evaluation.release();
		writer.release();
		for (const undo of restore.reverse()) {
			try {
				undo();
			} catch {
				/* Preserve the installation failure while attempting every restoration. */
			}
		}
		throw cause;
	}
	let closing: Promise<void>;
	let cleanupFailure: { cause: unknown } | undefined;
	return {
		async beforePatch(id: string, root: string) {
			expect(target).toBe(root);
			channel = id;
			evaluation.release();
			await Promise.race([written.promise, finished.promise]);
			expect(held).toBe(true);
			window = true;
		},
		own(promise: Promise<unknown>) {
			jobs.push(promise);
		},
		verify() {
			expect(unknown).toBe(false);
			expect(aRunner).toBeDefined();
			expect(bRunner).toBeDefined();
			expect(aRunner).not.toBe(bRunner);
			const index = (label: string, query: string, edge: string) =>
				facts.findIndex(
					(row) => row.source === label && row.query === query && row.edge === edge && (edge !== 'ack' || row.success),
				);
			const aCommit = index('A', 'COMMIT', 'ack'),
				bSubmit = index('B', 'BEGIN IMMEDIATE TRANSACTION', 'submit'),
				bBegin = index('B', 'BEGIN IMMEDIATE TRANSACTION', 'ack');
			expect(bSubmit).toBeGreaterThanOrEqual(0);
			expect(aCommit).toBeGreaterThan(bSubmit);
			expect(bBegin).toBeGreaterThan(aCommit);
			const current = facts.filter((row) => row.source === 'B' && row.runner === bRunner);
			expect(current[0].query).toBe('BEGIN IMMEDIATE TRANSACTION');
			expect(
				current
					.slice(2)
					.some(
						(row) =>
							row.edge === 'ack' && row.success && row.query.includes('FROM "devices_module_channels_properties"'),
					),
			).toBe(true);
			expect(
				current.some((row) => row.edge === 'ack' && row.success && /^UPDATE "devices_module_channels"/.test(row.query)),
			).toBe(true);
			expect(index('B', 'COMMIT', 'ack')).toBeGreaterThan(bBegin);
			console.info(
				'channel-writer-progress',
				JSON.stringify({
					target,
					channel,
					facts: facts.map(({ runner, ...row }) => ({
						...row,
						runner: runner === aRunner ? 'A-selected' : runner === bRunner ? 'B-selected' : 'other',
					})),
				}),
			);
		},
		close() {
			evaluation.release();
			writer.release();
			return (closing ??= (async () => {
				let issuedJobs = 0,
					issuedCallbacks = 0;
				try {
					do {
						const pending = [...jobs.slice(issuedJobs), ...callbacks.slice(issuedCallbacks)];
						issuedJobs = jobs.length;
						issuedCallbacks = callbacks.length;
						for (const result of await Promise.allSettled(pending)) {
							if (result.status === 'rejected') cleanupFailure ??= { cause: result.reason as unknown };
						}
					} while (issuedJobs < jobs.length || issuedCallbacks < callbacks.length);
				} finally {
					for (const undo of restore.reverse()) {
						try {
							undo();
						} catch (cause) {
							cleanupFailure ??= { cause };
						}
					}
				}
			})());
		},
	};
}

describe('channel writer observation forwarding model (no native credit)', () => {
	it.each(['all', 'run'] as const)(
		'preserves %s return/callback/throw and joins then restores its own observations',
		async (method) => {
			const returned = {},
				callbackThis = {},
				query = 'model query',
				parameters: unknown[] = ['model parameter'];
			const calls: { receiver: unknown; query: string; parameters: unknown[] }[] = [];
			let injected: Error | undefined;
			const original = function (
				this: unknown,
				sql: string,
				bindings: unknown[],
				callback: (this: unknown, ...values: unknown[]) => unknown,
			) {
				calls.push({ receiver: this, query: sql, parameters: bindings });
				if (injected) throw injected;
				callback.call(callbackThis, false, parameters);
				return returned;
			};
			const nativeA = { all: original, run: original },
				nativeB = { all: original, run: original };
			const sourceA = {
				driver: { databaseConnection: nativeA },
				subscribers: [] as import('typeorm').EntitySubscriberInterface[],
			};
			const sourceB = {
				driver: { databaseConnection: nativeB },
				subscribers: [] as import('typeorm').EntitySubscriberInterface[],
			};
			const owner = { active: true, accepting: true, mode: 'exclusive' };
			const structure = { context: { getStore: () => owner } };
			const evaluate = jest.fn(function (this: unknown, id: string) {
				expect(this).toBe(runtime);
				expect(id).toBe('model-controller');
				return Promise.resolve(false);
			});
			const runtime = { evaluate };
			const moduleA = {
				get: (type: unknown) =>
					type === DataSource ? sourceA : type === DeviceStructureLockService ? structure : runtime,
			};
			const moduleB = { get: () => sourceB };
			const descriptor = Object.getOwnPropertyDescriptor(nativeA, method);
			const control = captureChannelWriterProgress(
				moduleA as unknown as TestingModule,
				moduleB as unknown as TestingModule,
			);
			const observed: { receiver: unknown; values: unknown[] }[] = [];
			let job: Promise<unknown>;
			try {
				const result = nativeA[method](query, parameters, function (this: unknown, ...values) {
					observed.push({ receiver: this, values });
				});
				expect(result).toBe(returned);
				expect(calls).toEqual([{ receiver: nativeA, query, parameters }]);
				expect(calls[0].parameters).toBe(parameters);
				expect(observed).toEqual([{ receiver: callbackThis, values: [false, parameters] }]);
				expect(observed[0].values[1]).toBe(parameters);
				injected = new Error('native synchronous throw model');
				let failure: unknown;
				try {
					nativeA[method](query, parameters, () => undefined);
				} catch (cause) {
					failure = cause;
				}
				expect(failure).toBe(injected);
				job = runtime.evaluate('model-controller');
				expect(evaluate).not.toHaveBeenCalled();
			} finally {
				await control.close();
			}
			expect(await job).toBe(false);
			expect(evaluate).toHaveBeenCalledTimes(1);
			expect(runtime.evaluate).toBe(evaluate);
			expect(Object.getOwnPropertyDescriptor(nativeA, method)).toEqual(descriptor);
			expect(sourceA.subscribers).toEqual([]);
			expect(sourceB.subscribers).toEqual([]);
		},
	);
});

describe('P05b1b default migrated thermostat HTTP consumer', () => {
	// Normal CI already starts Influx1.8. The local evidence wrapper may supply its owned database name.
	const testInfluxDatabase = process.env.P05B1B_INFLUX_DATABASE ?? `p05b1b_test_${process.pid}`;
	let pendingProgress: ReturnType<typeof captureChannelWriterProgress> | undefined;
	let app: INestApplication | undefined;
	let moduleRef: TestingModule;
	let dataSource: DataSource;
	let directory: string | undefined;
	let accessToken: string;
	let originalEnvironment: Record<string, string | undefined>;
	const environmentKeys = ['NODE_ENV', 'FB_DB_PATH', 'FB_CONFIG_PATH', 'FB_DB_SYNC', 'FB_DB_MIGRATIONS_RUN'];
	beforeEach(async () => {
		expect(process.env.FB_CLI).not.toBe('on');
		originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
		directory = mkdtempSync(path.join(tmpdir(), 'p05b1b-http-'));
		process.env.NODE_ENV = 'production';
		process.env.FB_DB_PATH = directory;
		process.env.FB_CONFIG_PATH = directory;
		process.env.FB_DB_SYNC = 'false';
		process.env.FB_DB_MIGRATIONS_RUN = 'false';
		writeFileSync(
			path.join(directory, 'config.yaml'),
			JSON.stringify({
				plugins: {
					'influx-v1-plugin': { enabled: true, host: '127.0.0.1', database: testInfluxDatabase },
				},
				modules: {},
			}),
		);
		const source = path.resolve(__dirname, '../src');
		const prepared = await createSqliteDataSource({
			type: 'sqlite',
			database: path.join(directory, 'database.sqlite'),
			entities: [source + '/**/*.entity.ts'],
			subscribers: [source + '/**/*.subscriber.ts'],
			migrations: [source + '/migrations/*.ts'],
			migrationsTransactionMode: 'each',
		});
		try {
			expect(await prepared.runMigrations({ transaction: 'each' })).toHaveLength(49);
		} finally {
			await prepared.destroy();
		}
		moduleRef = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();
		dataSource = moduleRef.get(DataSource);
		expect(dataSource.options.database).toBe(path.join(directory, 'database.sqlite'));
		expect(dataSource.options.synchronize).toBe(false);
		expect(dataSource.options.migrationsRun).toBe(false);
		const startupQueries: string[] = [];
		const observer = {
			beforeQuery(event: import('typeorm').BeforeQueryEvent<unknown>) {
				startupQueries.push(event.query);
			},
		};
		dataSource.subscribers.push(observer);
		app = moduleRef.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		useContainer(moduleRef, { fallbackOnErrors: true });
		await app.init();
		expect(moduleRef.get(ConfigService).getPluginConfig<InfluxV1ConfigModel>('influx-v1-plugin').database).toBe(
			testInfluxDatabase,
		);
		expect(moduleRef.get(StorageService).isPrimaryAvailable()).toBe(true);
		expect(moduleRef.get(StorageService).isUsingFallback()).toBe(false);
		dataSource.subscribers.splice(dataSource.subscribers.indexOf(observer), 1);
		const reservation = startupQueries.findIndex(
			(query) => query === 'INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)',
		);
		expect(reservation).toBeGreaterThan(0);
		expect(startupQueries[reservation - 1]).toBe('BEGIN TRANSACTION');
		expect(
			await dataSource.query(
				"SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '%_thermostat_catalog_birth_%'",
			),
		).toHaveLength(6);
		await request(app.getHttpServer())
			.post('/modules/auth/auth/register')
			.send({
				data: {
					username: 'cataloghttp',
					password: 'securePassword123!',
					email: 'cataloghttp@example.com',
				},
			})
			.expect(204);
		const login = await request(app.getHttpServer())
			.post('/modules/auth/auth/login')
			.send({
				data: {
					username: 'cataloghttp',
					password: 'securePassword123!',
				},
			})
			.expect(201);
		accessToken = (login.body as { data: { access_token: string } }).data.access_token;
		expect(accessToken).toEqual(expect.any(String));
	});
	afterEach(async () => {
		try {
			await pendingProgress?.close();
			pendingProgress = undefined;
			await app?.close();
			console.info('channel-admission-A-closed', { initialized: dataSource?.isInitialized });
		} finally {
			app = undefined;
			useContainer({ get: <T>(type: new () => T): T => new type() }, { fallbackOnErrors: true });
			if (directory) rmSync(directory, { recursive: true, force: true });
			for (const key of environmentKeys) {
				if (originalEnvironment[key] === undefined) delete process.env[key];
				else process.env[key] = originalEnvironment[key];
			}
		}
	});
	it.each(['heating', 'dual', 'floor', 'cooling'])(
		'preserves healthy %s and the entire real HTTP wire with physical Influx storage',
		async (variant) => {
			await verifyThermostatWire(
				{ app, moduleRef, dataSource, accessToken },
				{ replaceBeforeCreate: false, variant, failure: 'none' },
			);
		},
	);
	it('preserves actual physical Influx history and setting publication around the three bounded catalog SELECTs', async () => {
		await verifyThermostatWire(
			{ app, moduleRef, dataSource, accessToken },
			{ replaceBeforeCreate: false, variant: 'heating', failure: 'none', storageAudit: true },
		);
	});
	it('keeps actual CRUD and Swagger private while both stamp spellings are rejected at every catalog level', async () => {
		const input = () => ({
			id: uuid(),
			type: 'virtual',
			name: 'Privacy fixture',
			category: DeviceCategory.GENERIC,
			mode: 'projection',
			channels: [
				{
					id: uuid(),
					type: 'virtual',
					name: 'Information',
					identifier: 'device_information',
					category: ChannelCategory.DEVICE_INFORMATION,
					properties: [
						{
							id: uuid(),
							type: 'virtual',
							identifier: 'manufacturer',
							category: PropertyCategory.MANUFACTURER,
							data_type: DataTypeType.STRING,
							permissions: [PermissionType.READ_ONLY],
							value_origin: 'local',
							value: 'privacy-baseline',
						},
					],
				},
			],
		});
		const post = (data: object) =>
			request(app.getHttpServer())
				.post('/modules/devices/devices')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({ data });
		const original = input();
		const created = await post(original).expect(201);
		expect(JSON.stringify(created.body)).not.toMatch(/catalogBirth|catalog_birth/);
		const selected = await request(app.getHttpServer())
			.get(`/modules/devices/devices/${original.id}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200);
		expect(JSON.stringify(selected.body)).not.toMatch(/catalogBirth|catalog_birth/);
		for (const level of ['device', 'channel', 'property'])
			for (const field of ['catalogBirth', 'catalog_birth']) {
				const dto = input();
				const target = level === 'device' ? dto : level === 'channel' ? dto.channels[0] : dto.channels[0].properties[0];
				Reflect.set(target, field, 1);
				const refused = await post(dto);
				expect(refused.status).toBe(400);
				expect((refused.body as { message: string[] }).message.join(' ')).toContain(
					"Unexpected property 'catalog_birth' is not allowed.",
				);
				expect(await dataSource.manager.countBy(DeviceEntity, { id: dto.id })).toBe(0);
			}
		const document = moduleRef.get(SwaggerDocumentService).createDocument(app);
		const bytes = JSON.stringify(document);
		expect(bytes).not.toMatch(/catalogBirth|catalog_birth/);
		if (process.env.P05B1B_PUBLIC_SCHEMA_OUTPUT) writeFileSync(process.env.P05B1B_PUBLIC_SCHEMA_OUTPUT, bytes);
	});
	const verifyIndependent = async (phase: string, operation: 'replace' | 'double-replace' | 'parent' | 'metadata') => {
		const otherModule = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();
		const otherApp = otherModule.createNestApplication();
		otherApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
		const otherSource = otherModule.get(DataSource);
		const owner = moduleRef.get(DeviceStructureLockService);
		const otherOwner = otherModule.get(DeviceStructureLockService);
		const successes: { id: string; birth: string; value: string }[] = [];
		const table =
			operation === 'replace' || operation === 'double-replace'
				? 'devices_module_channels_properties'
				: 'devices_module_channels';
		const finalSnapshot = phase === 'after-detachment';
		let restoreQuery: (() => void) | undefined;
		const mutations: string[] = [];
		const proofs: { transaction: boolean; raw: string; parameters: string }[] = [];
		const proofObserver = {
			afterQuery(event: import('typeorm').AfterQueryEvent<unknown>) {
				if (event.success && event.query.startsWith('WITH root AS'))
					proofs.push({
						transaction: event.queryRunner.isTransactionActive,
						raw: JSON.stringify(event.rawResults),
						parameters: JSON.stringify(event.parameters),
					});
			},
		};
		let graphWrites = 0;
		let otherAccessToken: string;
		const progressCase = phase === 'during-hydration' && operation === 'parent';
		let progress: ReturnType<typeof captureChannelWriterProgress> | undefined;
		const observer = {
			afterQuery(event: import('typeorm').AfterQueryEvent<unknown>) {
				if (event.success && /^UPDATE ["`]?devices_virtual_graph_revision/i.test(event.query)) graphWrites++;
			},
		};
		// Keep the checked-in Jest logger mock as the passthrough target, without adopting its call buffer.
		const errorDescriptor = Object.getOwnPropertyDescriptor(Logger.prototype, 'error');
		const originalError = errorDescriptor.value as Logger['error'];
		const loggedErrors = jest.fn(function (this: Logger, ...args: Parameters<Logger['error']>) {
			originalError.apply(this, args);
		});
		Object.defineProperty(Logger.prototype, 'error', { ...errorDescriptor, value: loggedErrors });
		const loginOther = async () => {
			const login = await request(otherApp.getHttpServer())
				.post('/modules/auth/auth/login')
				.send({ data: { username: 'cataloghttp', password: 'securePassword123!' } })
				.expect(201);
			otherAccessToken = (login.body as { data: { access_token: string } }).data.access_token;
			expect(otherAccessToken).toEqual(expect.any(String));
		};
		try {
			useContainer(otherModule, { fallbackOnErrors: true });
			await otherApp.init();
			expect(otherSource).not.toBe(dataSource);
			expect(otherSource.manager).not.toBe(dataSource.manager);
			expect(otherSource.options.database).toBe(dataSource.options.database);
			expect(otherOwner).not.toBe(owner);
			expect(Object.getOwnPropertyDescriptor(otherSource.driver, 'databaseConnection')?.value).not.toBe(
				Object.getOwnPropertyDescriptor(dataSource.driver, 'databaseConnection')?.value,
			);
			if (progressCase) {
				await loginOther();
				progress = captureChannelWriterProgress(moduleRef, otherModule);
				pendingProgress = progress;
			}
			otherSource.subscribers.push(observer);
			dataSource.subscribers.push(proofObserver);
			useContainer(moduleRef, { fallbackOnErrors: true });
			const replace = async (root: string) => {
				mutations.push('entered');
				expect(owner.hasCurrentStructuralLease()).toBe(true);
				expect(otherOwner.hasCurrentStructuralLease()).toBe(false);
				useContainer(otherModule, { fallbackOnErrors: true });
				try {
					if (!progressCase) await loginOther();
					const info = await otherSource.manager.findOneOrFail(VirtualChannelEntity, {
						where: { device: { id: root }, category: ChannelCategory.DEVICE_INFORMATION },
						relations: ['properties'],
					});
					const original = info.properties.find(
						(property) => property.category === PropertyCategory.MANUFACTURER,
					) as VirtualChannelPropertyEntity;
					expect(original.valueOrigin).toBe('local');
					expect(original.sourcePropertyId).toBeNull();
					expect(await otherSource.manager.countBy(VirtualThermostatSettingEntity, { propertyId: original.id })).toBe(
						0,
					);
					expect(
						await otherSource.manager.countBy(VirtualThermostatActuatorClaimEntity, {
							sourcePropertyId: original.id,
						}),
					).toBe(0);

					if (operation === 'replace' || operation === 'double-replace') {
						const [before] = await otherSource.query<{ birth: string }[]>(
							'SELECT CAST(catalogBirth AS TEXT) birth FROM devices_module_channels_properties WHERE id = ?',
							[original.id],
						);
						const path = `/modules/devices/channels/${info.id}/properties`;
						await request(otherApp.getHttpServer())
							.delete(`${path}/${original.id}`)
							.set('Authorization', `Bearer ${otherAccessToken}`)
							.expect(204);
						await request(otherApp.getHttpServer())
							.post(path)
							.set('Authorization', `Bearer ${otherAccessToken}`)
							.send({
								data: {
									id: original.id,
									type: 'virtual',
									category: original.category,
									identifier: original.identifier,
									name: original.name,
									data_type: original.dataType,
									permissions: original.permissions,
									format: original.format,
									invalid: original.invalid,
									step: original.step,
									value_origin: 'local',
									source_property: null,
									value: 'B-successor-value',
								},
							})
							.expect((response) => {
								if (response.status !== 201)
									console.info(
										'independent-create-failure',
										JSON.stringify({ phase, status: response.status, body: response.body as unknown }),
									);
							})
							.expect(201);
						const [after] = await otherSource.query<{ birth: string }[]>(
							'SELECT CAST(catalogBirth AS TEXT) birth FROM devices_module_channels_properties WHERE id = ?',
							[original.id],
						);
						expect(BigInt(after.birth)).toBeGreaterThan(BigInt(before.birth));
						mutations.push(`A-birth:${before.birth};B-birth:${after.birth}`);
						const stored = await otherSource.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: original.id });
						expect(stored).toMatchObject({
							id: original.id,
							category: original.category,
							identifier: original.identifier,
							name: original.name,
							dataType: original.dataType,
							permissions: original.permissions,
							unit: original.unit,
							format: original.format,
							invalid: original.invalid,
							step: original.step,
							valueOrigin: original.valueOrigin,
							sourcePropertyId: original.sourcePropertyId,
						});
						expect((await otherModule.get(PropertyValueService).readLatest(stored))?.value).toBe('B-successor-value');
						if (operation === 'double-replace') {
							await request(otherApp.getHttpServer())
								.delete(`${path}/${original.id}`)
								.set('Authorization', `Bearer ${otherAccessToken}`)
								.expect(204);
							await request(otherApp.getHttpServer())
								.post(path)
								.set('Authorization', `Bearer ${otherAccessToken}`)
								.send({
									data: {
										id: original.id,
										type: 'virtual',
										category: original.category,
										identifier: original.identifier,
										name: original.name,
										data_type: original.dataType,
										permissions: original.permissions,
										format: original.format,
										invalid: original.invalid,
										step: original.step,
										value_origin: 'local',
										source_property: null,
										value: 'C-restored-metadata-value',
									},
								})
								.expect(201);
							const [restored] = await otherSource.query<{ birth: string }[]>(
								'SELECT CAST(catalogBirth AS TEXT) birth FROM devices_module_channels_properties WHERE id = ?',
								[original.id],
							);
							expect(BigInt(restored.birth)).toBeGreaterThan(BigInt(after.birth));
							mutations.push(`C-birth:${restored.birth}`);
							const final = await otherSource.manager.findOneByOrFail(VirtualChannelPropertyEntity, {
								id: original.id,
							});
							expect(final).toMatchObject({
								id: original.id,
								category: original.category,
								identifier: original.identifier,
								name: original.name,
								dataType: original.dataType,
								permissions: original.permissions,
								unit: original.unit,
								format: original.format,
								invalid: original.invalid,
								step: original.step,
								valueOrigin: original.valueOrigin,
								sourcePropertyId: original.sourcePropertyId,
							});
							successes.push({ id: final.id, birth: restored.birth, value: 'C-restored-metadata-value' });
						} else successes.push({ id: stored.id, birth: after.birth, value: 'B-successor-value' });
					} else {
						const [before] = await otherSource.query<{ birth: string; parentId: string | null }[]>(
							'SELECT CAST(catalogBirth AS TEXT) birth, parentId FROM devices_module_channels WHERE id = ?',
							[info.id],
						);
						expect(before.parentId).toBeNull();
						const parent = await otherSource.manager.findOneOrFail(VirtualChannelEntity, {
							where: { device: { id: root }, category: ChannelCategory.TEMPERATURE },
						});
						expect(parent.id).not.toBe(info.id);
						expect(parent.parentId).toBeNull();
						const value = operation === 'parent' ? parent.id : 'B same-birth metadata';
						await progress?.beforePatch(info.id, root);
						await request(otherApp.getHttpServer())
							.patch(`/modules/devices/channels/${info.id}`)
							.set('Authorization', `Bearer ${otherAccessToken}`)
							.send({
								data: { type: 'virtual', ...(operation === 'parent' ? { parent: parent.id } : { name: value }) },
							})
							.expect((result) => {
								if (result.status !== 200)
									console.info(
										'independent-channel-patch-failure',
										JSON.stringify({
											operation,
											phase,
											status: result.status,
											body: result.body as unknown,
											errors: loggedErrors.mock.calls.slice(-20).map((args) =>
												args.map((value: unknown) =>
													value instanceof Error
														? {
																name: value.name,
																message: value.message,
																stack: value.stack,
																query: Reflect.get(value, 'query') as unknown,
																parameters: Array.isArray(Reflect.get(value, 'parameters'))
																	? (Reflect.get(value, 'parameters') as unknown[]).map((parameter) =>
																			typeof parameter === 'string' &&
																			/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parameter)
																				? parameter
																				: '<REDACTED non-UUID>',
																		)
																	: undefined,
															}
														: typeof value === 'string'
															? value
															: typeof value,
												),
											),
										}),
									);
							})
							.expect(200);
						const [after] = await otherSource.query<{ birth: string; parentId: string | null; name: string }[]>(
							'SELECT CAST(catalogBirth AS TEXT) birth, parentId, name FROM devices_module_channels WHERE id = ?',
							[info.id],
						);
						expect(after.birth).toBe(before.birth);
						if (operation === 'parent') expect(after.parentId).toBe(parent.id);
						else {
							expect(after.parentId).toBeNull();
							expect(after.name).toBe(value);
						}
						successes.push({ id: info.id, birth: after.birth, value });
					}
				} finally {
					useContainer(moduleRef, { fallbackOnErrors: true });
				}
				expect(owner.hasCurrentStructuralLease()).toBe(true);
			};
			if (finalSnapshot) {
				const query = dataSource.manager.query.bind(dataSource.manager) as typeof dataSource.manager.query;
				let reads = 0;
				const held = jest
					.spyOn(dataSource.manager, 'query')
					.mockImplementation(async (...args: Parameters<typeof query>) => {
						const raw: unknown = await query(...args);
						if (typeof args[0] === 'string' && args[0].startsWith('WITH root AS') && ++reads === 2) {
							// V0 uses the distinct scoped manager. This is global Before=1, After=2.
							// The real After snapshot completed after candidate detachment.
							expect(proofs).toHaveLength(3);
							await replace((args[1] as string[])[0]);
						}
						return raw;
					});
				restoreQuery = () => held.mockRestore();
			}

			try {
				const wire = verifyThermostatWire(
					{ app, moduleRef, dataSource, accessToken },
					{
						replaceBeforeCreate: false,
						variant: 'heating',
						failure: 'none',
						interleave: {
							expectedFallback: operation !== 'metadata' && !finalSnapshot,
							foreignGraphWrites: () => graphWrites,
							auditName: `${operation}-${phase}`,
							...(!finalSnapshot && phase === 'before-presence'
								? { afterPublication: replace }
								: !finalSnapshot
									? { afterHydration: (device: VirtualDeviceEntity) => replace(device.id) }
									: {}),
						},
					},
				);
				progress?.own(wire);
				await wire;
				progress?.verify();
			} finally {
				if (successes.length !== 1)
					console.info(
						'independent-writer-not-completed',
						JSON.stringify({
							phase,
							mutations,
							errors: loggedErrors.mock.calls
								.filter(([message]) => typeof message === 'string' && message.startsWith('Thermostat committed'))
								.slice(-20)
								.map((args) =>
									args.map((value: unknown) =>
										value instanceof Error ? { message: value.message, stack: value.stack } : value,
									),
								),
						}),
					);
			}
			expect(successes).toHaveLength(1);
			const earlyVeto = operation !== 'metadata' && phase === 'before-presence';
			expect(proofs).toHaveLength(earlyVeto ? 2 : 3);
			expect(proofs.map(({ transaction }) => transaction)).toEqual(earlyVeto ? [true, false] : [true, false, false]);
			const birthAt = (index: number) =>
				(JSON.parse(proofs[index].raw) as { section: string; payload: string }[])
					.filter(({ section }) => section === 'member')
					.map(({ payload }) => JSON.parse(payload) as { id: string; birth: string })
					.find(({ id }) => id === successes[0].id).birth;
			if (operation === 'replace' || operation === 'double-replace') {
				expect(BigInt(birthAt(0))).toBeLessThan(BigInt(successes[0].birth));
				if (!finalSnapshot) expect(birthAt(phase === 'before-presence' ? 1 : 2)).toBe(successes[0].birth);
				if (phase === 'during-hydration' || finalSnapshot) expect(birthAt(1)).toBe(birthAt(0));
				if (finalSnapshot) expect(birthAt(2)).toBe(birthAt(0));
			} else for (let index = 0; index < proofs.length; index++) expect(birthAt(index)).toBe(successes[0].birth);

			for (const winner of successes) {
				expect(
					await otherSource.query(`SELECT CAST(catalogBirth AS TEXT) birth FROM ${table} WHERE id = ?`, [winner.id]),
				).toEqual([{ birth: winner.birth }]);
				if (operation === 'replace' || operation === 'double-replace') {
					const stored = await otherSource.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: winner.id });
					expect((await otherModule.get(PropertyValueService).readLatest(stored))?.value).toBe(winner.value);
				} else {
					const stored = await otherSource.manager.findOneByOrFail(VirtualChannelEntity, { id: winner.id });
					expect(operation === 'parent' ? stored.parentId : stored.name).toBe(winner.value);
				}
			}
		} finally {
			try {
				try {
					if (process.env.P05B1B_TEST_ARTIFACT_DIR)
						writeFileSync(
							path.join(process.env.P05B1B_TEST_ARTIFACT_DIR, `identity-${operation}-${phase}.json`),
							JSON.stringify({ phase, operation, mutations, proofs, successes, graphWrites }),
						);
				} finally {
					try {
						restoreQuery?.();
						const index = dataSource.subscribers.indexOf(proofObserver);
						if (index >= 0) dataSource.subscribers.splice(index, 1);
					} finally {
						try {
							await progress?.close();
							pendingProgress = undefined;
							await otherApp.close();
							if (progress) console.info('channel-admission-B-closed', { initialized: otherSource.isInitialized });
						} finally {
							useContainer(moduleRef, { fallbackOnErrors: true });
						}
					}
				}
			} finally {
				Object.defineProperty(Logger.prototype, 'error', errorDescriptor);
			}
		}
	};
	it.each(['before-presence', 'during-hydration'])(
		'vetoes a genuine independent same-file public remove/create successor at %s',
		(phase) => verifyIndependent(phase, 'replace'),
	);
	it.each(['before-presence', 'during-hydration'])(
		'vetoes a genuine independent acyclic same-device parent PATCH at %s without rebirth',
		(phase) => verifyIndependent(phase, 'parent'),
	);
	it('keeps genuine independent same-birth metadata and graph advances eligible with original configuration', () =>
		verifyIndependent('before-presence', 'metadata'));
	it('keeps the detached healthy response when genuine B wins after the final After snapshot', () =>
		verifyIndependent('after-detachment', 'replace'));

	it('vetoes genuine B-to-C sameUUID information-row restoration during the one ordinary hydration', () =>
		verifyIndependent('during-hydration', 'double-replace'));
	it.each([
		'device-parent',
		'channel-parent',
		'base-prototype',
		'subclass-prototype',
		'own-constructor',
		'own-type-accessor',
		'missing-channels',
		'partial-properties',
		'duplicate-property',
		'missing-parent-null',
		'undefined-parent-null',
		'wrong-device-owner',
		'wrong-channel-owner',
		'null-properties',
		'nonarray-channels',
		'extra-property',
		'extra-channel',
		'own-wrong-type',
	])(
		'refuses a real hydrated receiver with a wrong %s kind before the pinned virtual getter can bless it',
		async (kind) => {
			const descriptor = Object.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype, 'type');
			let candidate: VirtualDeviceEntity | undefined;
			let forced = 0;
			Object.defineProperty(VirtualDeviceEntity.prototype, 'type', {
				...descriptor,
				get: function (this: VirtualDeviceEntity) {
					if (this === candidate) forced++;
					const value: unknown = descriptor.get.call(this);
					return value;
				},
			});
			try {
				await verifyThermostatWire(
					{ app, moduleRef, dataSource, accessToken },
					{
						replaceBeforeCreate: false,
						variant: 'heating',
						failure: 'none',
						interleave: {
							expectedFallback: true,
							afterHydration: (device) => {
								candidate = device;
								switch (kind) {
									case 'device-parent':
										device.channels[0].device = Object.assign(new VirtualChannelEntity(), {
											id: device.id,
										}) as unknown as DeviceEntity;
										break;
									case 'channel-parent':
										device.channels[0].properties[0].channel = Object.assign(new VirtualDeviceEntity(), {
											id: device.channels[0].id,
										}) as unknown as ChannelEntity;
										break;
									case 'base-prototype':
										Object.setPrototypeOf(device, DeviceEntity.prototype);
										break;
									case 'subclass-prototype': {
										class Successor extends VirtualDeviceEntity {}
										Object.setPrototypeOf(device, Successor.prototype);
										break;
									}
									case 'own-constructor':
										Object.defineProperty(device, 'constructor', { value: VirtualChannelEntity, configurable: true });
										break;
									case 'own-type-accessor':
										Object.defineProperty(device, 'type', {
											get: () => {
												forced++;
												return 'virtual';
											},
											configurable: true,
										});
										break;
									case 'missing-channels':
										Reflect.deleteProperty(device, 'channels');
										break;
									case 'partial-properties':
										device.channels[0].properties = [];
										break;
									case 'duplicate-property':
										device.channels[0].properties.push(device.channels[0].properties[0]);
										break;
									case 'missing-parent-null':
										Reflect.deleteProperty(device.channels[0], 'parentId');
										break;
									case 'wrong-device-owner':
										device.channels[0].device = Object.assign(new VirtualDeviceEntity(), { id: uuid() });
										break;
									case 'wrong-channel-owner':
										device.channels[0].properties[0].channel = Object.assign(new VirtualChannelEntity(), {
											id: uuid(),
										});
										break;
									case 'null-properties':
										Reflect.set(device.channels[0], 'properties', null);
										break;
									case 'nonarray-channels':
										Reflect.set(device, 'channels', {});
										break;
									case 'extra-property':
										device.channels[0].properties.push(
											Object.assign(new VirtualChannelPropertyEntity(), device.channels[0].properties[0], {
												id: uuid(),
											}),
										);
										break;
									case 'extra-channel':
										device.channels.push(
											Object.assign(new VirtualChannelEntity(), device.channels[0], { id: uuid(), properties: [] }),
										);
										break;
									case 'own-wrong-type':
										Object.defineProperty(device, 'type', { value: 'simulator', configurable: true });
										break;
									case 'undefined-parent-null':
										device.channels[0].parentId = undefined;
										break;
								}
								return Promise.resolve();
							},
						},
					},
				);
				expect(forced).toBe(0);
			} finally {
				console.info('wrong-parent-kind-getter', JSON.stringify({ kind, forced }));
				Object.defineProperty(VirtualDeviceEntity.prototype, 'type', descriptor);
			}
		},
	);
	it('accepts healthy loaded Virtual parents with exact owned identities and complete wire', async () => {
		await verifyThermostatWire(
			{ app, moduleRef, dataSource, accessToken },
			{
				replaceBeforeCreate: false,
				variant: 'heating',
				failure: 'none',
				interleave: {
					afterHydration: (device) => {
						for (const channel of device.channels) {
							channel.device = Object.assign(new VirtualDeviceEntity(), { id: device.id });
							for (const property of channel.properties)
								property.channel = Object.assign(new VirtualChannelEntity(), { id: channel.id });
						}
						return Promise.resolve();
					},
				},
			},
		);
	});
	it('accepts overlapping UUIDs across physical kinds through the actual supported thermostat POST', async () => {
		const created = await verifyThermostatWire(
			{ app, moduleRef, dataSource, accessToken },
			{ replaceBeforeCreate: false, variant: 'heating', failure: 'none', overlapKinds: true },
		);
		expect(created.device.channels[0].id).toBe(created.device.id);
		expect(created.device.channels[0].properties[0].id).toBe(created.device.id);
	});
	it('retains original same-physical-kind duplicate refusal and complete atomic absence', async () => {
		await verifyThermostatWire(
			{ app, moduleRef, dataSource, accessToken },
			{ replaceBeforeCreate: false, variant: 'heating', failure: 'none', duplicateKind: true },
		);
	});
});

describe('P05b1b fresh full AppModule schema composition', () => {
	it('reserves two real startup owners and preserves a no-change full sync/restart with normal memory fallback', async () => {
		const keys = ['NODE_ENV', 'FB_DB_PATH', 'FB_CONFIG_PATH', 'FB_DB_SYNC', 'FB_DB_MIGRATIONS_RUN'];
		const environment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
		const directory = mkdtempSync(path.join(tmpdir(), 'p05b1b-fresh-nest-'));
		const applications: INestApplication[] = [];
		let failure: { cause: unknown } | undefined;
		const state = async (source: DataSource) => {
			const schema = await source.query<{ name: string; type: string; sql: string }[]>(
				"SELECT name,type,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_autoindex_%' ORDER BY name",
			);
			const rows: Record<string, unknown> = {};
			for (const table of schema.filter(({ type }) => type === 'table'))
				rows[table.name] = await source.query(`SELECT * FROM "${table.name.replaceAll('"', '""')}"`);
			return { schema, rows };
		};
		const construct = async () => {
			const module = await Test.createTestingModule({
				imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
			}).compile();
			const app = module.createNestApplication();
			app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
			applications.push(app);
			return { app, module, source: module.get(DataSource) };
		};
		try {
			process.env.NODE_ENV = 'production';
			process.env.FB_DB_PATH = directory;
			process.env.FB_CONFIG_PATH = directory;
			process.env.FB_DB_SYNC = 'true';
			process.env.FB_DB_MIGRATIONS_RUN = 'false';
			writeFileSync(
				path.join(directory, 'config.yaml'),
				JSON.stringify({ plugins: { 'influx-v1-plugin': { enabled: false } }, modules: {} }),
			);
			// Finish the requested offline ORM DDL before racing the two actual serving readiness hooks.
			const first = await construct(),
				second = await construct();
			expect(first.source).not.toBe(second.source);
			expect(first.source.manager).not.toBe(second.source.manager);
			expect(first.source.options.database).toBe(second.source.options.database);
			const observations = [[], []] as [string[], string[]];
			const catalogReads = [[], []] as [number[], number[]];
			for (const [index, item] of [first, second].entries())
				item.source.subscribers.push({
					beforeQuery: (event) => {
						observations[index].push(event.query);
						if (
							event.query.startsWith('SELECT name FROM sqlite_master WHERE name IN') &&
							Array.isArray(event.parameters) &&
							event.parameters.length === 8 &&
							event.parameters.every(
								(value: unknown) => typeof value === 'string' && value.includes('_thermostat_catalog_birth_'),
							)
						)
							catalogReads[index].push(observations[index].length - 1);
					},
				});
			await Promise.all([first.app.init(), second.app.init()]);
			for (const queries of observations) {
				const index = queries.indexOf(
					'INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)',
				);
				expect(index).toBeGreaterThan(0);
				expect(queries[index - 1]).toBe('BEGIN TRANSACTION');
			}
			for (const [index, reads] of catalogReads.entries()) {
				expect(reads.length).toBeGreaterThan(0);
				const read = reads[0];
				expect(observations[index][read - 1]).toBe(
					'INSERT OR IGNORE INTO "devices_virtual_graph_revision" ("id", "revision") VALUES (1, 0)',
				);
				expect(observations[index][read - 2]).toBe('BEGIN TRANSACTION');
			}
			for (const item of [first, second]) {
				expect(item.module.get(StorageService).isPrimaryAvailable()).toBe(false);
				expect(item.module.get(StorageService).isUsingFallback()).toBe(true);
			}
			await first.source.manager.insert(DeviceEntity, {
				id: 'fresh-device',
				name: 'Fresh preserved row',
				category: DeviceCategory.GENERIC,
			});
			await first.source.manager.insert(ChannelEntity, {
				id: 'fresh-channel',
				name: 'Fresh channel',
				category: ChannelCategory.GENERIC,
				device: 'fresh-device',
			});
			await first.source.manager.insert(ChannelPropertyEntity, {
				id: 'fresh-property',
				category: PropertyCategory.GENERIC,
				identifier: 'fresh',
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				channel: 'fresh-channel',
			});
			const before = await state(first.source);
			expect(
				before.schema.filter(({ name, type }) => type === 'trigger' && name.includes('_thermostat_catalog_birth_')),
			).toHaveLength(6);
			expect((await first.source.driver.createSchemaBuilder().log()).upQueries).toEqual([]);
			await first.source.synchronize();
			expect(await state(first.source)).toEqual(before);
			await second.app.close();
			applications.splice(applications.indexOf(second.app), 1);
			await first.app.close();
			applications.splice(applications.indexOf(first.app), 1);
			const third = await construct();
			await third.app.init();
			expect(await state(third.source)).toEqual(before);
			expect((await third.source.driver.createSchemaBuilder().log()).upQueries).toEqual([]);
			useContainer(third.module, { fallbackOnErrors: true });
			expect(third.module.get(StorageService).isPrimaryAvailable()).toBe(false);
			expect(third.module.get(StorageService).isUsingFallback()).toBe(true);
			await request(third.app.getHttpServer())
				.post('/modules/auth/auth/register')
				.send({
					data: { username: 'memorycatalog', password: 'securePassword123!', email: 'memorycatalog@example.com' },
				})
				.expect(204);
			const login = await request(third.app.getHttpServer())
				.post('/modules/auth/auth/login')
				.send({ data: { username: 'memorycatalog', password: 'securePassword123!' } })
				.expect(201);
			const accessToken = (login.body as { data: { access_token: string } }).data.access_token;
			await verifyThermostatWire(
				{ app: third.app, moduleRef: third.module, dataSource: third.source, accessToken },
				{ replaceBeforeCreate: false, variant: 'heating', failure: 'none', storageAudit: true },
			);
		} catch (cause: unknown) {
			failure = { cause };
		} finally {
			for (const app of applications.reverse()) {
				try {
					await app.close();
				} catch (cause: unknown) {
					failure ??= { cause };
				}
			}
			useContainer({ get: <T>(type: new () => T): T => new type() }, { fallbackOnErrors: true });
			for (const key of keys) {
				if (environment[key] === undefined) delete process.env[key];
				else process.env[key] = environment[key];
			}
			rmSync(directory, { recursive: true, force: true });
		}
		if (failure) throw failure.cause;
	});
});
