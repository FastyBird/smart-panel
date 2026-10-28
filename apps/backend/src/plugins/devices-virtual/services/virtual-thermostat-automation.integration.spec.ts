import { randomUUID } from 'node:crypto';
import { BeforeQueryEvent, UpdateEvent } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { realThermostatGuardFixture } from '../../../../test/support/thermostat-real-guard-fixture';
import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	observeSqliteOuterOutcome,
} from '../../../common/database/sqlite-data-source';
import { ConfigService as ModuleConfigService } from '../../../modules/config/services/config.service';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceContributionRegistryService } from '../../../modules/devices/services/device-contribution.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { DisplayEntity } from '../../../modules/displays/entities/displays.entity';
import { IntentTimeseriesService } from '../../../modules/intents/services/intent-timeseries.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceLifecycleRegistryService } from '../../../modules/spaces/services/space-lifecycle-registry.service';
import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { StorageService } from '../../../modules/storage/services/storage.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import {
	ACTIVITY_STATE_CHANGED,
	ActivityActivationStatus,
	ActivityDomain,
	ActivityDomainStatus,
	ActivityMode,
} from '../../spaces-home-control/activity/space-activity.constants';
import { defaultActivityConfiguration } from '../../spaces-home-control/activity/space-activity.defaults';
import { CreateHomeControlSpaceDto } from '../../spaces-home-control/dto/create-home-control-space.dto';
import { UpdateHomeControlSpaceDto } from '../../spaces-home-control/dto/update-home-control-space.dto';
import { RoomSpaceEntity } from '../../spaces-home-control/entities/room-space.entity';
import { SpaceActivityStateEntity } from '../../spaces-home-control/entities/space-activity-state.entity';
import { ClimateContributionPlannerService } from '../../spaces-home-control/services/climate-contribution-planner.service';
import { ClimateIntentService } from '../../spaces-home-control/services/climate-intent.service';
import { SpaceActivityConfigService } from '../../spaces-home-control/services/space-activity-config.service';
import { SpaceActivityDomainsService } from '../../spaces-home-control/services/space-activity-domains.service';
import { SpaceActivationIdentity } from '../../spaces-home-control/services/space-climate-automation.port';
import { SpaceClimateAutomationService } from '../../spaces-home-control/services/space-climate-automation.service';
import { SpaceClimateStateService } from '../../spaces-home-control/services/space-climate-state.service';
import { SpaceModeService } from '../../spaces-home-control/services/space-mode.service';
import { SpaceStateReadService } from '../../spaces-home-control/services/space-state-read.service';
import { ClimateMode } from '../../spaces-home-control/spaces-home-control.constants';
import { CreateSignageInfoPanelSpaceDto } from '../../spaces-signage-info-panel/dto/create-signage-info-panel-space.dto';
import { UpdateSignageInfoPanelSpaceDto } from '../../spaces-signage-info-panel/dto/update-signage-info-panel-space.dto';
import { SignageInfoPanelSpaceEntity } from '../../spaces-signage-info-panel/entities/signage-info-panel-space.entity';
import { ConfigureVirtualThermostatDto } from '../dto/thermostat-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualThermostatCommandEntity } from '../entities/virtual-thermostat-runtime.entity';
import {
	ThermostatSetting,
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
	VirtualThermostatSettingEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import { readControllerMutationImage } from './thermostat-controller-mutation';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatAutomationService } from './virtual-thermostat-automation.service';
import { ThermostatInstalledQualification, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';
import { thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';
import { VirtualThermostatTransportService } from './virtual-thermostat-transport.service';

/** Actual activity/intent/producer/provider/native installation. No transport or hardware qualification claim. */
describe('configured activity through the native thermostat participant', () => {
	let database: SqliteDataSource;
	let provider: VirtualThermostatAutomationService;
	let producer: SpaceClimateAutomationService;
	let registry: ClimateAutomationRegistryService;
	let ledger: ClimateAutomationLedgerService;
	let configs: SpaceActivityConfigService;
	let configuration: VirtualThermostatConfigService;
	let comfort: VirtualThermostatComfortService;
	let modes: SpaceModeService;
	let reads: SpaceStateReadService;
	let metadata: PropertyMetadataService;
	let structure: DeviceStructureLockService;
	let graph: VirtualDependencyGraphService;
	let events: EventEmitter2;
	let lifecycle: SpaceLifecycleRegistryService;
	let intentSpaces: SpacesService;
	let ordinaryStorage: StorageService;
	let roomId: string;
	let controllerId: string;
	beforeEach(async () => {
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		structure = new DeviceStructureLockService();
		registry = new ClimateAutomationRegistryService();
		ledger = new ClimateAutomationLedgerService(database, structure, registry);
		graph = new VirtualDependencyGraphService(database, undefined, ledger);
		events = new EventEmitter2();
		provider = new VirtualThermostatAutomationService(database, registry, ledger, graph, structure);
		provider.onModuleInit();
		// The claim/publication boundary is not a transport simulator and grants no ON qualification.
		const claims = {
			qualification: jest.fn().mockReturnValue(null),
			revokeQualification: jest.fn(),
			holdRecoveryFence: jest.fn(() => () => undefined),
			revokeAllQualifications: jest.fn(),
			invalidate: jest.fn(),
			refresh: jest.fn().mockResolvedValue(undefined),
		} as unknown as VirtualThermostatClaimsService;
		new VirtualThermostatOwnershipSubscriber(database, claims);
		configuration = new VirtualThermostatConfigService(
			database,
			structure,
			graph,
			claims,
			events,
			{} as never,
			undefined,
			provider,
		);
		configuration.onModuleInit();
		comfort = new VirtualThermostatComfortService(database, structure, graph, claims, events, provider);
		metadata = new PropertyMetadataService(database);
		ordinaryStorage = new StorageService({ getModuleConfig: () => ({}) } as unknown as ModuleConfigService);
		const connectivity = new DeviceConnectionStateService(ordinaryStorage);
		const values = new PropertyValueService(
			ordinaryStorage,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService(database),
		);
		const deviceGraphs = new DeviceCommandGraphService(metadata, values, connectivity);
		intentSpaces = new SpacesService(
			database.getRepository(SpaceEntity),
			database.getRepository(DeviceEntity),
			database.getRepository(DisplayEntity),
			{} as never,
			{} as never,
			new PlatformRegistryService(),
			connectivity,
			database,
			events,
			new SpacesTypeMapperService(),
		);
		const timeseries = new IntentTimeseriesService(ordinaryStorage);
		reads = new SpaceStateReadService(database, metadata, deviceGraphs, new ConfigService());
		const climate = new SpaceClimateStateService(
			reads,
			timeseries,
			new ClimateContributionPlannerService(new DeviceContributionRegistryService()),
		);
		const intents = new ClimateIntentService(
			intentSpaces,
			{} as never,
			{} as never,
			climate,
			{} as never,
			{} as never,
			{} as never,
			events,
			{} as never,
			{} as never,
		);
		lifecycle = new SpaceLifecycleRegistryService(structure, ledger);
		producer = new SpaceClimateAutomationService(database, registry, ledger, structure, lifecycle, intents);
		producer.onModuleInit();
		configs = new SpaceActivityConfigService(database, lifecycle, events, producer);
		configs.onModuleInit();
		const room = await database
			.getRepository(RoomSpaceEntity)
			.save(database.getRepository(RoomSpaceEntity).create({ name: 'Activity room' }));
		roomId = room.id;
		await database.transaction((manager) => lifecycle.reconcile(room, manager));
		controllerId = randomUUID();
		await database.manager.insert(VirtualDeviceEntity, {
			id: controllerId,
			name: 'Room thermostat',
			roomId,
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			hidden: false,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: randomUUID(),
			device: controllerId,
			name: 'Heater',
			identifier: 'heater',
			category: ChannelCategory.HEATER,
		});
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
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(),
		});
		const current = await comfort.get(controllerId);
		await comfort.configure(
			controllerId,
			{ expected_revision: current.revision, expected_graph_revision: current.graph_revision },
			{
				heating_range: { minimum: 10, maximum: 30 },
				cooling_range: null,
				presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
				automation_enabled: true,
			},
		);
		const domains = new SpaceActivityDomainsService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			producer,
		);
		modes = new SpaceModeService(database, configs, domains, events, undefined, producer);
	});
	afterEach(async () => {
		configuration?.onModuleDestroy();
		configs?.onModuleDestroy();
		producer?.onModuleDestroy();
		provider?.onModuleDestroy();
		registry?.onModuleDestroy();
		reads?.onModuleDestroy();
		metadata?.onModuleDestroy();
		await ordinaryStorage?.onApplicationShutdown();
		if (database?.isInitialized) await database.destroy();
	});
	it('reserves native schema installation before reads and rolls back a failed commit callback before fresh bootstrap', async () => {
		const name = 'virtual_thermostat_capture_admitted_deletion';
		const failure = new Error('original deletion schema callback');
		const statements: string[] = [];
		let armed = true;
		const observer = {
			beforeQuery(event: { query: string }) {
				statements.push(event.query);
				if (event.query.startsWith('PRAGMA table_info')) expect(structure.captureExclusiveOwner()()).toBe(true);
			},
			beforeTransactionCommit() {
				if (armed) {
					armed = false;
					throw failure;
				}
			},
		};
		database.subscribers.push(observer);
		try {
			await expect(provider.onApplicationBootstrap()).rejects.toBe(failure);
			expect(armed).toBe(false);
			expect(await database.query('SELECT name FROM sqlite_master WHERE name = ?', [name])).toEqual([]);
			expect(statements.slice(0, 3)).toEqual([
				'BEGIN TRANSACTION',
				'UPDATE "devices_virtual_graph_revision" SET "revision"="revision" WHERE 0',
				'PRAGMA table_info("devices_module_devices")',
			]);
			await provider.onApplicationBootstrap();
			const rows = await database.query<{ sql: string }[]>('SELECT sql FROM sqlite_master WHERE name = ?', [name]);
			expect(rows).toHaveLength(1);
			await provider.onApplicationBootstrap();
			expect(await database.query('SELECT sql FROM sqlite_master WHERE name = ?', [name])).toEqual(rows);
			await database.query(`DROP TRIGGER "${name}"`);
			await database.query(`CREATE TRIGGER "${name}" BEFORE DELETE ON devices_module_devices BEGIN SELECT 1; END`);
			const foreign = await database.query<{ sql: string }[]>('SELECT sql FROM sqlite_master WHERE name = ?', [name]);
			await expect(provider.onApplicationBootstrap()).rejects.toThrow('provenance');
			expect(await database.query('SELECT sql FROM sqlite_master WHERE name = ?', [name])).toEqual(foreign);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
		}
	});

	it('CLI construction and lifecycle register no live provider/producer and perform no SQL', async () => {
		const previous = process.env.FB_CLI;
		const dormantRegistry = new ClimateAutomationRegistryService();
		const query = jest.spyOn(database, 'query');
		const transaction = jest.spyOn(database, 'transaction');
		try {
			process.env.FB_CLI = 'on';
			const dormantProvider = new VirtualThermostatAutomationService(
				database,
				dormantRegistry,
				ledger,
				graph,
				structure,
			);
			const dormantProducer = new SpaceClimateAutomationService(
				database,
				dormantRegistry,
				ledger,
				structure,
				lifecycle,
			);
			dormantProvider.onModuleInit();
			await dormantProvider.onApplicationBootstrap();
			dormantProducer.onModuleInit();
			expect(dormantRegistry.captureProvider('virtual-thermostat:v1')).toBeNull();
			expect(dormantRegistry.captureProducer('space-activity:v1')).toBeNull();
			expect(query).not.toHaveBeenCalled();
			expect(transaction).not.toHaveBeenCalled();
			dormantProvider.onModuleDestroy();
			dormantProducer.onModuleDestroy();
		} finally {
			if (previous === undefined) delete process.env.FB_CLI;
			else process.env.FB_CLI = previous;
			query.mockRestore();
			transaction.mockRestore();
			dormantRegistry.onModuleDestroy();
		}
	});
	const author = async (selection: { thermostat_preset?: 'eco'; setpoint?: number; setpoint_delta?: number }) => {
		const configuration = defaultActivityConfiguration(ActivityMode.WORK);
		for (const domain of Object.values(ActivityDomain)) configuration[domain].enabled = false;
		configuration.climate = {
			enabled: true,
			...(selection.thermostat_preset ? {} : { mode: ClimateMode.HEAT }),
			...selection,
		};
		return configs.update(roomId, ActivityMode.WORK, {
			expected_revision: 1,
			enabled: true,
			display_order: 0,
			configuration,
		});
	};
	const appliedComfortFixture = async (kind: 'selection' | 'definition', state: 'EMPTY' | 'RETIRED') => {
		// Retain the actual initialized EMPTY or original activity lifecycle's RETIRED sidecar.
		if (state === 'RETIRED') {
			const authored = await author({ thermostat_preset: 'eco' });
			const activation = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			await modes.deactivateMode(roomId, activation.activationId, 'operator');
		}
		expect((await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).state).toBe(state);
		const before = await readControllerMutationImage(database.manager, controllerId);
		const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
		const current = await comfort.get(controllerId);
		const fence = { expected_revision: current.revision, expected_graph_revision: current.graph_revision };
		const presets = current.configuration.presets.map((entry) => ({
			...entry,
			setpoints: { ...entry.setpoints, heating_setpoint: 18 },
		}));
		const expected = kind === 'selection' ? { ...row.comfort, selected_preset: 'eco' } : { ...row.comfort, presets };
		const write = () =>
			kind === 'selection'
				? comfort.select(controllerId, fence, 'eco', false)
				: comfort.configure(controllerId, fence, {
						heating_range: current.configuration.heating_range,
						cooling_range: current.configuration.cooling_range,
						presets,
						automation_enabled: true,
					});
		const tables = [
			'devices_virtual_thermostat_configs',
			'devices_virtual_graph_revision',
			'devices_module_climate_automation_slots',
			'devices_module_climate_automation_sources',
		];
		const snapshot = () =>
			Promise.all(tables.map((table) => database.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`)));
		return { before, row, slot, fence, expected, write, snapshot };
	};

	it.each([
		['selection', 'EMPTY', 'before-update'],
		['selection', 'EMPTY', 'after-update'],
		['selection', 'EMPTY', 'late-slot'],
		['selection', 'RETIRED', 'before-update'],
		['selection', 'RETIRED', 'after-update'],
		['selection', 'RETIRED', 'late-slot'],
		['definition', 'EMPTY', 'before-update'],
		['definition', 'EMPTY', 'after-update'],
		['definition', 'EMPTY', 'late-slot'],
		['definition', 'RETIRED', 'before-update'],
		['definition', 'RETIRED', 'after-update'],
		['definition', 'RETIRED', 'late-slot'],
	] as const)('refuses whole-image drift for applied comfort %s in %s at %s', async (kind, state, phase) => {
		const f = await appliedComfortFixture(kind, state),
			before = await f.snapshot();
		let armed = true,
			driftAcknowledged = false;
		let receipt: SqliteCommitGuardReceipt | undefined;
		const drift = async (event: UpdateEvent<object>) => {
			armed = false;
			expect(structure.captureExclusiveOwner()()).toBe(true);
			expect(event.queryRunner.isTransactionActive).toBe(true);
			receipt = observeSqliteOuterOutcome(event.manager);
			await event.manager.update(VirtualThermostatConfigEntity, { controllerId }, { contactClosingMs: 987 });
			expect(
				(await event.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).contactClosingMs,
			).toBe(987);
			driftAcknowledged = true;
		};
		const originalConfigUpdate = (event: UpdateEvent<object>) =>
			event.metadata.target === VirtualThermostatConfigEntity && event.entity && Object.hasOwn(event.entity, 'comfort');
		const observer = {
			beforeUpdate: async (event: UpdateEvent<object>) => {
				if (armed && phase === 'before-update' && originalConfigUpdate(event)) await drift(event);
			},
			afterUpdate: async (event: UpdateEvent<object>) => {
				if (
					armed &&
					((phase === 'after-update' && originalConfigUpdate(event)) ||
						(phase === 'late-slot' && event.metadata.target === ClimateAutomationSlotEntity))
				)
					await drift(event);
			},
		};
		database.subscribers.push(observer);
		const emitted = jest.spyOn(events, 'emit');
		try {
			let failure: { cause: unknown } | undefined;
			try {
				await f.write();
			} catch (cause: unknown) {
				failure = { cause };
			}
			expect(armed).toBe(false);
			expect(driftAcknowledged).toBe(true);
			expect(failure).toBeDefined();
			expect(failure.cause).toBeInstanceOf(Error);
			expect(receipt.outcome).toBe('rolled_back');
			expect(await f.snapshot()).toEqual(before);
			expect(emitted.mock.calls.filter(([event]) => event === THERMOSTAT_CONFIG_CHANGED)).toEqual([]);
		} finally {
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			emitted.mockRestore();
		}
	});

	it.each([
		['selection', 'EMPTY'],
		['selection', 'RETIRED'],
		['definition', 'EMPTY'],
		['definition', 'RETIRED'],
	] as const)('retains the complete intended applied comfort %s image in %s', async (kind, state) => {
		const f = await appliedComfortFixture(kind, state);
		const result = await f.write();
		const after = await readControllerMutationImage(database.manager, controllerId);
		expect(result.configuration).toEqual(f.expected);
		expect(result.revision).toBe(f.row.revision + 1);
		expect(result.graph_revision).toBe(f.fence.expected_graph_revision + 1);
		expect(after.configuration).toHaveLength(1);
		// Raw JSON spelling is driver-owned, while its entire logical value is independently prescribed.
		expect(JSON.parse(after.configuration[0].comfort as string)).toEqual(f.expected);
		expect(after).toEqual({
			...f.before,
			configuration: [
				{
					...f.before.configuration[0],
					comfort: after.configuration[0].comfort,
					revision: f.row.revision + 1,
				},
			],
		});
		const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
		expect(slot.state).toBe(state);
		expect(slot.controllerIncarnation).toBe(f.slot.controllerIncarnation);
		expect(slot.slotRevision).toBe(f.slot.slotRevision + 1);
		expect(slot.manualCounter).toBe(f.slot.manualCounter + 1);
		expect(slot.manualGeneration).not.toBe(f.slot.manualGeneration);
		expect(slot.manualHold).toBe(f.slot.manualHold);
	});

	const configurePhysical = async () => {
		const sensorDevice = randomUUID(),
			sensorChannel = randomUUID(),
			sensor = randomUUID();
		await database.manager.insert(DeviceEntity, {
			id: sensorDevice,
			name: 'Temperature',
			category: DeviceCategory.SENSOR,
			enabled: true,
		});
		await database.manager.insert(ChannelEntity, {
			id: sensorChannel,
			device: sensorDevice,
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: sensor,
			channel: sensorChannel,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			unit: '°C',
		} as never);
		const actuatorDevice = randomUUID(),
			actuatorChannel = randomUUID(),
			actuator = randomUUID();
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: actuatorDevice,
			name: '1PM',
			identifier: 'shellyplus1pm-a8032abe5084',
			category: DeviceCategory.SWITCHER,
			enabled: true,
			canonicalMac: 'A8032ABE5084',
		});
		await database.manager.insert(ShellyNgChannelEntity, {
			id: actuatorChannel,
			device: actuatorDevice,
			name: 'Switch',
			identifier: 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: actuator,
			channel: actuatorChannel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const seed = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		const input: ConfigureVirtualThermostatDto = {
			schemaVersion: 1,
			expectedRevision: seed.revision,
			requestedMode: 'heat',
			policy: seed.policy,
			contactOpeningMs: 0,
			contactClosingMs: 0,
			sources: [{ role: 'ambient', sourcePropertyId: sensor, maximumAgeSeconds: 60 }],
			actuators: [{ role: 'heating', sourcePropertyId: actuator, leaseSeconds: 5 }],
			settings: [],
		};
		await configuration.configure(controllerId, input);
		// Configuration replacement deliberately takes manual hold. Only a fresh explicit opt-in releases it.
		for (const enabled of [false, true]) {
			const current = await comfort.get(controllerId);
			await comfort.configure(
				controllerId,
				{ expected_revision: current.revision, expected_graph_revision: current.graph_revision },
				{
					heating_range: seed.comfort.heating_range,
					cooling_range: seed.comfort.cooling_range,
					presets: seed.comfort.presets,
					automation_enabled: enabled,
				},
			);
		}
		return { input, sensor, actuator };
	};
	it.each([
		{ route: 'configure', corrupt: false },
		{ route: 'configure', corrupt: true },
		{ route: 'restore', corrupt: false },
		{ route: 'restore', corrupt: true },
	] as const)(
		'actual $route consumes installed baseline with full native postimage (corrupt=$corrupt)',
		async ({ route, corrupt }) => {
			const { input, actuator } = await configurePhysical();
			const authored = await author({ thermostat_preset: 'eco' });
			await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			expect((await comfort.get(controllerId)).effective.source).toBe('automation');
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const source = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, {
				generationId: slot.generationId,
			});
			if (corrupt)
				await database.query(
					`CREATE TEMP TRIGGER corrupt_manual_postimage AFTER UPDATE ON devices_virtual_thermostat_configs WHEN NEW.controllerId = '${controllerId}' BEGIN UPDATE devices_virtual_thermostat_configs SET locked = 1 WHERE controllerId = NEW.controllerId; END`,
				);
			const operation = () =>
				route === 'configure'
					? configuration.configure(controllerId, { ...input, expectedRevision: before.revision })
					: configuration.restoreActuator(
							controllerId,
							claim.id,
							{
								expectedRevision: before.revision,
								expectedClaimRevision: claim.revision,
								physicalIdentity: claim.physicalIdentity,
								sourcePropertyId: actuator,
								reason: 'Explicit same endpoint recovery',
								disconnectionAcknowledged: true,
							},
							'operator',
						);
			if (corrupt) {
				await expect(operation()).rejects.toThrow();
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(before);
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toEqual(slot);
				expect(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).toEqual(
					claim,
				);
				expect(
					await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: slot.generationId }),
				).toEqual(source);
				expect(await database.manager.count(VirtualThermostatRecoveryEntity)).toBe(0);
			} else {
				await operation();
				const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				expect(after.revision).toBe(before.revision + 1);
				expect(after.comfort.automation_baseline).toBeNull();
				expect(after.comfort.automation_enabled).toBe(true);
				expect(after.requestedMode).toBe(route === 'restore' ? 'off' : 'heat');
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
					state: 'RETIRED',
					generationId: slot.generationId,
					controllerIncarnation: slot.controllerIncarnation,
					manualCounter: slot.manualCounter + 1,
					manualHold: true,
				});
				const audits = await database.manager.find(VirtualThermostatRecoveryEntity);
				expect(audits).toHaveLength(route === 'restore' ? 1 : 0);
				if (route === 'restore')
					expect(audits[0]).toMatchObject({
						actorId: 'operator',
						configurationRevision: after.revision,
						claimId: claim.id,
						restoredPropertyId: actuator,
					});
				expect(await provider.activateLocal(database.manager, { ...slot })).toBe(false);
			}
		},
	);
	it.each(['success', 'stale-revision'] as const)(
		'actual release clears only the owned installed baseline in the original native unit: %s',
		async (outcome) => {
			const authored = await author({ thermostat_preset: 'eco' });
			await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			expect((await comfort.get(controllerId)).effective.source).toBe('automation');
			if (outcome === 'stale-revision') {
				await expect(configuration.requestRelease(controllerId, before.revision + 1)).rejects.toThrow('revision');
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(before);
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toEqual(slot);
			} else {
				await configuration.requestRelease(controllerId, before.revision);
				const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				expect(after.revision).toBe(before.revision + 1);
				expect(after.requestedMode).toBe('off');
				expect(after.releaseRequestedAt).toBeInstanceOf(Date);
				expect(after.comfort).toEqual({ ...before.comfort, automation_baseline: null });
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
					state: 'RETIRED',
					controllerIncarnation: slot.controllerIncarnation,
					generationId: slot.generationId,
					manualHold: true,
					manualCounter: slot.manualCounter + 1,
				});
				expect(await provider.activateLocal(database.manager, { ...slot })).toBe(false);
			}
		},
	);
	it.each([
		{ setting: 'heating_setpoint', value: 20 },
		{ setting: 'heating_setpoint', value: 21 },
		{ setting: 'cooling_setpoint', value: 27 },
		{ setting: 'heating_enabled', value: false },
		{ setting: 'heating_enabled', value: true },
		{ setting: 'cooling_enabled', value: false },
		{ setting: 'cooling_enabled', value: true },
		{ setting: 'locked', value: false },
		{ setting: 'locked', value: true },
	] satisfies { setting: ThermostatSetting; value: number | boolean }[])(
		'actual registered $setting=$value command retires the exact installed activity source slot',
		async ({ setting, value }) => {
			// Seed the second supported branch before installing any source; this is fixture configuration, not automation authority.
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			row.policy.coolingSetpoint = 26;
			row.requestedMode = 'auto';
			row.revision++;
			row.comfort.cooling_range = { minimum: 22, maximum: 32 };
			row.comfort.presets[0].setpoints.cooling_setpoint = 28;
			await database.manager.save(row);
			const channelId = randomUUID(),
				propertyId = randomUUID();
			const locked = setting === 'locked',
				numeric = setting.endsWith('setpoint');
			await database.manager.insert(VirtualChannelEntity, {
				id: channelId,
				device: controllerId,
				name: 'Manual',
				identifier: setting,
				category: locked
					? ChannelCategory.THERMOSTAT
					: setting.startsWith('cooling')
						? ChannelCategory.COOLER
						: ChannelCategory.HEATER,
			} as never);
			await database.manager.insert(VirtualChannelPropertyEntity, {
				id: propertyId,
				channel: channelId,
				identifier: locked ? 'locked' : numeric ? 'temperature' : 'on',
				category: locked ? PropertyCategory.LOCKED : numeric ? PropertyCategory.TEMPERATURE : PropertyCategory.ON,
				dataType: numeric ? DataTypeType.FLOAT : DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				valueOrigin: VirtualValueOrigin.LOCAL,
				sourcePropertyId: null,
			} as never);
			const property = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
				where: { id: propertyId },
				relations: ['channel', 'channel.device'],
			});
			const channel = property.channel as ChannelEntity,
				device = channel.device as DeviceEntity;
			await database.manager.insert(VirtualThermostatSettingEntity, {
				controllerId,
				propertyId,
				setting,
				contractFingerprint: thermostatPropertyContract(property, channel, device),
			});
			const calls = { write: jest.fn().mockResolvedValue(true), readLatest: jest.fn().mockResolvedValue(null) };
			configuration.onModuleDestroy();
			configuration = new VirtualThermostatConfigService(
				database,
				structure,
				graph,
				{
					invalidate: jest.fn(),
					refresh: jest.fn().mockResolvedValue(undefined),
				} as unknown as VirtualThermostatClaimsService,
				events,
				calls as unknown as PropertyValueService,
				undefined,
				provider,
			);
			configuration.onModuleInit();
			const authored = await author({ thermostat_preset: 'eco' });
			const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			expect(state.activityStatus).toBe(ActivityActivationStatus.ACTIVE);
			expect((await comfort.get(controllerId)).effective).toMatchObject({
				source: 'automation',
				heating_setpoint: 17,
				cooling_setpoint: 28,
			});
			const before = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			calls.write.mockClear();
			calls.readLatest.mockClear();
			const command = { device, channel, property, value };
			expect(await configuration.command([command, command])).toBe(true);
			const after = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			expect(after).toMatchObject({
				state: 'RETIRED',
				controllerIncarnation: before.controllerIncarnation,
				generationId: before.generationId,
				candidateId: before.candidateId,
				manualHold: !locked,
				manualCounter: before.manualCounter + (locked ? 0 : 1),
			});
			const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			expect(config.comfort.automation_baseline).toBeNull();
			expect((await comfort.get(controllerId)).effective.source).toBe('manual');
			expect(calls.write).toHaveBeenCalledTimes(2);
			expect(calls.readLatest).toHaveBeenCalledTimes(2);
			expect(calls.write.mock.calls.map((args: unknown[]) => args[1])).toEqual([value, value]);
			const nativeImage = async () => {
				const tables = await database.query<{ name: string }[]>(
					"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
				);
				return Promise.all(
					tables.map(async ({ name }) => ({
						name,
						rows: await database.query<Record<string, unknown>[]>(`SELECT * FROM "${name}" ORDER BY rowid`),
					})),
				);
			};
			const once = await nativeImage();
			const statements: string[] = [];
			const observer = {
				beforeQuery: (event: { query: string }) => {
					statements.push(event.query);
				},
			};
			const notifications = jest.spyOn(events, 'emit');
			calls.write.mockClear();
			calls.readLatest.mockClear();
			database.subscribers.push(observer);
			try {
				expect(await configuration.command([command, command])).toBe(true);
				expect(await nativeImage()).toEqual(once);
				expect(
					statements.filter((query) => /^\s*(INSERT|UPDATE|DELETE)/i.test(query) && !query.includes('WHERE 0')),
				).toEqual([]);
				expect(calls.write).not.toHaveBeenCalled();
				expect(calls.readLatest).not.toHaveBeenCalled();
				expect(notifications).not.toHaveBeenCalled();
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				notifications.mockRestore();
			}

			await database.query('UPDATE devices_virtual_thermostat_configs SET revision=? WHERE controllerId=?', [
				Number.MAX_SAFE_INTEGER,
				controllerId,
			]);
			await database.query(
				'UPDATE devices_module_climate_automation_slots SET slotRevision=?,manualCounter=? WHERE controllerId=?',
				[Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, controllerId],
			);
			await database.query('UPDATE devices_virtual_graph_revision SET revision=? WHERE id=1', [
				Number.MAX_SAFE_INTEGER,
			]);
			const maximum = await nativeImage();
			expect(await configuration.command([command, command])).toBe(true);
			expect(await nativeImage()).toEqual(maximum);
			expect(calls.write).not.toHaveBeenCalled();
			const next = { ...command, value: typeof value === 'boolean' ? !value : value + 0.1 };
			await expect(configuration.command([next])).rejects.toThrow();
			expect(await nativeImage()).toEqual(maximum);
			expect(calls.write).not.toHaveBeenCalled();

			expect(await provider.activateLocal(database.manager, { ...before })).toBe(false);
		},
	);
	it.each(['success', 'retirement-throw'] as const)(
		'actual space deletion atomically retires the installed provider and assignments: %s',
		async (outcome) => {
			const authored = await author({ thermostat_preset: 'eco' });
			await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 17 });
			const child = await database.manager.save(
				RoomSpaceEntity,
				database.manager.create(RoomSpaceEntity, { name: 'Child', parentId: roomId }),
			);
			const display = await database.manager.save(
				DisplayEntity,
				database.manager.create(DisplayEntity, { macAddress: 'AA:BB:CC:DD:EE:FA', spaceId: roomId }),
			);
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const tables = [
				'spaces_module_spaces',
				'spaces_module_space_roles',
				'devices_module_devices',
				'displays_module_displays',
				'devices_module_climate_automation_sources',
				'devices_module_climate_automation_slots',
				'devices_virtual_thermostat_configs',
			];
			const snapshot = () =>
				Promise.all(tables.map((table) => database.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`)));
			const before = await snapshot();
			let receipt: SqliteCommitGuardReceipt;
			// This hook observes the actual participant's preceding retirement in the SAME original native unit.
			const dispose = lifecycle.register({
				reconcile: () => Promise.resolve(),
				beforeMutation: async (id, kind, manager) => {
					receipt = observeSqliteOuterOutcome(manager);
					expect(receipt.outcome).toBe('pending');
					expect(id).toBe(roomId);
					expect(kind).toBe('delete');
					expect(structure.captureExclusiveOwner()()).toBe(true);
					expect(await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
						state: 'RETIRED',
						generationId: slot.generationId,
					});
					expect(
						(await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId })).comfort.automation_baseline,
					).toBeNull();
					expect((await manager.findOneBy(RoomSpaceEntity, { id: child.id })).parentId).toBe(roomId);
					expect((await manager.findOneBy(DeviceEntity, { id: controllerId })).roomId).toBe(roomId);
					expect((await manager.findOneBy(DisplayEntity, { id: display.id })).spaceId).toBe(roomId);
					if (outcome === 'retirement-throw') throw new Error('original retirement failed');
				},
			});
			const service = new SpacesService(
				database.getRepository(SpaceEntity),
				database.getRepository(DeviceEntity),
				database.getRepository(DisplayEntity),
				{} as never,
				{} as never,
				{} as never,
				{} as never,
				database,
				events,
				new SpacesTypeMapperService(),
				lifecycle,
			);
			const deleted: unknown[] = [];
			events.on('SpacesModule.Space.Deleted', (payload: unknown) => {
				expect(receipt.outcome).toBe('committed');
				deleted.push(payload);
			});
			try {
				if (outcome === 'retirement-throw') {
					await expect(service.remove(roomId)).rejects.toThrow('original retirement failed');
					expect(await snapshot()).toEqual(before);
					expect(deleted).toEqual([]);
				} else {
					await service.remove(roomId);
					expect(await database.manager.findOneBy(SpaceEntity, { id: roomId })).toBeNull();
					expect(
						await database.manager.findOneBy(ClimateAutomationSourceEntity, { generationId: slot.generationId }),
					).toMatchObject({ state: 'DELETED' });
					expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
						state: 'RETIRED',
						generationId: slot.generationId,
					});
					expect((await database.manager.findOneBy(RoomSpaceEntity, { id: child.id })).parentId).toBeNull();
					expect((await database.manager.findOneBy(DeviceEntity, { id: controllerId })).roomId).toBeNull();
					expect((await database.manager.findOneBy(DisplayEntity, { id: display.id })).spaceId).toBeNull();
					expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'manual', heating_setpoint: 20 });
					expect(deleted).toEqual([{ id: roomId }]);
				}
			} finally {
				dispose();
			}
		},
	);
	it.each(['success', 'retirement-throw'] as const)(
		'actual type change retires the installed source before UPDATE and preserves lifecycle reconciliation: %s',
		async (outcome) => {
			const authored = await author({ thermostat_preset: 'eco' });
			await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const tables = [
				'spaces_module_spaces',
				'spaces_module_space_roles',
				'devices_module_climate_automation_sources',
				'devices_module_climate_automation_slots',
				'devices_virtual_thermostat_configs',
			];
			const snapshot = () =>
				Promise.all(tables.map((table) => database.query<unknown[]>(`SELECT * FROM "${table}" ORDER BY rowid`)));
			const before = await snapshot();
			const mapper = new SpacesTypeMapperService();
			mapper.registerMapping({
				type: SpaceType.ROOM,
				class: RoomSpaceEntity,
				createDto: CreateHomeControlSpaceDto,
				updateDto: UpdateHomeControlSpaceDto,
				subtypeColumns: { category: null, suggestionsEnabled: true, statusWidgets: null },
			});
			mapper.registerMapping({
				type: SpaceType.SIGNAGE_INFO_PANEL,
				class: SignageInfoPanelSpaceEntity,
				createDto: CreateSignageInfoPanelSpaceDto,
				updateDto: UpdateSignageInfoPanelSpaceDto,
			});
			const service = new SpacesService(
				database.getRepository(SpaceEntity),
				database.getRepository(DeviceEntity),
				database.getRepository(DisplayEntity),
				{} as never,
				{} as never,
				{} as never,
				{} as never,
				database,
				events,
				mapper,
				lifecycle,
			);
			let receipt: SqliteCommitGuardReceipt;
			const reconciled: string[] = [];
			const dispose = lifecycle.register({
				beforeMutation: async (id, kind, manager) => {
					receipt = observeSqliteOuterOutcome(manager);
					expect(kind).toBe('type-change');
					expect((await manager.findOneBy(SpaceEntity, { id })).type).toBe(SpaceType.ROOM);
					expect(await manager.findOneBy(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
						state: 'RETIRED',
						generationId: slot.generationId,
					});
					expect(
						(await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId })).comfort.automation_baseline,
					).toBeNull();
					if (outcome === 'retirement-throw') throw new Error('original type retirement failed');
				},
				reconcile: async (space, manager) => {
					expect(receipt.outcome).toBe('pending');
					expect((await manager.findOneBy(SpaceEntity, { id: space.id })).type).toBe(SpaceType.SIGNAGE_INFO_PANEL);
					reconciled.push(space.id);
				},
			});
			const published: SpaceEntity[] = [];
			events.on('SpacesModule.Space.Updated', (space: SpaceEntity) => {
				expect(receipt.outcome).toBe('committed');
				published.push(space);
			});
			try {
				if (outcome === 'retirement-throw') {
					await expect(service.update(roomId, { type: SpaceType.SIGNAGE_INFO_PANEL })).rejects.toThrow(
						'original type retirement failed',
					);
					expect(await snapshot()).toEqual(before);
					expect(published).toEqual([]);
					expect(reconciled).toEqual([]);
				} else {
					const updated = await service.update(roomId, { type: SpaceType.SIGNAGE_INFO_PANEL });
					expect(updated).toBeInstanceOf(SignageInfoPanelSpaceEntity);
					expect(published).toHaveLength(1);
					expect(published[0]).toBe(updated);
					expect(reconciled).toEqual([roomId]);
					expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
						state: 'RETIRED',
						generationId: slot.generationId,
					});
					expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'manual', heating_setpoint: 20 });
				}
			} finally {
				dispose();
			}
		},
	);
	it('atomically retires the original native installation after actual mixed-target offline climate failure', async () => {
		const physical = randomUUID();
		await database.manager.insert(DeviceEntity, {
			id: physical,
			name: 'Offline physical thermostat',
			roomId,
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			hidden: false,
		});
		await database.manager.insert(ChannelEntity, {
			id: randomUUID(),
			device: physical,
			name: 'Heater',
			identifier: 'heater',
			category: ChannelCategory.HEATER,
		} as never);
		const authored = await author({ setpoint: 19 });
		const find = intentSpaces.findOne.bind(intentSpaces) as SpacesService['findOne'];
		let installedBeforePhysical = false;
		jest.spyOn(intentSpaces, 'findOne').mockImplementation(async (...args) => {
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			expect(slot.state).toBe('LIVE');
			expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 19 });
			installedBeforePhysical = true;
			return find(...args);
		});
		const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
		expect(installedBeforePhysical).toBe(true);
		expect(state.activityStatus).toBe(ActivityActivationStatus.FAILED);
		expect(state.activityResults).toContainEqual(
			expect.objectContaining({
				domain: ActivityDomain.CLIMATE,
				status: ActivityDomainStatus.FAILED,
				reason: 'affected=1; failed=0; offline=1',
			}),
		);
		const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
		expect(slot.state).toBe('RETIRED');
		expect(
			await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: slot.generationId }),
		).toMatchObject({ state: 'REVOKED', isCurrent: true });
		const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		expect(config.comfort.automation_baseline).toBeNull();
		expect((await comfort.get(controllerId)).effective.source).toBe('manual');
		provider.onModuleDestroy();
		provider = new VirtualThermostatAutomationService(database, registry, ledger, graph, structure);
		provider.onModuleInit();
		const dispose = provider.registerRuntime(async () => {});
		try {
			await provider.restoreCurrentInstallations();
			expect((await provider.resolve(database.manager, config)).baseline).toBeNull();
		} finally {
			dispose();
		}
	});

	it.each(['pending', 'installed', 'pending-manual', 'pending-replaced'] as const)(
		'original completion preserves same-generation %s admission authority',
		async (phase) => {
			const authored = await author({ thermostat_preset: 'eco' });
			const activationId = randomUUID();
			await database.manager.insert(SpaceActivityStateEntity, {
				spaceId: roomId,
				activationId,
				selectedActivityMode: ActivityMode.WORK,
				selectedActivityRevision: authored.activityRevision,
				activityStatus: ActivityActivationStatus.ACTIVATING,
				activityActor: 'operator',
				activityResults: [],
			});
			const identity = {
				spaceId: roomId,
				activationId,
				configurationRevision: authored.activityRevision,
				isCurrent: () => Promise.resolve(true),
			};
			const complete = producer.captureCompletion(identity);
			let rejectOriginal!: (cause: Error) => void, entered!: () => void, releaseRead!: () => void, reading!: () => void;
			const held = new Promise<void>((_resolve, reject) => {
				rejectOriginal = reject;
			});
			const requested = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const readGate = new Promise<void>((resolve) => {
				releaseRead = resolve;
			});
			const readEntered = new Promise<void>((resolve) => {
				reading = resolve;
			});
			let requests = 0,
				holdRead = false;
			const stop = provider.registerRuntime(
				async () => {},
				() => {
					if (++requests === 1) {
						entered();
						return held;
					}
					return Promise.resolve();
				},
			);
			const originalRead = provider.readController.bind(
				provider,
			) as VirtualThermostatAutomationService['readController'];
			jest.spyOn(provider, 'readController').mockImplementation(async (...args) => {
				if (holdRead) {
					holdRead = false;
					reading();
					await readGate;
				}
				return originalRead(...args);
			});
			const original = producer.apply(identity, authored.activityConfiguration.climate);
			const rejection = expect(original).rejects.toThrow('Committed climate installation remains inhibited');
			let successor: ReturnType<SpaceClimateAutomationService['apply']> | undefined;
			let replacement: ReturnType<SpaceClimateAutomationService['apply']> | undefined;
			let successorRejection: Promise<void> | undefined;
			try {
				await requested;
				const before = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
				holdRead = phase !== 'installed';
				successor = producer.apply({ ...identity }, authored.activityConfiguration.climate);
				if (phase !== 'installed') await readEntered;
				else expect((await successor).status).toBe(ActivityDomainStatus.SUCCEEDED);
				rejectOriginal(new Error('Original request failed after B admission'));
				await rejection;
				const write = jest.fn(() => Promise.resolve(true));
				expect(
					await complete(
						[
							{
								domain: ActivityDomain.CLIMATE,
								status: ActivityDomainStatus.FAILED,
								reason: 'original attempt failed',
							},
						],
						write,
					),
				).toBe(false);
				expect(write).not.toHaveBeenCalled();
				expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toEqual(before);
				expect(
					await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: before.generationId }),
				).toMatchObject({ state: 'FINALIZED_LIVE' });
				if (phase === 'pending-manual') await provider.beginMutation(controllerId);
				if (phase === 'pending-replaced') {
					replacement = producer.apply({ ...identity }, authored.activityConfiguration.climate);
					expect((await replacement).status).toBe(ActivityDomainStatus.SUCCEEDED);
				}
				if (phase === 'pending-manual' || phase === 'pending-replaced')
					successorRejection = expect(successor).rejects.toThrow('Original installation is no longer eligible');
				releaseRead();
				if (successorRejection !== undefined) {
					await successorRejection;
					if (phase === 'pending-manual') {
						const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
						expect((await provider.resolve(database.manager, row)).baseline).toBeNull();
						expect(requests).toBe(1);
					} else {
						expect((await comfort.get(controllerId)).effective).toMatchObject({
							source: 'automation',
							heating_setpoint: 17,
						});
						expect(requests).toBe(2);
					}
				} else {
					expect((await successor).status).toBe(ActivityDomainStatus.SUCCEEDED);
					expect((await comfort.get(controllerId)).effective).toMatchObject({
						source: 'automation',
						heating_setpoint: 17,
					});
					expect(requests).toBe(2);
				}
			} finally {
				releaseRead();
				rejectOriginal(new Error('Owned fixture cleanup'));
				await Promise.allSettled([
					original,
					rejection,
					...(successor !== undefined ? [successor] : []),
					...(replacement !== undefined ? [replacement] : []),
					...(successorRejection !== undefined ? [successorRejection] : []),
				]);
				stop();
			}
		},
	);
	it('original completion reserves retirement before joining predecessors and refuses later same-generation admission', async () => {
		const authored = await author({ thermostat_preset: 'eco' });
		const activationId = randomUUID();
		await database.manager.insert(SpaceActivityStateEntity, {
			spaceId: roomId,
			activationId,
			selectedActivityMode: ActivityMode.WORK,
			selectedActivityRevision: authored.activityRevision,
			activityStatus: ActivityActivationStatus.ACTIVATING,
			activityActor: 'operator',
			activityResults: [],
		});
		const identity = {
			spaceId: roomId,
			activationId,
			configurationRevision: authored.activityRevision,
			isCurrent: () => Promise.resolve(true),
		};
		let release!: () => void, captured!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			captured = resolve;
		});
		const stop = provider.registerRuntime(() => {
			captured();
			return gate;
		});
		const complete = producer.captureCompletion(identity);
		expect((await producer.apply(identity, authored.activityConfiguration.climate)).status).toBe(
			ActivityDomainStatus.SUCCEEDED,
		);
		let writes = 0;
		const completion = complete(
			[{ domain: ActivityDomain.CLIMATE, status: ActivityDomainStatus.FAILED, reason: 'original attempt failed' }],
			async (manager) => {
				writes++;
				const result = await manager.update(
					SpaceActivityStateEntity,
					{ spaceId: roomId, activationId, activityStatus: ActivityActivationStatus.ACTIVATING },
					{ activityStatus: ActivityActivationStatus.FAILED },
				);
				return result.affected === 1;
			},
		);
		try {
			await entered;
			expect(writes).toBe(0);
			await expect(producer.apply({ ...identity }, authored.activityConfiguration.climate)).rejects.toThrow(
				'Original installation is no longer eligible',
			);
			expect((await comfort.get(controllerId)).effective.source).toBe('manual');
			release();
			expect(await completion).toBe(true);
			expect(writes).toBe(1);
			expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
				state: 'RETIRED',
			});
			expect(await database.manager.findOneByOrFail(SpaceActivityStateEntity, { spaceId: roomId })).toMatchObject({
				activityStatus: ActivityActivationStatus.FAILED,
			});
		} finally {
			release();
			await Promise.allSettled([completion]);
			stop();
		}
	});
	it.each([0, undefined])(
		'original mixed-target completion rolls back all native rows on commit refusal %s',
		async (cause) => {
			const physical = randomUUID();
			await database.manager.insert(DeviceEntity, {
				id: physical,
				name: 'Offline physical thermostat',
				roomId,
				category: DeviceCategory.THERMOSTAT,
				enabled: true,
				hidden: false,
			});
			await database.manager.insert(ChannelEntity, {
				id: randomUUID(),
				device: physical,
				name: 'Heater',
				identifier: 'heater',
				category: ChannelCategory.HEATER,
			} as never);
			const authored = await author({ setpoint: 19 });
			const rows = () =>
				Promise.all([
					database.manager.query<unknown[]>(
						'SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId',
					),
					database.manager.query<unknown[]>(
						'SELECT * FROM devices_module_climate_automation_sources ORDER BY generationId',
					),
					database.manager.query<unknown[]>('SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId'),
					database.manager.query<unknown[]>('SELECT * FROM spaces_module_space_roles ORDER BY id'),
				]);
			let before: Awaited<ReturnType<typeof rows>> | undefined,
				armed = false,
				refusals = 0;
			const find = intentSpaces.findOne.bind(intentSpaces) as SpacesService['findOne'];
			jest.spyOn(intentSpaces, 'findOne').mockImplementation(async (...args) => {
				before = await rows();
				armed = true;
				return find(...args);
			});
			const observer = {
				beforeTransactionCommit() {
					if (armed) {
						refusals++;
						throw cause as unknown;
					}
				},
			};
			database.subscribers.push(observer);
			try {
				await expect(modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator')).rejects.toBe(
					cause,
				);
				expect(refusals).toBe(1);
				armed = false;
				expect(before).toBeDefined();
				expect(await rows()).toEqual(before);
				expect((await comfort.get(controllerId)).effective.source).toBe('manual');
			} finally {
				armed = false;
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
			}
			expect(await database.manager.findOneByOrFail(SpaceActivityStateEntity, { spaceId: roomId })).toMatchObject({
				activityStatus: ActivityActivationStatus.ACTIVATING,
			});
			await modes.onApplicationBootstrap();
			expect(await database.manager.findOneByOrFail(SpaceActivityStateEntity, { spaceId: roomId })).toMatchObject({
				activityStatus: ActivityActivationStatus.INTERRUPTED,
			});
		},
	);

	const mixedOffline = async () => {
		const physical = randomUUID();
		await database.manager.insert(DeviceEntity, {
			id: physical,
			name: 'Completion physical target',
			roomId,
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			hidden: false,
		});
		await database.manager.insert(ChannelEntity, {
			id: randomUUID(),
			device: physical,
			name: 'Heater',
			identifier: 'heater',
			category: ChannelCategory.HEATER,
		} as never);
		return author({ setpoint: 19 });
	};
	const completionRows = () =>
		Promise.all([
			database.manager.query<unknown[]>('SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId'),
			database.manager.query<unknown[]>(
				'SELECT * FROM devices_module_climate_automation_sources ORDER BY generationId',
			),
			database.manager.query<unknown[]>('SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId'),
			database.manager.query<unknown[]>('SELECT * FROM spaces_module_space_roles ORDER BY id'),
		]);

	it('actual SpaceMode failed physical result reserves retirement before later repeated admission', async () => {
		const authored = await mixedOffline();
		let release!: () => void, captured!: () => void, identityA: SpaceActivationIdentity | undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			captured = resolve;
		});
		const originalCapture = producer.captureCompletion.bind(
			producer,
		) as SpaceClimateAutomationService['captureCompletion'];
		jest.spyOn(producer, 'captureCompletion').mockImplementation((identity) => {
			identityA = identity;
			return originalCapture(identity);
		});
		const predecessor = jest.fn(() => {
			captured();
			return gate;
		});
		const dispose = provider.registerRuntime(predecessor);
		const published = jest.fn();
		events.on(ACTIVITY_STATE_CHANGED, published);
		const original = modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
		try {
			await Promise.race([
				entered,
				original.then(() => {
					throw new Error('Retirement did not capture original predecessor');
				}),
			]);
			expect(identityA).toBeDefined();
			expect(predecessor).toHaveBeenCalledTimes(1);
			await expect(producer.apply({ ...identityA }, authored.activityConfiguration.climate)).rejects.toThrow(
				'Original installation is no longer eligible',
			);
			expect((await comfort.get(controllerId)).effective.source).toBe('manual');
			expect(published).toHaveBeenCalledTimes(1);
			release();
			const result = await original;
			expect(result.activityStatus).toBe(ActivityActivationStatus.FAILED);
			expect(result.activityResults).toContainEqual(
				expect.objectContaining({
					domain: ActivityDomain.CLIMATE,
					status: ActivityDomainStatus.FAILED,
					reason: 'affected=1; failed=0; offline=1',
				}),
			);
			expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
				state: 'RETIRED',
			});
			expect(published).toHaveBeenCalledTimes(2);
		} finally {
			release();
			await Promise.allSettled([original]);
			events.off(ACTIVITY_STATE_CHANGED, published);
			dispose();
		}
	});
	it('actual SpaceMode zero-row completion rolls back original retirement without publishing failure', async () => {
		const authored = await mixedOffline();
		await database.query(`CREATE TRIGGER completion_zero BEFORE UPDATE ON spaces_module_space_roles
			WHEN OLD.type='activity_state' AND OLD.activityStatus='activating' AND NEW.activityStatus='failed'
			BEGIN SELECT RAISE(IGNORE); END`);
		const find = intentSpaces.findOne.bind(intentSpaces) as SpacesService['findOne'];
		let before: Awaited<ReturnType<typeof completionRows>> | undefined;
		jest.spyOn(intentSpaces, 'findOne').mockImplementation(async (...args) => {
			before = await completionRows();
			return find(...args);
		});
		const published = jest.fn();
		events.on(ACTIVITY_STATE_CHANGED, published);
		try {
			const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			expect(before).toBeDefined();
			expect(await completionRows()).toEqual(before);
			expect(state.activityStatus).toBe(ActivityActivationStatus.ACTIVATING);
			expect(state.activityResults).toEqual([]);
			expect((await comfort.get(controllerId)).effective.source).toBe('manual');
			expect(published).toHaveBeenCalledTimes(1);
		} finally {
			events.off(ACTIVITY_STATE_CHANGED, published);
			await database.query('DROP TRIGGER completion_zero');
		}
	});
	it.each([0, undefined])(
		'original physical-leg failure %s remains primary over rejected predecessor cleanup',
		async (primary) => {
			const authored = await mixedOffline();
			const secondary = new Error('original predecessor cleanup failed');
			const capture = jest.fn(() => Promise.reject(secondary));
			const dispose = provider.registerRuntime(capture);
			let before: Awaited<ReturnType<typeof completionRows>> | undefined;
			jest.spyOn(intentSpaces, 'findOne').mockImplementation(async () => {
				before = await completionRows();
				expect((await comfort.get(controllerId)).effective.source).toBe('automation');
				throw primary as unknown;
			});
			const published = jest.fn();
			events.on(ACTIVITY_STATE_CHANGED, published);
			try {
				await expect(modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator')).rejects.toBe(
					primary,
				);
				expect(capture).toHaveBeenCalledTimes(1);
				expect(before).toBeDefined();
				expect(await completionRows()).toEqual(before);
				expect((await comfort.get(controllerId)).effective.source).toBe('manual');
				expect(published).toHaveBeenCalledTimes(1);
			} finally {
				events.off(ACTIVITY_STATE_CHANGED, published);
				dispose();
			}
		},
	);
	it('actual SpaceMode completion retains UNKNOWN after native commit with missing acknowledgement', async () => {
		const authored = await mixedOffline(),
			primary = new Error('completion native ACK unavailable');
		let armed = false,
			commits = 0,
			acknowledgements = 0,
			receipt: SqliteCommitGuardReceipt | undefined;
		const observer = {
			beforeQuery(event: BeforeQueryEvent<unknown>) {
				if (
					event.query.startsWith('UPDATE "spaces_module_space_roles"') &&
					event.parameters?.includes(ActivityActivationStatus.FAILED)
				) {
					receipt = observeSqliteOuterOutcome(event.manager);
					armed = true;
				}
			},
		};
		const native = (database.driver as unknown as { databaseConnection: { all: (...args: unknown[]) => unknown } })
			.databaseConnection;
		const all = native.all;
		const originalCallbackErrors: unknown[] = [];
		const forwarding = jest.spyOn(native, 'all').mockImplementation(function (this: unknown, ...args: unknown[]) {
			if (!armed || args[0] !== 'COMMIT') return Reflect.apply(all, this, args);
			commits++;
			armed = false;
			const original = args[args.length - 1] as (...values: unknown[]) => unknown;
			args[args.length - 1] = function (this: unknown, ...values: unknown[]) {
				acknowledgements++;
				originalCallbackErrors.push(values[0]);
				values[0] = primary;
				return Reflect.apply(original, this, values);
			};
			return Reflect.apply(all, this, args);
		});
		database.subscribers.push(observer);
		const published = jest.fn();
		events.on(ACTIVITY_STATE_CHANGED, published);
		try {
			await expect(
				modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator'),
			).rejects.toMatchObject({ driverError: primary });
			expect(commits).toBe(1);
			expect(acknowledgements).toBe(1);
			expect(originalCallbackErrors).toEqual([null]);
			expect(receipt?.outcome).toBe('unknown');
			expect(await database.manager.findOneByOrFail(SpaceActivityStateEntity, { spaceId: roomId })).toMatchObject({
				activityStatus: ActivityActivationStatus.FAILED,
			});
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			expect(slot.state).toBe('RETIRED');
			expect(
				await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, { generationId: slot.generationId }),
			).toMatchObject({ state: 'REVOKED' });
			expect((await comfort.get(controllerId)).effective.source).toBe('manual');
			expect(receipt?.outcome).toBe('unknown');
			expect(published).toHaveBeenCalledTimes(1);
		} finally {
			forwarding.mockRestore();
			events.off(ACTIVITY_STATE_CHANGED, published);
			database.subscribers.splice(database.subscribers.indexOf(observer), 1);
		}
	});
	it('refuses a mixed physical preset target without leaving an ineligible LIVE virtual source', async () => {
		const physical = randomUUID();
		await database.manager.insert(DeviceEntity, {
			id: physical,
			name: 'Physical thermostat',
			roomId,
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			hidden: false,
		});
		await database.manager.insert(ChannelEntity, {
			id: randomUUID(),
			device: physical,
			name: 'Heater',
			identifier: 'heater',
			category: ChannelCategory.HEATER,
		} as never);
		const authored = await author({ thermostat_preset: 'eco' });
		const preview = await modes.preview(roomId, ActivityMode.WORK, authored.activityRevision);
		expect(preview).toContainEqual(
			expect.objectContaining({
				domain: ActivityDomain.CLIMATE,
				status: 'unsupported',
				reason: 'physical_target_preset_unsupported',
			}),
		);
		const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
		const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
		expect(state.activityResults).toContainEqual(
			expect.objectContaining({ domain: ActivityDomain.CLIMATE, status: 'unsupported' }),
		);
		expect(await database.manager.count(ClimateAutomationSourceEntity)).toBe(0);
		expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toEqual(slot);
		expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).toEqual(before);
		expect((await comfort.get(controllerId)).effective.source).toBe('manual');
	});
	it('keeps successful climate installed across overall PARTIAL and rejects stale deactivation without fencing it', async () => {
		const authored = await author({ thermostat_preset: 'eco' });
		authored.activityConfiguration.security.enabled = true;
		const updated = await configs.update(roomId, ActivityMode.WORK, {
			expected_revision: authored.activityRevision,
			enabled: true,
			display_order: 0,
			configuration: authored.activityConfiguration,
		});
		const state = await modes.activateMode(roomId, ActivityMode.WORK, updated.activityRevision, 'operator');
		expect(state.activityStatus).toBe(ActivityActivationStatus.PARTIAL);
		expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 17 });
		await expect(modes.deactivateMode(roomId, randomUUID(), 'old-operator')).rejects.toThrow('identity changed');
		expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 17 });
		await configs.reset(roomId, ActivityMode.RELAX, 1);
		expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 17 });
	});
	it.each([0, undefined])('withdraws earlier bundle admissions after a later activation throws %s', async (cause) => {
		const second = randomUUID();
		await database.manager.insert(VirtualDeviceEntity, {
			id: second,
			name: 'Second thermostat',
			roomId,
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			hidden: false,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: randomUUID(),
			device: second,
			name: 'Heater',
			identifier: 'heater',
			category: ChannelCategory.HEATER,
		});
		const firstConfig = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
		await database.manager.insert(VirtualThermostatConfigEntity, {
			...firstConfig,
			controllerId: second,
			ownerDeviceId: second,
		});
		const authored = await author({ thermostat_preset: 'eco' });
		const activationId = randomUUID();
		await database.manager.insert(SpaceActivityStateEntity, {
			spaceId: roomId,
			activationId,
			selectedActivityMode: ActivityMode.WORK,
			selectedActivityRevision: authored.activityRevision,
			activityStatus: ActivityActivationStatus.ACTIVATING,
			activityActor: 'operator',
			activityResults: [],
		});
		const original = provider.activateLocal.bind(provider) as VirtualThermostatAutomationService['activateLocal'];
		const admitted: string[] = [];
		jest.spyOn(provider, 'activateLocal').mockImplementation(async (...args) => {
			if (admitted.length) throw cause as unknown;
			const result = await original(...args);
			if (result) admitted.push(args[1].controllerId);
			return result;
		});
		await expect(
			producer.apply(
				{
					spaceId: roomId,
					activationId,
					configurationRevision: authored.activityRevision,
					isCurrent: () => Promise.resolve(true),
				},
				authored.activityConfiguration.climate,
			),
		).rejects.toBe(cause);
		expect(admitted).toHaveLength(1);
		for (const id of [controllerId, second]) {
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id });
			expect(slot.state).toBe('LIVE');
			expect(
				await provider.resolve(
					database.manager,
					await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id }),
				),
			).toMatchObject({ baseline: null, manualHold: false });
			expect((await comfort.get(id)).effective.source).not.toBe('automation');
		}
	});
	it('late failure of an original runtime request cannot retire a newer exact local admission', async () => {
		const authored = await author({ thermostat_preset: 'eco' });
		const activationId = randomUUID();
		await database.manager.insert(SpaceActivityStateEntity, {
			spaceId: roomId,
			activationId,
			selectedActivityMode: ActivityMode.WORK,
			selectedActivityRevision: authored.activityRevision,
			activityStatus: ActivityActivationStatus.ACTIVATING,
			activityActor: 'operator',
			activityResults: [],
		});
		const identity = {
			spaceId: roomId,
			activationId,
			configurationRevision: authored.activityRevision,
			isCurrent: () => Promise.resolve(true),
		};
		let rejectOriginal: (cause: Error) => void, enter: () => void;
		const held = new Promise<void>((_resolve, reject) => (rejectOriginal = reject));
		const entered = new Promise<void>((resolve) => (enter = resolve));
		let requests = 0;
		const stop = provider.registerRuntime(
			() => held,
			() => {
				if (++requests === 1) {
					enter();
					return held;
				}
				return Promise.resolve();
			},
		);
		const original = producer.apply(identity, authored.activityConfiguration.climate);
		try {
			await Promise.race([
				entered,
				original.then(() => {
					throw new Error('Original install did not reach its runtime request');
				}),
			]);
			expect((await comfort.get(controllerId)).effective.source).toBe('automation');
			const successor = await producer.apply(identity, authored.activityConfiguration.climate);
			expect(successor.status).toBe(ActivityDomainStatus.SUCCEEDED);
			rejectOriginal(new Error('Original runtime failed after successor admission'));
			await expect(original).rejects.toThrow('Committed climate installation remains inhibited');
			expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 17 });
			expect(requests).toBe(2);
		} finally {
			rejectOriginal(new Error('Owned original fixture cleanup'));
			await original.catch(() => undefined);
			stop();
		}
	});

	it.each(['active', 'partial', 'activating', 'failed', 'climate_failed'] as const)(
		'reconstructs only completed current native activity intent on %s startup without replaying a delta',
		async (status) => {
			const authored = await author({ setpoint_delta: -2 });
			const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			const restoredStatus =
				status === 'active'
					? ActivityActivationStatus.ACTIVE
					: status === 'activating'
						? ActivityActivationStatus.ACTIVATING
						: status === 'failed'
							? ActivityActivationStatus.FAILED
							: ActivityActivationStatus.PARTIAL;
			await database.manager.update(
				SpaceActivityStateEntity,
				{ spaceId: roomId },
				{
					activityStatus: restoredStatus,
					activityResults: state.activityResults.map((result) =>
						status === 'climate_failed' && result.domain === ActivityDomain.CLIMATE
							? { ...result, status: ActivityDomainStatus.FAILED }
							: result,
					),
				},
			);
			const rows = async () =>
				Promise.all([
					database.manager.query<unknown[]>(
						'SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId',
					),
					database.manager.query<unknown[]>(
						'SELECT * FROM devices_module_climate_automation_sources ORDER BY generationId',
					),
					database.manager.query<unknown[]>('SELECT * FROM devices_virtual_thermostat_configs ORDER BY controllerId'),
				]);
			const before = await rows();
			provider.onModuleDestroy();
			provider = new VirtualThermostatAutomationService(database, registry, ledger, graph, structure);
			provider.onModuleInit();
			const request = jest.fn(() => Promise.resolve());
			const stop = provider.registerRuntime(() => Promise.resolve(), request);
			try {
				await provider.restoreCurrentInstallations();
				const config = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
				const resolved = await provider.resolve(database.manager, config);
				if (status === 'active' || status === 'partial') {
					expect(resolved.baseline?.setpoints?.heating_setpoint).toBe(18);
					expect(resolved.isCurrent()).toBe(true);
				} else expect(resolved.baseline).toBeNull();
				expect(await rows()).toEqual(before);
				expect(request).not.toHaveBeenCalled();
				if (status === 'active' || status === 'partial') {
					await modes.deactivateMode(roomId, state.activationId, 'operator');
					expect(
						(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId })).comfort
							.automation_baseline,
					).toBeNull();
					expect((await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).state).toBe(
						'RETIRED',
					);
				}
			} finally {
				stop();
			}
		},
	);

	it('actual activity source drives the existing native journal and guarded software transport, then deactivation drains its original commands', async () => {
		const { sensor, actuator } = await configurePhysical();
		const producers = new PropertyProducerRegistryService(events);
		const qualifications = new Map<string, ThermostatInstalledQualification>();
		const fixture = await realThermostatGuardFixture(database, events, producers, qualifications);
		const claims = new VirtualThermostatClaimsService(
			database,
			structure,
			graph,
			new PropertyCommandAdmissionRegistryService(),
			events,
		);
		const runtime = new VirtualThermostatRuntimeService(
			database,
			structure,
			claims,
			new VirtualThermostatInputsService(database, fixture.values),
			fixture.transport,
			fixture.values,
			producers,
			events,
			graph,
			comfort,
			new ConfigService(),
			undefined,
			provider,
		);
		try {
			await graph.onApplicationBootstrap();
			await claims.onApplicationBootstrap();
			for (const claim of await database.manager.find(VirtualThermostatActuatorClaimEntity)) {
				// Offline fixture evidence exercises the real qualifier/guard contract; it certifies no installed hardware.
				const originalMachine = fixture.captureSession(claim.sourcePropertyId);
				if (!originalMachine?.isCurrent()) throw new Error('Original managed machine lease required');
				claims.recordQualification({
					...qualifications.get(claim.physicalIdentity),
					machineLeaseIsCurrent: () => originalMachine.isCurrent(),
				});
			}
			await fixture.report(sensor, 21);
			await fixture.report(actuator, false);
			await runtime.onApplicationBootstrap();
			for (let phase = 0; phase < 3; phase++) {
				await runtime.requestInstalled(controllerId);
				await fixture.flushTelemetry();
			}
			const authored = await author({ thermostat_preset: 'eco' });
			const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			expect(state.activityStatus).toBe(ActivityActivationStatus.ACTIVE);
			expect(runtime.readDiagnostics(controllerId).effective_comfort).toMatchObject({
				source: 'automation',
				heating_setpoint: 17,
			});
			await fixture.report(sensor, 16);
			for (let phase = 0; phase < 3; phase++) {
				await runtime.requestInstalled(controllerId);
				await fixture.flushTelemetry();
			}
			expect(fixture.controls.errors).toEqual([]);
			expect(fixture.controls.sends).toContainEqual({ property: actuator, on: true });
			const on = await database.manager.findBy(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'on',
				status: 'accepted',
			});
			expect(on.length).toBeGreaterThan(0);
			const installedClaim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
				controllerId,
			});
			expect(installedClaim).toMatchObject({ sourcePropertyIdentity: actuator, leaseSeconds: 5 });
			expect(
				on.every(
					(command) =>
						command.claimId === installedClaim.id &&
						command.claimRevision === installedClaim.revision &&
						command.dispatchedAt !== null &&
						command.settledAt !== null &&
						command.fault === null,
				),
			).toBe(true);
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			await modes.deactivateMode(roomId, state.activationId, 'operator');
			expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
				state: 'RETIRED',
				generationId: slot.generationId,
			});
			expect((await comfort.get(controllerId)).effective.source).toBe('manual');
			expect(await provider.activateLocal(database.manager, { ...slot })).toBe(false);
			expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'prepared' })).toBe(
				0,
			);
			expect(
				await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'dispatching' }),
			).toBe(0);
		} finally {
			runtime.onModuleDestroy();
			await runtime.capturePredecessors(controllerId);
			await runtime.flush();
			claims.onModuleDestroy();
			await fixture.dispose();
			producers.onModuleDestroy();
			jest.useRealTimers();
		}
	});
	// The new lifecycle cases reuse the real native/provider/managed transport participants.
	const ownedGuard = async (activate = true, generated = false) => {
		const physical = await configurePhysical();
		if (generated) {
			const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId });
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			await configuration.restoreActuator(
				controllerId,
				claim.id,
				{
					expectedRevision: before.revision,
					expectedClaimRevision: claim.revision,
					physicalIdentity: claim.physicalIdentity,
					sourcePropertyId: physical.actuator,
					reason: 'Explicit canonical restore for generated admission',
					disconnectionAcknowledged: true,
				},
				'operator',
			);
			const restored = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			expect(restored.requestedMode).toBe('off');
			// These are separate explicit operator choices, never part of the legacy NG-2 positive.
			await configuration.configure(controllerId, {
				...physical.input,
				expectedRevision: restored.revision,
				requestedMode: 'heat',
			});
			for (const enabled of [false, true]) {
				const current = await comfort.get(controllerId);
				await comfort.configure(
					controllerId,
					{ expected_revision: current.revision, expected_graph_revision: current.graph_revision },
					{
						heating_range: before.comfort.heating_range,
						cooling_range: before.comfort.cooling_range,
						presets: before.comfort.presets,
						automation_enabled: enabled,
					},
				);
			}
		}

		const producers = new PropertyProducerRegistryService(events);
		const qualifications = new Map<string, ThermostatInstalledQualification>();
		const fixture = await realThermostatGuardFixture(database, events, producers, qualifications);
		const claims = new VirtualThermostatClaimsService(
			database,
			structure,
			graph,
			new PropertyCommandAdmissionRegistryService(),
			events,
		);
		const runtime = new VirtualThermostatRuntimeService(
			database,
			structure,
			claims,
			new VirtualThermostatInputsService(database, fixture.values),
			fixture.transport,
			fixture.values,
			producers,
			events,
			graph,
			comfort,
			new ConfigService(),
			undefined,
			provider,
		);
		configuration.onModuleDestroy();
		configuration = new VirtualThermostatConfigService(
			database,
			structure,
			graph,
			claims,
			events,
			fixture.values,
			undefined,
			provider,
		);
		configuration.onModuleInit();
		const qualify = (claim: VirtualThermostatActuatorClaimEntity) => {
			const session = fixture.captureSession(claim.sourcePropertyId);
			if (!session?.isCurrent()) throw new Error('Original managed session required');
			claims.recordQualification({
				...qualifications.get(claim.physicalIdentity),
				...(typeof claim.qualificationGeneration === 'string'
					? { qualificationGeneration: claim.qualificationGeneration }
					: {}),
				machineLeaseIsCurrent: () => session.isCurrent(),
			});
			return session;
		};
		const cleanup = async () => {
			runtime.onModuleDestroy();
			await runtime.capturePredecessors(controllerId);
			await runtime.flush();
			claims.onModuleDestroy();
			await fixture.dispose();
			producers.onModuleDestroy();
			jest.useRealTimers();
		};
		try {
			await graph.onApplicationBootstrap();
			await claims.onApplicationBootstrap();
			for (const claim of await database.manager.find(VirtualThermostatActuatorClaimEntity)) qualify(claim);
			await fixture.report(physical.sensor, 21);
			await fixture.report(physical.actuator, false);
			await runtime.onApplicationBootstrap();
			for (let phase = 0; phase < 3; phase++) {
				await runtime.requestInstalled(controllerId);
				await fixture.flushTelemetry();
			}
			if (activate) {
				const authored = await author({ thermostat_preset: 'eco' });
				await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			}
			const internal = runtime as unknown as {
				contexts: Map<
					string,
					{
						claims: VirtualThermostatActuatorClaimEntity[];
						targets: Map<string, IDevicePropertyData>;
						automation: { baseline: unknown };
					}
				>;
				prepare(context: unknown, claim: VirtualThermostatActuatorClaimEntity, action: 'on' | 'off'): Promise<void>;
				reconcile(context: unknown, claim: VirtualThermostatActuatorClaimEntity): Promise<void>;
			};
			return { ...physical, fixture, claims, runtime, internal, qualify, cleanup };
		} catch (cause) {
			await cleanup();
			throw cause;
		}
	};
	it('explicit canonical restore and fresh trusted generated qualification drive native activity ON and deactivation', async () => {
		const f = await ownedGuard(true, true);
		try {
			const context = f.internal.contexts.get(controllerId),
				claim = context.claims[0];
			expect(typeof claim.qualificationGeneration).toBe('string');
			expect(claim.qualificationGeneration.length).toBeGreaterThan(0);
			const qualification = f.claims.qualification(claim, false);
			expect(qualification.qualificationGeneration).toBe(claim.qualificationGeneration);
			expect(
				f.fixture.transport.captureReconcileReadiness(context.targets.get(claim.id), claim, qualification)
					?.capabilityVersion,
			).toBe(1);
			await f.fixture.report(f.sensor, 16);
			for (let phase = 0; phase < 3; phase++) {
				await f.runtime.requestInstalled(controllerId);
				await f.fixture.flushTelemetry();
			}
			expect(f.fixture.controls.errors).toEqual([]);
			expect(f.fixture.controls.sends).toContainEqual({ property: f.actuator, on: true });
			const commands = await database.manager.findBy(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'on',
				status: 'accepted',
			});
			expect(commands.length).toBeGreaterThan(0);
			expect(
				commands.every(
					(command) =>
						command.claimId === claim.id &&
						command.claimRevision === claim.revision &&
						command.dispatchedAt !== null &&
						command.settledAt !== null &&
						command.fault === null,
				),
			).toBe(true);
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const activity = await database.manager.findOneByOrFail(SpaceActivityStateEntity, { spaceId: roomId });
			await modes.deactivateMode(roomId, activity.activationId, 'operator');
			expect((await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).state).toBe(
				'RETIRED',
			);
			expect(await provider.activateLocal(database.manager, { ...slot })).toBe(false);
			expect(await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'prepared' })).toBe(
				0,
			);
			expect(
				await database.manager.countBy(VirtualThermostatCommandEntity, { controllerId, status: 'dispatching' }),
			).toBe(0);
		} finally {
			await f.cleanup();
		}
	});
	it('owned malformed generation refuses prepare and reconcile before command capture or session preparation', async () => {
		const f = await ownedGuard();
		try {
			const context = f.internal.contexts.get(controllerId),
				claim = context.claims[0];
			expect(context.automation.baseline).not.toBeNull();
			const qualification = f.claims.qualification(claim, false);
			expect(qualification).not.toBeNull();
			const malformed = { ...qualification };
			Object.defineProperty(malformed, 'qualificationGeneration', { value: null, enumerable: true });
			f.claims.recordQualification(malformed);
			expect(f.claims.qualification(claim, false)).toHaveProperty('qualificationGeneration', null);
			const capture = jest.spyOn(f.fixture.transport, 'capture');
			const get = jest.spyOn(f.fixture.transport, 'get');
			const session = jest.spyOn(f.fixture.platform, 'prepareGuardRpcSession');
			const metadata = jest.spyOn(f.fixture.transport, 'captureOffMetadata');
			await f.internal.prepare(context, claim, 'on');
			await f.internal.reconcile(context, claim);
			expect(metadata).toHaveBeenCalledTimes(1);
			expect(metadata.mock.results[0].value).toBeNull();
			expect(capture).not.toHaveBeenCalled();
			expect(get).not.toHaveBeenCalled();
			expect(session).not.toHaveBeenCalled();
			expect(f.fixture.controls.sends).toEqual([]);
		} finally {
			await f.cleanup();
		}
	});
	it('ordinary reconcile retains command capture ordering without owned metadata or readiness', async () => {
		const f = await ownedGuard(false);
		try {
			const context = f.internal.contexts.get(controllerId),
				claim = context.claims[0];
			expect(context.automation.baseline).toBeNull();
			const capture = jest.spyOn(f.fixture.transport, 'capture');
			const get = jest.spyOn(f.fixture.transport, 'get');
			const session = jest.spyOn(f.fixture.platform, 'prepareGuardRpcSession');
			const metadata = jest.spyOn(f.fixture.transport, 'captureOffMetadata');
			const readiness = jest.spyOn(f.fixture.transport, 'captureReconcileReadiness');
			await f.internal.reconcile(context, claim);
			expect(capture).toHaveBeenCalledTimes(1);
			// Later ordinary canSend/evidence checks also look up the adapter; they are not new captures.
			expect(get).toHaveBeenCalledWith(context.targets.get(claim.id), claim, f.claims.qualification(claim, false));
			expect(session).toHaveBeenCalledWith(context.targets.get(claim.id), f.claims.qualification(claim, false).profile);
			expect(capture.mock.invocationCallOrder[0]).toBeLessThan(get.mock.invocationCallOrder[0]);
			expect(get.mock.invocationCallOrder[0]).toBeLessThan(session.mock.invocationCallOrder[0]);
			expect(metadata).not.toHaveBeenCalled();
			expect(readiness).not.toHaveBeenCalled();
		} finally {
			await f.cleanup();
		}
	});
	it('actual managed stop and fresh start cannot revive original owned readiness or command capture', async () => {
		const f = await ownedGuard();
		try {
			const context = f.internal.contexts.get(controllerId),
				claim = context.claims[0],
				target = context.targets.get(claim.id);
			const qualification = f.claims.qualification(claim, false);
			const old = f.fixture.transport.captureReconcileReadiness(target, claim, qualification);
			const command = f.fixture.transport.capture(target, claim, qualification);
			expect(old.isCurrent()).toBe(true);
			expect(command.isCurrent()).toBe(true);
			expect(await f.fixture.stopManaged()).toBe(true);
			expect(old.isCurrent()).toBe(false);
			expect(f.claims.qualification(claim, false)).toBeNull();
			expect(await f.fixture.startManaged()).toBe(true);
			await f.fixture.insert();
			f.qualify(claim);
			const freshQualification = f.claims.qualification(claim, false);
			const fresh = f.fixture.transport.captureReconcileReadiness(target, claim, freshQualification);
			expect(freshQualification).not.toBe(qualification);
			expect(fresh.isCurrent()).toBe(true);
			expect(old.isCurrent()).toBe(false);
			// Command dispatch also retains the old machine qualification; currentness alone is not permission.
			expect(qualification.machineLeaseIsCurrent()).toBe(false);
			expect(f.fixture.controls.sends).toEqual([]);
		} finally {
			await f.cleanup();
		}
	});
	it('native canonical restore retires a held legacy ON and admits only fresh generated readiness', async () => {
		const f = await ownedGuard();
		let release: () => void, entered: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const entry = new Promise<void>((resolve) => (entered = resolve));
		let original: Promise<void> | undefined, restoring: Promise<unknown> | undefined;
		try {
			const context = f.internal.contexts.get(controllerId),
				claim = context.claims[0],
				target = context.targets.get(claim.id);
			const qualification = f.claims.qualification(claim, false);
			const old = f.fixture.transport.captureReconcileReadiness(target, claim, qualification);
			expect(old?.capabilityVersion).toBe(2);
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId });
			f.fixture.controls.beforeOn = async () => {
				entered();
				await gate;
			};
			await f.fixture.report(f.sensor, 16);
			original = f.runtime.requestInstalled(controllerId);
			void original.catch(() => undefined);
			await entry;
			expect(f.fixture.controls.sends).toEqual([]);
			restoring = configuration.restoreActuator(
				controllerId,
				claim.id,
				{
					expectedRevision: before.revision,
					expectedClaimRevision: claim.revision,
					physicalIdentity: claim.physicalIdentity,
					sourcePropertyId: f.actuator,
					reason: 'Explicit canonical recovery while original command waits',
					disconnectionAcknowledged: true,
				},
				'operator',
			);
			void restoring.catch(() => undefined);
			release();
			await original;
			await restoring;
			expect(f.fixture.controls.sends).toEqual([]);
			const current = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id });
			expect(current.revision).toBeGreaterThan(claim.revision);
			expect(typeof current.qualificationGeneration).toBe('string');
			expect(current.qualificationGeneration.length).toBeGreaterThan(0);
			expect(await database.manager.count(VirtualThermostatRecoveryEntity)).toBe(1);
			expect((await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).state).toBe(
				'RETIRED',
			);
			expect(await provider.activateLocal(database.manager, { ...slot })).toBe(false);
			expect(f.claims.qualification(claim, false)).toBeNull();
			f.qualify(current);
			const freshQualification = f.claims.qualification(current, false);
			expect(freshQualification).not.toBeNull();
			const fresh = f.fixture.transport.captureReconcileReadiness(target, current, freshQualification);
			expect(fresh).toMatchObject({ capabilityVersion: 1, qualificationGeneration: current.qualificationGeneration });
			expect(fresh.isCurrent()).toBe(true);
			expect(f.claims.qualification(claim, false)).not.toBe(qualification);
			expect(f.fixture.transport.captureReconcileReadiness(target, claim, freshQualification)).toBeNull();
			const journal = await database.manager.findBy(VirtualThermostatCommandEntity, { controllerId, action: 'on' });
			expect(journal.length).toBeGreaterThan(0);
			expect(
				journal.every((command) => command.status !== 'accepted' && command.claimRevision === claim.revision),
			).toBe(true);
		} finally {
			release();
			await Promise.allSettled([original, restoring].filter((job) => job !== undefined));
			await f.cleanup();
		}
	});
	it('admitted original OFF callback and journal settlement survive registration expiry without release proof', async () => {
		const f = await ownedGuard();
		let release: () => void, entered: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));
		const entry = new Promise<void>((resolve) => (entered = resolve));
		let original: Promise<void> | undefined;
		try {
			await f.fixture.report(f.sensor, 16);
			for (let phase = 0; phase < 3; phase++) {
				await f.runtime.requestInstalled(controllerId);
				await f.fixture.flushTelemetry();
			}
			expect(f.fixture.controls.sends).toContainEqual({ property: f.actuator, on: true });
			const platform = f.fixture.platform,
				callback = captureCreation(platform, ['admitGuardFenceSample']);
			const originalReceivers: unknown[] = [];
			const admitted = jest.spyOn(platform, 'admitGuardFenceSample').mockImplementation(async function (...args) {
				originalReceivers.push(this);
				entered();
				await gate;
				return callback.values.admitGuardFenceSample.call(callback.receiver, ...args);
			});
			await f.fixture.report(f.sensor, 21);
			original = f.runtime.requestInstalled(controllerId);
			void original.catch(() => undefined);
			await entry;
			const pending = await database.manager.findBy(VirtualThermostatCommandEntity, {
				controllerId,
				action: 'off',
				status: 'dispatching',
			});
			expect(pending).toHaveLength(1);
			const originalCommand = pending[0];
			f.fixture.platforms.onModuleDestroy();
			release();
			await original;
			expect(originalReceivers).toEqual([platform]);
			expect(admitted).toHaveBeenCalledTimes(1);
			const settled = await database.manager.findOneByOrFail(VirtualThermostatCommandEntity, {
				id: originalCommand.id,
			});
			expect(settled).toMatchObject({
				claimId: originalCommand.claimId,
				claimRevision: originalCommand.claimRevision,
				status: 'accepted',
				fault: null,
				proofId: null,
			});
			expect(settled.dispatchedAt).not.toBeNull();
			expect(settled.settledAt).not.toBeNull();
			expect(f.runtime.readDiagnostics(controllerId).branches.every((branch) => !branch.release_proven)).toBe(true);
		} finally {
			release();
			await Promise.allSettled(original !== undefined ? [original] : []);
			await f.cleanup();
		}
	});
	it('the actual activity installation requests the existing runtime and exposes its native effective automation', async () => {
		const valuesRegistry = new PropertyProducerRegistryService(events);
		// This controller has no physical bindings or output properties: storage/transport are not qualification evidence.
		const values = new PropertyValueService(
			{} as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService(database),
			valuesRegistry,
			events,
		);
		const runtimeClaims = new VirtualThermostatClaimsService(
			database,
			structure,
			graph,
			new PropertyCommandAdmissionRegistryService(),
			events,
		);
		const transport = new VirtualThermostatTransportService(new PlatformRegistryService(), values);
		const runtime = new VirtualThermostatRuntimeService(
			database,
			structure,
			runtimeClaims,
			new VirtualThermostatInputsService(database, values),
			transport,
			values,
			valuesRegistry,
			events,
			graph,
			comfort,
			new ConfigService(),
			undefined,
			provider,
		);
		try {
			await graph.onApplicationBootstrap();
			await runtimeClaims.onApplicationBootstrap();
			await runtime.onApplicationBootstrap();
			const authored = await author({ thermostat_preset: 'eco' });
			const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			expect(state.activityStatus).toBe(ActivityActivationStatus.ACTIVE);
			expect(runtime.readDiagnostics(controllerId).effective_comfort).toMatchObject({
				source: 'automation',
				preset: 'eco',
				heating_setpoint: 17,
			});
			expect(runtime.readDiagnostics(controllerId).reasons).not.toContain('runtime_error');
			expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 17 });
			await modes.deactivateMode(roomId, state.activationId, 'operator');
			await runtime.requestInstalled(controllerId);
			expect(runtime.readDiagnostics(controllerId).effective_comfort).toMatchObject({
				source: 'manual',
				heating_setpoint: 20,
			});
		} finally {
			runtime.onModuleDestroy();
			await runtime.capturePredecessors(controllerId);
			await runtime.flush();
			runtimeClaims.onModuleDestroy();
			valuesRegistry.onModuleDestroy();
		}
	});

	it('does not re-add a numeric delta or mint a new generation when the exact running installation repeats', async () => {
		const authored = await author({ setpoint_delta: -2 });
		const activationId = randomUUID();
		await database.manager.insert(SpaceActivityStateEntity, {
			spaceId: roomId,
			activationId,
			selectedActivityMode: ActivityMode.WORK,
			selectedActivityRevision: authored.activityRevision,
			activityStatus: ActivityActivationStatus.ACTIVATING,
			activityActor: 'operator',
			activityResults: [],
		});
		const identity = {
			spaceId: roomId,
			activationId,
			configurationRevision: authored.activityRevision,
			isCurrent: () => Promise.resolve(true),
		};
		expect((await producer.apply(identity, authored.activityConfiguration.climate)).status).toBe(
			ActivityDomainStatus.SUCCEEDED,
		);
		const before = await Promise.all([
			database.query<unknown[]>('SELECT * FROM devices_module_climate_automation_sources'),
			database.query<unknown[]>('SELECT * FROM devices_module_climate_automation_slots'),
			database.query<unknown[]>('SELECT * FROM devices_virtual_thermostat_configs'),
		]);
		expect((await producer.apply(identity, authored.activityConfiguration.climate)).status).toBe(
			ActivityDomainStatus.SUCCEEDED,
		);
		expect(
			await Promise.all([
				database.query<unknown[]>('SELECT * FROM devices_module_climate_automation_sources'),
				database.query<unknown[]>('SELECT * FROM devices_module_climate_automation_slots'),
				database.query<unknown[]>('SELECT * FROM devices_virtual_thermostat_configs'),
			]),
		).toEqual(before);
		expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'automation', heating_setpoint: 18 });
	});
	it('keeps a committed bundle inhibited when its original producer disappears during original publication', async () => {
		const authored = await author({ thermostat_preset: 'eco' });
		configuration.onModuleDestroy();
		const afterCommit = configuration.afterCommit.bind(configuration) as VirtualThermostatConfigService['afterCommit'];
		let foreign: ReturnType<ClimateAutomationRegistryService['registerProducerOwned']> | undefined;
		const published = jest.fn();
		const publication = jest.fn(async (id: string) => {
			await afterCommit(id);
			producer.onModuleDestroy();
			foreign = registry.registerProducerOwned('space-activity:v1', {
				validateInManager: (_manager, source) => Promise.resolve(JSON.parse(source.evidence) as never),
			});
		});
		const dispose = provider.registerPublication(publication);
		events.on(ACTIVITY_STATE_CHANGED, published);
		try {
			const state = await modes.activateMode(roomId, ActivityMode.WORK, authored.activityRevision, 'operator');
			expect(state).toMatchObject({
				activityStatus: ActivityActivationStatus.ACTIVATING,
				activityResults: [],
			});
			expect(await database.manager.findOneByOrFail(SpaceActivityStateEntity, { spaceId: roomId })).toEqual(state);
			const retainedSlot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			expect(retainedSlot).toMatchObject({ state: 'LIVE' });
			expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'manual', heating_setpoint: 20 });
			expect(publication).toHaveBeenCalledTimes(1);
			expect(published).toHaveBeenCalledTimes(1);
			expect(published).toHaveBeenLastCalledWith({
				space_id: roomId,
				activation_id: state.activationId,
				configuration_revision: authored.activityRevision,
			});
			await modes.onApplicationBootstrap();
			expect(await database.manager.findOneByOrFail(SpaceActivityStateEntity, { spaceId: roomId })).toMatchObject({
				activationId: state.activationId,
				activityStatus: ActivityActivationStatus.INTERRUPTED,
				activityResults: [],
			});
			expect(await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId })).toEqual(
				retainedSlot,
			);
			expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'manual', heating_setpoint: 20 });
			expect(publication).toHaveBeenCalledTimes(1);
			expect(published).toHaveBeenCalledTimes(1);
		} finally {
			events.off(ACTIVITY_STATE_CHANGED, published);
			dispose();
			foreign?.dispose();
		}
	});

	it.each([
		{ selection: { thermostat_preset: 'eco' as const }, temperature: 17 },
		{ selection: { setpoint: 22 }, temperature: 22 },
		{ selection: { setpoint_delta: -2 }, temperature: 18 },
	])(
		'previews without writes, installs $selection, and retires on deactivation',
		async ({ selection, temperature }) => {
			const authored = await author(selection);
			const before = await database.query<unknown[]>('SELECT * FROM devices_virtual_thermostat_configs');
			const preview = await modes.preview(roomId, ActivityMode.WORK, authored.activityRevision);
			expect(preview).toContainEqual(
				expect.objectContaining({ domain: 'climate', status: ActivityDomainStatus.READY }),
			);
			expect(await database.query<unknown[]>('SELECT * FROM devices_virtual_thermostat_configs')).toEqual(before);
			expect(await database.manager.count(ClimateAutomationSourceEntity)).toBe(0);
			const state = await modes.activateMode(
				roomId,
				ActivityMode.WORK,
				authored.activityRevision,
				'authenticated-operator',
			);
			expect(state.activityStatus).toBe(ActivityActivationStatus.ACTIVE);
			expect(state.activityResults).toContainEqual(
				expect.objectContaining({ domain: 'climate', status: ActivityDomainStatus.SUCCEEDED }),
			);
			expect((await comfort.get(controllerId)).effective).toMatchObject({
				source: 'automation',
				heating_setpoint: temperature,
			});
			const source = await database.manager.findOneByOrFail(ClimateAutomationSourceEntity, {
				subjectId: roomId,
				isCurrent: true,
			});
			const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId });
			expect(source.state).toBe('FINALIZED_LIVE');
			expect(slot).toMatchObject({ state: 'LIVE', generationId: source.generationId, manualHold: false });
			await modes.deactivateMode(roomId, state.activationId, 'authenticated-operator');
			expect((await comfort.get(controllerId)).effective).toMatchObject({ source: 'manual', heating_setpoint: 20 });
			expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId })).toMatchObject({
				state: 'RETIRED',
			});
			expect(await database.manager.findOneBy(SpaceActivityStateEntity, { spaceId: roomId })).toMatchObject({
				activityStatus: ActivityActivationStatus.DEACTIVATED,
			});
		},
	);
});
