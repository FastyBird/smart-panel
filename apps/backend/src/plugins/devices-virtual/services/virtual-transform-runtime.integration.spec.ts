import { instanceToPlain } from 'class-transformer';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { Characteristic, HAPStatus, Service } from '@homebridge/hap-nodejs';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddVirtualNumericTransforms1000000000029 } from '../../../migrations/1000000000029-AddVirtualNumericTransforms';
import { EventType as ConfigEvent } from '../../../modules/config/config.constants';
import { PluginsTypeMapperService } from '../../../modules/config/services/plugins-type-mapper.service';
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
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { discoverExtensions } from '../../../modules/extensions/services/extensions-discovery';
import { ExtensionsService } from '../../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { HomeKitEventListener } from '../../devices-homekit/listeners/homekit-event.listener';
import { HomeKitCommandDispatcher } from '../../devices-homekit/services/homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from '../../devices-homekit/services/homekit-mapper-registry.service';
import { HomeKitPropertyStateService } from '../../devices-homekit/services/homekit-property-state.service';
import { nativeVoltmeterVoltageIdentity } from '../../devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ConfigureVirtualAggregateDto } from '../dto/producer-config.dto';
import { ConfigureVirtualTransformDto, VirtualNumericTransformPolicyDto } from '../dto/transform-config.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualAggregateInputEntity, VirtualAggregateOperator } from '../entities/virtual-producer.entity';
import { VirtualThermostatSourceEntity } from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import { VirtualTransformMetadataSubscriber } from '../subscribers/virtual-transform-metadata.subscriber';

import { VirtualAggregateRuntimeService } from './virtual-aggregate-runtime.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualNumericOperatorHostService } from './virtual-numeric-operator-host.service';
import { VirtualNumericOperatorRegistry } from './virtual-numeric-operator.registry';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { VirtualProducerConfigService } from './virtual-producer-config.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { thermostatFingerprint, thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { VirtualThermostatInputsService } from './virtual-thermostat-inputs.service';
import { evaluateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';
import { VirtualTransformConfigService } from './virtual-transform-config.service';
import { attachTransformPreview } from './virtual-transform-preview.utils';
import { VirtualTransformResolver } from './virtual-transform-resolver';
import { VirtualTransformRuntimeService } from './virtual-transform-runtime.service';

jest.setTimeout(120000);
const base = Date.parse('2026-10-13T10:00:00Z');

describe('numeric transform real SQLite contract and runtime', () => {
	let operatorHost: VirtualNumericOperatorHostService | undefined;
	let operators: VirtualNumericOperatorRegistry;
	let resolver: VirtualTransformResolver;
	let directory: string;
	let database: SqliteDataSource;
	let graph: VirtualDependencyGraphService;
	let state: VirtualProducerStateService;
	let runtime: VirtualAggregateRuntimeService;
	let configs: VirtualProducerConfigService;
	let transforms: VirtualTransformConfigService;
	let transformRuntime: VirtualTransformRuntimeService;
	let values: PropertyValueService;
	let producers: PropertyProducerRegistryService;
	let events: EventEmitter2;
	let statuses: Map<string, ConnectionState>;
	let storage: {
		writePoints: jest.Mock;
		enqueueWritePoint: jest.Mock;
		flushQueuedWrites: jest.Mock;
		query: jest.Mock;
		isConnected: jest.Mock;
	};

	beforeEach(async () => {
		operatorHost = undefined;
		directory = await mkdtemp(join(tmpdir(), 'vd2-aggregate-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'test.sqlite'),
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		database.subscribers.push({
			listenTo: () => ChannelPropertyEntity,
			afterLoad: (entity: ChannelPropertyEntity) => {
				entity.unit = resolvePropertyUnit(entity);
			},
		});
		new VirtualTransformMetadataSubscriber(database);
		jest.useFakeTimers({ now: base, doNotFake: ['nextTick', 'setImmediate'] });
		events = new EventEmitter2();
		producers = new PropertyProducerRegistryService(events);
		storage = {
			isConnected: jest.fn(() => true),
			writePoints: jest.fn().mockResolvedValue(undefined),
			enqueueWritePoint: jest.fn().mockResolvedValue(undefined),
			flushQueuedWrites: jest.fn().mockResolvedValue(undefined),
			query: jest.fn().mockResolvedValue([]),
		};
		values = new PropertyValueService(
			storage as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			producers,
			events,
		);
		graph = new VirtualDependencyGraphService(database);
		state = new VirtualProducerStateService(database, producers, graph, events);
		configs = new VirtualProducerConfigService(database, new DeviceStructureLockService(), graph, events, state);
		statuses = new Map();
		operators = new VirtualNumericOperatorRegistry();
		resolver = new VirtualTransformResolver(operators);
		runtime = new VirtualAggregateRuntimeService(
			database,
			producers,
			values,
			{
				readLatest: (device: DeviceEntity) =>
					Promise.resolve({ status: statuses.get(device.id) ?? ConnectionState.UNKNOWN }),
			} as DeviceConnectionStateService,
			graph,
			events,
		);
		transformRuntime = new VirtualTransformRuntimeService(
			database,
			producers,
			values,
			{
				readLatest: (device: DeviceEntity) =>
					Promise.resolve({ status: statuses.get(device.id) ?? ConnectionState.UNKNOWN }),
			} as DeviceConnectionStateService,
			graph,
			events,
			undefined,
			resolver,
		);
		transforms = new VirtualTransformConfigService(
			database,
			new DeviceStructureLockService(),
			graph,
			events,
			state,
			transformRuntime,
			resolver,
		);
	});

	afterEach(async () => {
		operatorHost?.onModuleDestroy();
		runtime?.onModuleDestroy();
		transformRuntime?.onModuleDestroy();
		state?.onModuleDestroy();
		producers?.onModuleDestroy();
		jest.restoreAllMocks();
		jest.useRealTimers();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});

	const measurement = async (mode?: VirtualDeviceMode): Promise<ChannelPropertyEntity> => {
		const deviceId = uuid(),
			channelId = uuid(),
			id = uuid();
		await database.getRepository(mode ? VirtualDeviceEntity : DeviceEntity).insert({
			id: deviceId,
			name: 'Temperature',
			category: DeviceCategory.SENSOR,
			...(mode ? { mode } : {}),
		} as never);
		await database
			.getRepository(mode ? VirtualChannelEntity : ChannelEntity)
			.insert({ id: channelId, device: deviceId, name: 'Temperature', category: ChannelCategory.TEMPERATURE } as never);
		await database.getRepository(mode ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
			id,
			channel: channelId,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			...(mode ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
		} as never);
		return database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
	};
	const rawVolts = async (): Promise<ChannelPropertyEntity> => {
		const device = uuid(),
			channel = uuid(),
			id = uuid();
		const identity = nativeVoltmeterVoltageIdentity(
			'voltmeter:100',
			{ id: 100, range: 0, report_thr: 0.1, xvoltage: { expr: null, unit: null } },
			{ voltmeter: { 'voltmeter:100': {} } },
			'A8032ABE5085',
		);
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: device,
			name: 'Voltmeter',
			category: DeviceCategory.SENSOR,
			canonicalMac: 'A8032ABE5085',
		} as never);
		await database.manager.insert(ShellyNgChannelEntity, {
			id: channel,
			device,
			name: 'Raw voltage',
			category: ChannelCategory.ANALOG_INPUT,
			identifier: identity.channelIdentifier,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id,
			channel,
			identifier: 'voltage',
			category: PropertyCategory.VALUE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
		} as never);
		return database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
	};
	const configure = async (
		output: ChannelPropertyEntity,
		sources: ChannelPropertyEntity[],
		minimumValidInputs = sources.length,
		revision = 0,
		operator = VirtualAggregateOperator.MEAN,
	) => {
		await configs.configureAggregate(
			output.id,
			Object.assign(new ConfigureVirtualAggregateDto(), {
				expectedRevision: revision,
				operator,
				minimumValidInputs,
				maximumAgeSeconds: 10,
				inputs: sources.map((source) => ({ sourcePropertyId: source.id })),
			}),
		);
		await runtime.flush();
	};
	const sample = async (property: ChannelPropertyEntity, value: number | null, sampledAt = Date.now()) => {
		await values.writeSampleWithState(property, value, {
			sampledAt: new Date(sampledAt),
			receivedAt: new Date(),
			provenance: 'live',
		});
		await transformRuntime.flush();
		await runtime.flush();
	};
	const start = async () => {
		await state.onModuleInit();
		await graph.onApplicationBootstrap();
		await transformRuntime.onApplicationBootstrap();
		await runtime.onApplicationBootstrap();
	};
	const outputState = (output: ChannelPropertyEntity) => producers.read(output.id);

	const dto = (source: ChannelPropertyEntity, revision = 0): ConfigureVirtualTransformDto =>
		Object.assign(new ConfigureVirtualTransformDto(), {
			schemaVersion: 1,
			expectedRevision: revision,
			maximumAgeSeconds: 10,
			quantity: PropertyCategory.TEMPERATURE,
			unit: '°C',
			source: { sourcePropertyId: source.id },
			policy: {
				operator: VirtualNumericTransformOperator.AFFINE,
				scale: 2,
				offset: 1,
				inputRange: { minimum: -100, maximum: 100 },
				outputRange: { minimum: -200, maximum: 200 },
			},
		});
	it('discovers a trusted owner export, previews, persists, evaluates and revokes with retained history and fresh reactivation', async () => {
		const pkg = join(directory, 'fixture');
		await mkdir(pkg);
		await writeFile(
			join(pkg, 'package.json'),
			JSON.stringify({
				name: '@fixture/operator',
				main: 'index.js',
				fastybird: {
					smartPanelBackend: {
						kind: 'plugin',
						routePrefix: 'not-the-owner',
						extensionExport: 'FixtureModule',
						numericOperatorsExport: 'operators',
						configOwnerType: 'fixture-owner',
					},
				},
			}),
		);
		await writeFile(
			join(pkg, 'index.js'),
			`exports.FixtureConfig = class FixtureConfig {}; exports.FixtureConfigDto = class FixtureConfigDto {}; exports.FixtureModule = class FixtureModule { constructor(mapper, metadata) { this.mapper=mapper; this.metadata=metadata; } onModuleInit() { this.mapper.registerMapping({type:'fixture-owner',class:exports.FixtureConfig,configDto:exports.FixtureConfigDto}); this.metadata.registerPluginMetadata({type:'fixture-owner',name:'Fixture',packageName:'@fixture/operator'}); } }; exports.operators = [{contractVersion:1,name:'offset',operatorVersion:1,input:{quantity:'temperature',unit:'°C'},output:{quantity:'temperature',unit:'°C'},inputRange:{minimum:-40,maximum:100},outputRange:{minimum:-50,maximum:110},parameters:{offset:{required:true,minimum:-10,maximum:10}},evaluate:(n,p)=>n+p.offset}];`,
		);
		const discovered = (await discoverExtensions({ extraDirs: [directory], namePrefixes: ['@fixture/'] })).backend;
		expect(discovered).toHaveLength(1);
		expect(discovered[0]).toMatchObject({
			pkgName: '@fixture/operator',
			kind: 'plugin',
			configOwnerType: 'fixture-owner',
			packageDir: pkg,
		});
		const mapper = new PluginsTypeMapperService();
		const modules = { getMappings: () => [] };
		const metadata = new ExtensionsService({} as never, modules as never, mapper, {} as never);
		const fixture = new discovered[0].extensionClass(mapper, metadata) as { onModuleInit(): void };
		fixture.onModuleInit();
		const manager = new ManagedServiceManagerService(
			{ getPluginConfig: () => ({ enabled: true }) } as never,
			new NestConfigService(),
			{ hasValidator: () => false } as never,
			{ resolve: () => Promise.resolve(undefined) } as never,
		);
		await manager.onApplicationBootstrap();
		const register = () => {
			operatorHost = new VirtualNumericOperatorHostService(
				operators,
				manager,
				modules as never,
				mapper,
				metadata,
				events,
				discovered,
			);
			operatorHost.onModuleInit();
			operatorHost.onApplicationBootstrap();
			const capturedHost = operatorHost;
			return () => capturedHost.onModuleDestroy();
		};
		const dispose = register();
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		const aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		const request = dto(source);
		request.policy = {
			operator: VirtualNumericTransformOperator.EXTENSION,
			contractVersion: 1,
			operatorId: '@fixture/operator:offset',
			operatorVersion: 1,
			parameters: { offset: 2 },
			inputRange: { minimum: -40, maximum: 100 },
			outputRange: { minimum: -50, maximum: 110 },
		};
		const preview = attachTransformPreview(await transforms.preview(output.id, request), 20, resolver);
		expect(preview.preview_result).toMatchObject({ value: 22, qualified: false });
		await transforms.configure(output.id, request);
		expect((await transforms.get(output.id)).policy).toEqual(request.policy);
		const sibling = await measurement();
		await configure(aggregate, [output, sibling]);
		await start();
		await sample(source, 20);
		await sample(sibling, 20);
		expect(outputState(output)).toMatchObject({
			value: 22,
			producer: { quality: 'good', sampledAt: new Date(base).toISOString() },
		});
		expect(outputState(aggregate)?.producer.quality).toBe('good');
		const history = storage.writePoints.mock.calls.length + storage.enqueueWritePoint.mock.calls.length;
		let release: () => void, entered: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		let paused = false;
		storage.writePoints.mockImplementation(async (points: { tags: { propertyId: string } }[]) => {
			if (!paused && points[0].tags.propertyId === output.id) {
				paused = true;
				entered();
				await gate;
			}
		});
		await values.writeSampleWithState(source, 21, {
			sampledAt: new Date(base),
			receivedAt: new Date(base),
			provenance: 'live',
		});
		await started;
		const scope = operators.capture('@fixture/operator:offset', 1);
		jest.setSystemTime(base + 1_000);
		events.emit(ConfigEvent.CONFIG_RELOAD);
		expect(scope.isCurrent()).toBe(false);
		expect(operators.capture('@fixture/operator:offset', 1)).toBeNull();
		expect(outputState(output)?.producer.quality).toBe('unavailable');
		expect(outputState(aggregate)?.producer.quality).toBe('unavailable');
		// The entered write may retain history, but reload must fence its current publication.
		expect(storage.writePoints.mock.calls.length + storage.enqueueWritePoint.mock.calls.length).toBe(history + 2);
		release();
		await transformRuntime.flush();
		await runtime.flush();
		expect(outputState(output)?.producer.quality).toBe('unavailable');
		expect(outputState(aggregate)?.producer.quality).toBe('unavailable');
		expect((await values.readLatest(output))?.value).toBeNull();
		expect(operators.capture('@fixture/operator:offset', 1)).toBeNull();
		await sample(source, 21);
		jest.setSystemTime(base + 2_000);
		await manager.restartService('plugin', 'fixture-owner', 'numeric-operators');
		await transformRuntime.flush();
		await runtime.flush();
		expect(outputState(output)?.producer.quality).toBe('unavailable');
		await sample(source, 21, base + 1_000);
		expect(outputState(output)?.value).toBe(23);
		expect(outputState(output)?.producer.sampledAt).toBe(new Date(base + 1_000).toISOString());
		expect(outputState(aggregate)?.producer).toMatchObject({
			quality: 'good',
			sampledAt: new Date(base).toISOString(),
			expiresAt: new Date(base + 10_000).toISOString(),
		});
		dispose();
	});

	it('isolates stored JSON null and scalar policies during timer drains without renewing healthy sibling evidence', async () => {
		operators.activate('@fixture/identity', [
			{
				contractVersion: 1,
				name: 'identity',
				operatorVersion: 1,
				input: { quantity: 'temperature', unit: '°C' },
				output: { quantity: 'temperature', unit: '°C' },
				inputRange: { minimum: -100, maximum: 100 },
				outputRange: { minimum: -200, maximum: 200 },
				parameters: {},
				evaluate: (n) => n,
			},
		]);
		const source = await measurement();
		const outputs = await Promise.all(Array.from({ length: 4 }, () => measurement(VirtualDeviceMode.SENSOR_TRANSFORM)));
		for (const [index, output] of outputs.entries()) {
			const request = dto(source);
			if (index === 3)
				request.policy = {
					operator: VirtualNumericTransformOperator.EXTENSION,
					contractVersion: 1,
					operatorId: '@fixture/identity:identity',
					operatorVersion: 1,
					parameters: {},
					inputRange: request.policy.inputRange,
					outputRange: request.policy.outputRange,
				};
			await transforms.configure(output.id, request);
		}
		await start();
		await sample(source, 20);
		const healthy = outputs.slice(2).map((output) => outputState(output));
		const history = storage.writePoints.mock.calls.length;
		for (const [index, policy] of [null, 17].entries()) {
			await database.query('UPDATE devices_virtual_transform_configs SET policy = ? WHERE outputPropertyId = ?', [
				JSON.stringify(policy),
				outputs[index].id,
			]);
			expect(instanceToPlain(await transforms.get(outputs[index].id)).policy).toEqual(policy);
			const request = dto(source, 1);
			request.policy = policy as unknown as ConfigureVirtualTransformDto['policy'];
			await expect(transforms.preview(outputs[index].id, request)).rejects.toThrow(
				/missing_configuration|invalid_input_range/,
			);
		}
		const invalidations = jest.spyOn(producers, 'invalidate');
		for (let tick = 1; tick <= 2; tick++) {
			jest.advanceTimersByTime(1_000);
			await transformRuntime.flush();
			await runtime.flush();
			for (const [index, output] of outputs.slice(0, 2).entries()) {
				expect(transformRuntime.readDiagnostics(output.id)?.reasons).toContain(
					index === 0 ? 'missing_configuration' : 'invalid_input_range',
				);
				expect(outputState(output)?.producer.quality).toBe('unavailable');
				expect((await values.readLatest(output))?.value).toBeNull();
				expect(transformRuntime.readDiagnostics(output.id)?.reasons).not.toContain('runtime_error');
			}
			for (const [index, output] of outputs.slice(2).entries()) {
				expect(outputState(output)).toMatchObject({
					value: healthy[index].value,
					producer: {
						quality: 'good',
						sampledAt: healthy[index].producer.sampledAt,
						expiresAt: healthy[index].producer.expiresAt,
					},
				});
			}
		}
		expect(
			invalidations.mock.calls.every(([lease]) => !outputs.slice(2).some((output) => output.id === lease.propertyId)),
		).toBe(true);
		expect(storage.writePoints.mock.calls.length).toBe(history);
	});

	it.each(['database', 'history-write'])(
		'fences a revoked custom activation across a delayed %s and re-registration',
		async (stage) => {
			const definition = {
				contractVersion: 1 as const,
				name: 'offset',
				operatorVersion: 1,
				input: { quantity: 'temperature' as const, unit: '°C' as const },
				output: { quantity: 'temperature' as const, unit: '°C' as const },
				inputRange: { minimum: -40, maximum: 100 },
				outputRange: { minimum: -50, maximum: 110 },
				parameters: { offset: { required: true, minimum: -10, maximum: 10 } },
				evaluate: (n: number, p: Readonly<Record<string, number>>) => n + p.offset,
			};
			const dispose = operators.activate('@fixture/operator', [definition]);
			const source = await measurement(),
				output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
			const request = dto(source);
			request.policy = {
				operator: VirtualNumericTransformOperator.EXTENSION,
				contractVersion: 1,
				operatorId: '@fixture/operator:offset',
				operatorVersion: 1,
				parameters: { offset: 2 },
				inputRange: definition.inputRange,
				outputRange: definition.outputRange,
			};
			await transforms.configure(output.id, request);
			await start();
			await sample(source, 20);
			let release: () => void, entered: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			const started = new Promise<void>((resolve) => {
				entered = resolve;
			});
			let paused = false;
			if (stage === 'database') {
				const original = database.manager.findOne.bind(database.manager) as typeof database.manager.findOne;
				jest
					.spyOn(database.manager, 'findOne')
					.mockImplementation(async (...args: Parameters<typeof database.manager.findOne>) => {
						if (!paused && args[0] === VirtualChannelPropertyEntity) {
							paused = true;
							entered();
							await gate;
						}
						return original(...args);
					});
			} else
				storage.writePoints.mockImplementation(async (points: { tags: { propertyId: string } }[]) => {
					if (!paused && points[0].tags.propertyId === output.id) {
						paused = true;
						entered();
						await gate;
					}
				});
			const pending = values.writeSampleWithState(source, 21, {
				sampledAt: new Date(base),
				receivedAt: new Date(base),
				provenance: 'live',
			});
			await pending;
			await Promise.race([
				started,
				transformRuntime.flush().then(() => {
					if (!paused)
						throw new Error(`Expected ${stage} pause: ${JSON.stringify(transformRuntime.readDiagnostics(output.id))}`);
				}),
			]);
			dispose();
			expect(outputState(output)?.producer.quality).toBe('unavailable');
			const newDispose = operators.activate('@fixture/operator', [definition]);
			dispose(); // stale disposer cannot remove the new activation
			release();
			await pending;
			await transformRuntime.flush();
			expect(outputState(output)?.producer.quality).toBe('unavailable');
			expect((await values.readLatest(output))?.value).toBeNull();
			await sample(source, 22);
			expect(outputState(output)?.value).toBe(24);
			newDispose();
		},
	);

	const transform = async (source: ChannelPropertyEntity, output: ChannelPropertyEntity, revision = 0) => {
		await transforms.configure(output.id, dto(source, revision));
		await transformRuntime.flush();
		await runtime.flush();
	};

	const homekit = (output: ChannelPropertyEntity) => {
		const channel = output.channel as ChannelEntity,
			device = channel.device as DeviceEntity;
		device.channels = [channel];
		channel.properties = [output];
		device.status = { online: true } as DeviceEntity['status'];
		const registry = new HomeKitMapperRegistryService(
			new HomeKitPropertyStateService(producers, new PropertyValueSourceRegistryService()),
		);
		const staged = registry.buildAccessory(
			device,
			new HomeKitCommandDispatcher({ canExecuteCompositeProperty: () => false } as never),
		);
		if (!staged) throw new Error('Missing HomeKit measurement');
		registry.commitStaged(staged);
		const listener = new HomeKitEventListener(registry);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (property: ChannelPropertyEntity) =>
			listener.handlePropertyValueSet(property),
		);
		const service = staged.accessory.getService(Service.TemperatureSensor);
		return {
			reading: service.getCharacteristic(Characteristic.CurrentTemperature),
			fault: service.getCharacteristic(Characteristic.StatusFault),
		};
	};

	it('HomeKit follows the real converter domain, negative Celsius, range rejection and recovery', async () => {
		const raw = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(raw, output);
		await start();
		const hap = homekit(output);
		await expect(hap.reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		await sample(raw, -3);
		expect(outputState(output)).toMatchObject({ value: -5, producer: { quality: 'good' } });
		expect(await hap.reading.handleGetRequest()).toBe(-5);
		// Backend permits this calibrated output, but standard HAP cannot represent >100 C.
		await sample(raw, 60);
		await expect(hap.reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		expect(await hap.fault.handleGetRequest()).toBe(Characteristic.StatusFault.GENERAL_FAULT);
		await sample(raw, null);
		await expect(hap.reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		jest.setSystemTime(base + 1);
		await sample(raw, 10);
		expect(outputState(output)).toMatchObject({ value: 21, producer: { quality: 'good' } });
		expect(await hap.reading.handleGetRequest()).toBe(21);
		expect(await hap.fault.handleGetRequest()).toBe(Characteristic.StatusFault.NO_FAULT);
	});
	it('new aggregate evidence barriers ignore retained transformed output until a new physical acceptance', async () => {
		const raw = await measurement(),
			sibling = await measurement(),
			transformed = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await transforms.configure(transformed.id, dto(raw));
		await configure(aggregate, [transformed, sibling]);
		await start();
		await sample(raw, 10);
		await sample(sibling, 20);
		expect(outputState(aggregate)?.producer.quality).toBe('good');
		runtime.requireFreshInputs(aggregate.id, [
			{ sourceId: transformed.id, leafId: raw.id },
			{ sourceId: sibling.id, leafId: sibling.id },
		]);
		runtime.requestRecompute();
		await runtime.flush();
		expect(outputState(aggregate)?.value).toBeNull();
		transformRuntime.requestRecompute();
		await transformRuntime.flush();
		await runtime.flush();
		expect(outputState(aggregate)?.value).toBeNull();
		await sample(sibling, 20);
		expect(outputState(aggregate)?.value).toBeNull();
		jest.advanceTimersByTime(1000);
		await sample(raw, 10);
		expect(outputState(aggregate)?.producer.quality).toBe('good');
		expect(outputState(aggregate)?.value).toBe(20.5);
	});

	it('requires exact leaf incorporation when transform publications share a millisecond', async () => {
		const raw = await measurement(),
			sibling = await measurement(),
			transformed = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await transforms.configure(transformed.id, dto(raw));
		await configure(aggregate, [transformed, sibling]);
		await start();
		await sample(raw, 10);
		await sample(sibling, 20);
		expect(outputState(aggregate)).toMatchObject({ value: 20.5, producer: { quality: 'good' } });
		runtime.requireFreshInputs(aggregate.id, [
			{ sourceId: transformed.id, leafId: raw.id },
			{ sourceId: sibling.id, leafId: sibling.id },
		]);
		runtime.requestRecompute();
		await runtime.flush();
		await sample(sibling, 20);
		const observed: ChannelPropertyEntity[] = [];
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (property: ChannelPropertyEntity) => {
			if (property.id === aggregate.id) observed.push(property);
		});
		const originalPublish = values.publishDerived.bind(values) as PropertyValueService['publishDerived'];
		const publish = jest.spyOn(values, 'publishDerived');
		/** Pauses after the transform captured its source sample, before live publication. */
		const pauseTransform = () => {
			let release: () => void;
			let started: () => void;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			const entered = new Promise<void>((resolve) => {
				started = resolve;
			});
			publish.mockImplementation(async (...args) => {
				if (args[0].id === transformed.id) {
					publish.mockImplementation(originalPublish);
					started();
					await gate;
				}
				return originalPublish(...args);
			});
			return { entered, release: () => release() };
		};
		/** Admits another leaf report without advancing either sample or server clock. */
		const acceptLeaf = (value: number) =>
			values.writeSampleWithState(raw, value, {
				sampledAt: new Date(base),
				receivedAt: new Date(base),
				provenance: 'live',
			});
		try {
			const first = pauseTransform();
			await acceptLeaf(11);
			await first.entered;
			await runtime.flush();
			expect(outputState(transformed)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
			expect((await values.readLatest(transformed))?.value).toBeNull();
			expect(outputState(aggregate)?.value).toBeNull();
			expect(observed.some((property) => property.value?.producer?.quality === 'good')).toBe(false);
			// A second acceptance fences the pending evaluation; its publication cannot claim this report.
			await acceptLeaf(12);
			await runtime.flush();
			expect(outputState(aggregate)?.value).toBeNull();
			first.release();
			await transformRuntime.flush();
			await runtime.flush();
			expect(outputState(transformed)).toMatchObject({ value: 25, producer: { quality: 'good' } });
			expect(outputState(aggregate)).toMatchObject({ value: 22.5, producer: { quality: 'good' } });
			expect(
				observed
					.filter((property) => property.value?.producer?.quality === 'good')
					.map((property) => property.value.value),
			).toEqual([22.5]);
			observed.length = 0;
			// The incorporation guard stays armed after admission for another same-clock report.
			const next = pauseTransform();
			await acceptLeaf(13);
			await next.entered;
			await runtime.flush();
			expect(outputState(transformed)).toMatchObject({ value: null, producer: { quality: 'unavailable' } });
			expect((await values.readLatest(transformed))?.value).toBeNull();
			expect(outputState(aggregate)?.value).toBeNull();
			expect(observed.some((property) => property.value?.producer?.quality === 'good')).toBe(false);
			next.release();
			await transformRuntime.flush();
			await runtime.flush();
			expect(outputState(aggregate)).toMatchObject({ value: 23.5, producer: { quality: 'good' } });
			expect(outputState(aggregate).producer.sampledAt).toBe(new Date(base).toISOString());
		} finally {
			publish.mockRestore();
		}
	});

	it('follows a transform source replacement without admitting its pre-admission cached leaf', async () => {
		const raw = await measurement(),
			replacement = await measurement(),
			sibling = await measurement(),
			transformed = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await transform(raw, transformed);
		await configure(aggregate, [transformed, sibling]);
		await start();
		await sample(raw, 10);
		await sample(sibling, 20);
		await sample(replacement, 15);
		runtime.requireFreshInputs(aggregate.id, [{ sourceId: transformed.id, leafId: raw.id }]);
		await transform(replacement, transformed, 1);
		expect(outputState(aggregate)?.value).toBeNull();
		await sample(replacement, 16);
		expect(transformRuntime.readDiagnostics(transformed.id)).toMatchObject({ reasons: [] });
		expect(outputState(transformed)).toMatchObject({ value: 33, producer: { quality: 'good' } });
		expect(runtime.readDiagnostics(aggregate.id)).toMatchObject({ quality: 'good' });
		expect(outputState(aggregate)).toMatchObject({ value: 26.5, producer: { quality: 'good' } });
		await sample(raw, 30);
		expect(outputState(aggregate)).toMatchObject({ value: 26.5, producer: { quality: 'good' } });
		await database.manager.update(
			VirtualTransformSourceEntity,
			{ outputPropertyId: transformed.id },
			{
				sourcePropertyId: aggregate.id,
				sourcePropertyIdentity: aggregate.id,
			},
		);
		await graph.refreshQuarantine();
		await transformRuntime.flush();
		await runtime.flush();
		expect(outputState(aggregate)?.value).toBeNull();
	});

	it('keeps a repaired cyclic transform unavailable until a report after reconfiguration admission', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 12);
		const alias = await measurement(VirtualDeviceMode.PROJECTION);
		await database.manager.update(VirtualChannelPropertyEntity, alias.id, {
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: output.id,
		});
		await database.manager.update(
			VirtualTransformSourceEntity,
			{ outputPropertyId: output.id },
			{
				sourcePropertyId: alias.id,
				sourcePropertyIdentity: alias.id,
			},
		);
		await graph.refreshQuarantine();
		expect(graph.isQuarantined(alias.id)).toBe(true);
		expect(outputState(output)?.value).toBeNull();
		const observed: (number | null)[] = [];
		const restored = jest.fn();
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (property: ChannelPropertyEntity) => {
			if (property.id === output.id) observed.push(property.value?.value as number | null);
		});
		events.on(EventType.CHANNEL_PROPERTY_UPDATED, (property: ChannelPropertyEntity) => {
			if (property.id === alias.id) restored();
		});
		await transforms.configure(output.id, dto(source, 1));
		await transformRuntime.flush();
		await runtime.flush();
		expect(restored).toHaveBeenCalledTimes(1);
		expect(graph.isRevisionCurrent(await graph.revision())).toBe(true);
		expect(graph.isQuarantined(alias.id)).toBe(false);
		expect(observed.length).toBeGreaterThan(0);
		expect(observed.every((value) => value === null)).toBe(true);
		expect(outputState(output)?.value).toBeNull();
		await sample(source, 12);
		expect(outputState(output)).toMatchObject({ value: 25, producer: { quality: 'good', revision: 2 } });
	});
	it('converts raw volts to Celsius while preserving source age and expiring without renewal', async () => {
		const source = await rawVolts(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		expect(resolvePropertyUnit(source)).toBe('V');
		await transform(source, output);
		const configuredOutput = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: output.id },
			relations: ['channel', 'channel.device'],
		});
		const config = await database.manager.findOneByOrFail(VirtualTransformConfigEntity, {
			outputPropertyId: output.id,
		});
		const binding = await database.manager.findOneByOrFail(VirtualTransformSourceEntity, {
			outputPropertyId: output.id,
		});
		const floor = Object.assign(new VirtualThermostatSourceEntity(), {
			id: uuid(),
			controllerId: uuid(),
			role: 'floor' as const,
			sourcePropertyId: output.id,
			sourcePropertyIdentity: output.id,
			physicalIdentity: `property:${source.id}`,
			maximumAgeSeconds: 10,
			contractFingerprint: thermostatFingerprint({
				output: thermostatPropertyContract(
					configuredOutput,
					configuredOutput.channel as ChannelEntity,
					(configuredOutput.channel as ChannelEntity).device as DeviceEntity,
				),
				transformRevision: config.revision,
				transformPolicy: config.policy,
				physicalIdentity: `property:${binding.sourcePropertyIdentity}`,
				sourceQuantity: binding.quantity,
				sourceUnit: binding.unit,
			}),
		});
		const inputs = new VirtualThermostatInputsService(database, values);
		const loaded = await inputs.load([floor]);
		expect(loaded[0].compatible).toBe(true);
		await start();
		expect(outputState(output).value).toBeNull();
		jest.setSystemTime(base + 4000);
		await sample(source, 2, base + 1000);
		expect(outputState(output)).toMatchObject({
			value: 5,
			producer: {
				quality: 'good',
				sampledAt: new Date(base + 1000).toISOString(),
				expiresAt: new Date(base + 11000).toISOString(),
			},
		});
		expect(inputs.read(loaded, base + 4000).floor).toBe(5);
		jest.setSystemTime(base + 8000);
		transformRuntime.requestRecompute();
		await transformRuntime.flush();
		expect(outputState(output).producer.expiresAt).toBe(new Date(base + 11000).toISOString());
		jest.setSystemTime(base + 11000);
		expect(outputState(output).value).toBeNull();
		expect(inputs.read(loaded, base + 11000).floor).toBeNull();
		transformRuntime.requestRecompute();
		await transformRuntime.flush();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toContain('stale');
		await database.manager.update(
			VirtualTransformSourceEntity,
			{ outputPropertyId: output.id },
			{ sourcePropertyId: null },
		);
		expect((await inputs.load([floor]))[0].compatible).toBe(false);
		expect(storage.writePoints).toHaveBeenCalledTimes(1);
	});

	it('edits the owned output range atomically while preserving identity and stored history', async () => {
		const source = await measurement();
		const output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		const historyWrites = storage.enqueueWritePoint.mock.calls.length;
		const emitted: ChannelPropertyEntity[] = [];
		events.on(EventType.CHANNEL_PROPERTY_UPDATED, (property: ChannelPropertyEntity) => emitted.push(property));
		const edited = dto(source);
		edited.expectedRevision = 1;
		edited.policy.outputRange = { minimum: -50, maximum: 150 };
		await transforms.configure(output.id, edited);
		const persisted = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		expect(persisted.format).toEqual([-50, 150]);
		expect(
			emitted.some((property) => property.id === output.id && JSON.stringify(property.format) === '[-50,150]'),
		).toBe(true);
		expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(historyWrites);
		expect(await database.manager.countBy(VirtualTransformConfigEntity, { outputPropertyId: output.id })).toBe(1);
		const graphRevision = await graph.revision();
		const eventsBefore = emitted.length;
		// A rejected edit must not publish a partial range change.
		edited.expectedRevision = 2;
		edited.policy.outputRange = { minimum: 150, maximum: -50 };
		await expect(transforms.configure(output.id, edited)).rejects.toThrow();
		expect(await graph.revision()).toBe(graphRevision);
		expect((await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id })).format).toEqual([
			-50, 150,
		]);
		expect(emitted).toHaveLength(eventsBefore);
	});

	it('revokes on null, domain errors, disabled and offline source while retaining history', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		await sample(source, null);
		expect(outputState(output).value).toBeNull();
		await database.manager.update(VirtualTransformConfigEntity, output.id, {
			policy: { ...dto(source).policy, inputRange: { minimum: -100, maximum: 30 } } as never,
		});
		jest.setSystemTime(base + 1);
		await sample(source, 40);
		expect(transformRuntime.readDiagnostics(output.id).reasons).toEqual(['input_out_of_range']);
		jest.setSystemTime(base + 2);
		await sample(source, 20);
		const device = (source.channel as ChannelEntity).device as DeviceEntity;
		statuses.set(device.id, ConnectionState.DISCONNECTED);
		events.emit(EventType.DEVICE_CONNECTION_CHANGED, { device, state: ConnectionState.DISCONNECTED });
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toEqual(['offline']);
		statuses.set(device.id, ConnectionState.CONNECTED);
		await database.manager.update(DeviceEntity, device.id, { enabled: false });
		events.emit(EventType.DEVICE_UPDATED, device);
		await transformRuntime.flush();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toEqual(['disabled']);
	});

	it('shares preview/write validation, enforces revisions and rolls back graph on invalid policy', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		const config = dto(source);
		const proposed = await transforms.preview(output.id, config);
		expect(proposed.revision).toBe(1);
		expect(await database.manager.count(VirtualTransformConfigEntity)).toBe(0);
		await transforms.configure(output.id, config);
		const graphRevision = await graph.revision();
		await expect(transforms.configure(output.id, config)).rejects.toThrow('revision');
		const bad = dto(source, 1);
		(bad.policy as VirtualNumericTransformPolicyDto).scale = Infinity;
		await expect(transforms.preview(output.id, bad)).rejects.toThrow('invalid_coefficients');
		await expect(transforms.configure(output.id, bad)).rejects.toThrow('invalid_coefficients');
		expect(await graph.revision()).toBe(graphRevision);
		const stale = dto(source, 1);
		stale.expectedGraphRevision = graphRevision - 1;
		await expect(transforms.preview(output.id, stale)).rejects.toThrow('graph revision');
		await expect(transforms.configure(output.id, stale)).rejects.toThrow('graph revision');
	});

	it('retains missing identity, remaps the same binding and cascades owned configuration', async () => {
		const source = await measurement(),
			replacement = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		const old = (await transforms.get(output.id)).source;
		await database.manager.delete(ChannelPropertyEntity, source.id);
		events.emit(EventType.CHANNEL_PROPERTY_DELETED, source);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		expect((await transforms.get(output.id)).source).toMatchObject({
			id: old.id,
			source_property: null,
			source_identity: source.id,
		});
		const remap = dto(replacement, 1);
		remap.source.id = old.id;
		await transforms.configure(output.id, remap);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(replacement, 22);
		expect(outputState(output)).toMatchObject({ value: 45, producer: { revision: 2 } });
		expect((await transforms.get(output.id)).source.id).toBe(old.id);
		await database.manager.delete(ChannelPropertyEntity, output.id);
		expect(await database.manager.count(VirtualTransformSourceEntity)).toBe(0);
		expect(await database.manager.count(VirtualTransformConfigEntity)).toBe(0);
	});

	it('fences old lease/config and waits for new evidence following a configuration edit', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		const lease = producers.register(output, 1),
			evaluation = producers.beginEvaluation(lease);
		jest.setSystemTime(base + 1000);
		const edited = dto(source, 1);
		(edited.policy as VirtualNumericTransformPolicyDto).scale = 3;
		await transforms.configure(output.id, edited);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await values.publishDerived(
			output,
			lease,
			999,
			{
				quality: 'good',
				reasons: [],
				sampledAt: new Date(base),
				evaluatedAt: new Date(),
				expiresAt: new Date(base + 10000),
			},
			evaluation,
		);
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output)).toMatchObject({ value: 61, producer: { revision: 2 } });
	});

	it('feeds an aggregate canonical temperature with bounded expiry and failure membership', async () => {
		const raw = await measurement(),
			physical = await measurement(),
			converted = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE);
		await transform(raw, converted);
		await configure(aggregate, [physical, converted]);
		await start();
		await sample(physical, 21);
		await sample(raw, 10);
		expect(outputState(aggregate)).toMatchObject({
			value: 21,
			producer: { quality: 'good', expiresAt: new Date(base + 10000).toISOString() },
		});
		await sample(raw, null);
		expect(outputState(converted).value).toBeNull();
		expect(outputState(aggregate).value).toBeNull();
		expect(
			await database.manager.count(VirtualAggregateInputEntity, { where: { outputPropertyId: aggregate.id } }),
		).toBe(2);
		await sample(raw, 10);
		jest.setSystemTime(base + 10000);
		expect(outputState(aggregate).value).toBeNull();
	});

	it('refuses recursive or writable virtual inputs and native Celsius NTC conversion', async () => {
		const physical = await measurement(),
			upstream = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await expect(transforms.configure(output.id, dto(upstream))).rejects.toThrow('incompatible_source');
		const ntc = dto(physical);
		ntc.policy = {
			operator: VirtualNumericTransformOperator.NTC_BETA,
			inputRange: { minimum: 0.1, maximum: 3.2 },
			outputRange: { minimum: -50, maximum: 150 },
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			nominalResistance: 10000,
			nominalTemperatureCelsius: 25,
			beta: 3950,
			thermistorLeg: 'low',
		};
		await expect(transforms.configure(output.id, ntc)).rejects.toThrow('incompatible_ntc_semantics');
		await database.manager.update(ChannelPropertyEntity, physical.id, { category: PropertyCategory.VOLTAGE });
		await database.manager.update(ChannelEntity, (physical.channel as ChannelEntity).id, {
			category: ChannelCategory.ELECTRICAL_POWER,
		});
		await transforms.configure(output.id, ntc);
		await start();
		const voltage = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: physical.id },
			relations: ['channel', 'channel.device'],
		});
		await sample(voltage, 1.65);
		expect(outputState(output).value).toBeCloseTo(25);
	});

	it('converts the qualified pilot raw voltage into a fail-closed Celsius floor', async () => {
		const voltage = await rawVolts();
		const output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		const request = dto(voltage);
		request.policy = {
			operator: VirtualNumericTransformOperator.STEINHART_HART,
			inputRange: { minimum: 0, maximum: 10 },
			outputRange: { minimum: -100, maximum: 150 },
			referenceVoltage: 10,
			seriesResistance: 10_000,
			coefficientA: 0.0010351024725298568,
			coefficientB: 0.0002338353574079741,
			coefficientC: 7.917851073336009e-8,
			thermistorLeg: 'low',
		};
		await transforms.configure(output.id, request);
		const configuredOutput = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: output.id },
			relations: ['channel', 'channel.device'],
		});
		const config = await database.manager.findOneByOrFail(VirtualTransformConfigEntity, {
			outputPropertyId: output.id,
		});
		const binding = await database.manager.findOneByOrFail(VirtualTransformSourceEntity, {
			outputPropertyId: output.id,
		});
		const floor = Object.assign(new VirtualThermostatSourceEntity(), {
			id: uuid(),
			controllerId: uuid(),
			role: 'floor' as const,
			sourcePropertyId: output.id,
			sourcePropertyIdentity: output.id,
			physicalIdentity: `property:${voltage.id}`,
			maximumAgeSeconds: 10,
			contractFingerprint: thermostatFingerprint({
				output: thermostatPropertyContract(
					configuredOutput,
					configuredOutput.channel as ChannelEntity,
					(configuredOutput.channel as ChannelEntity).device as DeviceEntity,
				),
				transformRevision: config.revision,
				transformPolicy: config.policy,
				physicalIdentity: `property:${binding.sourcePropertyIdentity}`,
				sourceQuantity: binding.quantity,
				sourceUnit: binding.unit,
			}),
		});
		const inputs = new VirtualThermostatInputsService(database, values);
		const loaded = await inputs.load([floor]);
		expect(loaded[0]).toMatchObject({ compatible: true, producerRevision: 1 });
		const heatDecision = (at: number) =>
			evaluateVirtualThermostatPolicy(
				{
					heatingSetpoint: 20,
					coolingSetpoint: null,
					coldTolerance: 0.5,
					hotTolerance: 0.5,
					neutralMargin: 1,
					minimumOffMs: 0,
					changeoverMs: 0,
					floor: { limit: 30, recoveryHysteresis: 1 },
				},
				{
					now: at,
					mode: 'heat',
					ambient: 18,
					floor: inputs.read(loaded, at).floor,
					heating: { activity: 'off', pendingOn: false, releaseProven: true, canEnergize: true, offSince: 0 },
					cooling: null,
					previousDemand: 'off',
					floorOverheatLatched: false,
					windows: [],
					heuristicWindowPause: false,
					reconciled: true,
				},
			);
		await start();
		jest.setSystemTime(base + 4000);
		await sample(voltage, 6.68, base + 1000);
		expect(outputState(output).value).toBeCloseTo(18.45, 2);
		expect(outputState(output).producer).toMatchObject({
			sampledAt: new Date(base + 1000).toISOString(),
			expiresAt: new Date(base + 11000).toISOString(),
			revision: 1,
		});
		expect(inputs.read(loaded, base + 4000).floor).toBeCloseTo(18.45, 2);
		expect(heatDecision(base + 4000).desiredHeating).toBe(true);
		jest.setSystemTime(base + 5000);
		await sample(voltage, 0);
		expect(transformRuntime.readDiagnostics(output.id).reasons).toContain('invalid_domain');
		expect(heatDecision(base + 5000)).toMatchObject({ desiredHeating: false, reasons: ['floor_unavailable'] });
		jest.setSystemTime(base + 6000);
		await sample(voltage, 10);
		expect(transformRuntime.readDiagnostics(output.id).reasons).toContain('invalid_domain');
		expect(heatDecision(base + 6000).desiredHeating).toBe(false);
		jest.setSystemTime(base + 7000);
		await sample(voltage, 6.68);
		expect(heatDecision(base + 7000).desiredHeating).toBe(true);
		jest.setSystemTime(base + 8000);
		await sample(voltage, null);
		expect(outputState(output).value).toBeNull();
		expect(heatDecision(base + 8000).desiredHeating).toBe(false);
		jest.setSystemTime(base + 9000);
		await sample(voltage, 6.68);
		jest.setSystemTime(base + 19000);
		expect(heatDecision(base + 19000).desiredHeating).toBe(false);
		await database.manager.update(
			VirtualTransformSourceEntity,
			{ outputPropertyId: output.id },
			{ sourcePropertyId: null },
		);
		expect((await inputs.load([floor]))[0].compatible).toBe(false);
	});

	it('migration and synchronization retain matching indexes, source nulling and owner cascades', async () => {
		await database.manager.query('DROP TABLE devices_virtual_transform_sources');
		await database.manager.query('DROP TABLE devices_virtual_transform_configs');
		const migration = new AddVirtualNumericTransforms1000000000029();
		const runner = database.createQueryRunner();
		await migration.up(runner);
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		const binding = await database.manager.findOneByOrFail(VirtualTransformSourceEntity, {
			outputPropertyId: output.id,
		});
		await expect(database.manager.insert(VirtualTransformSourceEntity, { ...binding, id: uuid() })).rejects.toThrow();
		await database.manager.delete(ChannelPropertyEntity, source.id);
		expect(await database.manager.findOneByOrFail(VirtualTransformSourceEntity, { id: binding.id })).toMatchObject({
			sourcePropertyId: null,
			sourcePropertyIdentity: source.id,
		});
		await database.manager.delete(ChannelPropertyEntity, output.id);
		expect(await database.manager.count(VirtualTransformConfigEntity)).toBe(0);
		await migration.down(runner);
		await migration.up(runner);
		await runner.release();
		const sourceTable = await database.createQueryRunner().getTable('devices_virtual_transform_sources');
		expect(sourceTable.foreignKeys.map((fk) => [fk.columnNames[0], fk.onDelete])).toEqual(
			expect.arrayContaining([
				['sourcePropertyId', 'SET NULL'],
				['outputPropertyId', 'CASCADE'],
			]),
		);
		expect(sourceTable.indices.map((index) => [index.name, index.isUnique])).toEqual(
			expect.arrayContaining([
				['UQ_virtual_transform_source_output', true],
				['IDX_virtual_transform_source', false],
			]),
		);
	});
	it('requires a new accepted packet after source metadata changes even within the same clock millisecond', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		await database.manager.update(ChannelPropertyEntity, source.id, { category: PropertyCategory.HUMIDITY });
		events.emit(EventType.CHANNEL_PROPERTY_UPDATED, source);
		expect(outputState(output).value).toBeNull();
		await transformRuntime.flush();
		expect(transformRuntime.readDiagnostics(output.id).reasons).toContain('incompatible_source');
		await database.manager.update(ChannelPropertyEntity, source.id, { category: PropertyCategory.TEMPERATURE });
		events.emit(EventType.CHANNEL_PROPERTY_UPDATED, source);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output).value).toBe(41);
		await transform(source, output, 1);
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output).value).toBe(41);
	});

	it('refuses generic numeric temperature masquerading but supports explicit humidity conversion', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await database.manager.update(ChannelEntity, (output.channel as ChannelEntity).id, {
			category: ChannelCategory.HUMIDITY,
		});
		await database.manager.update(ChannelPropertyEntity, output.id, { category: PropertyCategory.HUMIDITY });
		await expect(transforms.configure(output.id, dto(source))).rejects.toThrow('incompatible_output');
		const humidity = dto(source);
		humidity.quantity = PropertyCategory.HUMIDITY;
		humidity.unit = '%';
		await transforms.configure(output.id, humidity);
		await start();
		await sample(source, 20);
		expect(outputState(output).value).toBe(41);
		const aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE),
			second = await measurement();
		await expect(configure(aggregate, [output, second])).rejects.toThrow('canonical transformed temperatures');
	});

	it('cannot resurrect a configuration after a real output history write finishes late', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		let release: () => void, started: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			started = resolve;
		});
		storage.writePoints.mockImplementationOnce(() => {
			started();
			return blocked;
		});
		await values.writeSampleWithState(source, 20, {
			sampledAt: new Date(base),
			receivedAt: new Date(base),
			provenance: 'live',
		});
		await entered;
		const edited = dto(source, 1);
		(edited.policy as VirtualNumericTransformPolicyDto).scale = 3;
		await transforms.configure(output.id, edited);
		expect(outputState(output)).toMatchObject({ value: null, producer: { revision: 2 } });
		release();
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(source, 20);
		expect(outputState(output)).toMatchObject({ value: 61, producer: { revision: 2 } });
	});

	it('coalesces source bursts while unrelated traffic cannot restart its in-flight evaluation', async () => {
		const source = await measurement(),
			unrelated = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		const original = database.manager.findOne.bind(database.manager) as typeof database.manager.findOne;
		let release: () => void, started: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			started = resolve;
		});
		let blocked = false;
		const read = jest.spyOn(database.manager, 'findOne').mockImplementation(async (entity, options) => {
			if (entity === ChannelPropertyEntity && (options.where as { id?: string }).id === source.id && !blocked) {
				blocked = true;
				started();
				await gate;
			}
			return original(entity, options);
		});
		transformRuntime.requestRecompute();
		await entered;
		await values.writeSampleWithState(unrelated, 30, {
			sampledAt: new Date(base),
			receivedAt: new Date(base),
			provenance: 'live',
		});
		events.emit(EventType.DEVICE_CONNECTION_CHANGED, {
			device: (unrelated.channel as ChannelEntity).device,
			state: ConnectionState.DISCONNECTED,
		});
		jest.advanceTimersByTime(1000);
		release();
		await transformRuntime.flush();
		expect(
			read.mock.calls.filter(
				([entity, options]) => entity === ChannelPropertyEntity && (options.where as { id?: string }).id === source.id,
			),
		).toHaveLength(1);
		read.mockRestore();
		expect(outputState(output).value).toBe(41);
	});

	it('keeps restart history unavailable and CLI generation free of database/runtime access', async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(source, output);
		await start();
		await sample(source, 20);
		transformRuntime.onModuleDestroy();
		runtime.onModuleDestroy();
		producers.onModuleDestroy();
		const restartedProducers = new PropertyProducerRegistryService(events);
		const restartedValues = new PropertyValueService(
			storage as unknown as StorageService,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService({} as never),
			restartedProducers,
			events,
		);
		const restartedRuntime = new VirtualTransformRuntimeService(
			database,
			restartedProducers,
			restartedValues,
			{
				readLatest: () => Promise.resolve({ status: ConnectionState.CONNECTED }),
			} as unknown as DeviceConnectionStateService,
			graph,
			events,
		);
		await restartedRuntime.onApplicationBootstrap();
		expect(restartedProducers.read(output.id).value).toBeNull();
		restartedRuntime.onModuleDestroy();
		restartedProducers.onModuleDestroy();
		const { ConfigService } = await import('@nestjs/config');
		const cli = new VirtualTransformRuntimeService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			new ConfigService({ FB_CLI: 'on' }),
		);
		await cli.onApplicationBootstrap();
		expect(cli.isActive()).toBe(false);
		cli.onModuleDestroy();
	});
	it('admits the ordinary derived authoring hook with an unhydrated channel reference', async () => {
		const output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		const property = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		const channelId = (output.channel as ChannelEntity).id;
		property.channel = channelId;
		const authoring = new VirtualDevicesService({} as never, {} as never, {} as never, {} as never, {} as never, graph);
		await expect(
			authoring.assertDerivedOutputSupported(property, channelId, database.manager),
		).resolves.toBeUndefined();
	});

	it('remaps a disabled owner without leaving its source index or freshness barrier on the old source', async () => {
		const a = await measurement(),
			b = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await transform(a, output);
		await start();
		await sample(a, 20);
		const owner = (output.channel as ChannelEntity).device as DeviceEntity;
		await database.manager.update(DeviceEntity, owner.id, { enabled: false });
		events.emit(EventType.DEVICE_UPDATED, owner);
		await transformRuntime.flush();
		await transform(b, output, 1);
		await sample(b, 30);
		expect(outputState(output).value).toBeNull();
		await database.manager.update(DeviceEntity, owner.id, { enabled: true });
		events.emit(EventType.DEVICE_UPDATED, owner);
		await transformRuntime.flush();
		expect(outputState(output).value).toBeNull();
		await sample(b, 30);
		expect(outputState(output).value).toBe(61);
	});
	const generic = async () => {
		const source = await measurement(),
			output = await measurement(VirtualDeviceMode.SENSOR_TRANSFORM);
		await database.manager.update(ChannelEntity, (source.channel as ChannelEntity).id, {
			category: ChannelCategory.ELECTRICAL_POWER,
		});
		await database.manager.update(ChannelPropertyEntity, source.id, { category: PropertyCategory.VOLTAGE });
		await database.manager.update(ChannelEntity, (output.channel as ChannelEntity).id, {
			category: ChannelCategory.ANALOG_INPUT,
		});
		await database.manager.update(ChannelPropertyEntity, output.id, { category: PropertyCategory.VALUE });
		return {
			source: await database.manager.findOneOrFail(ChannelPropertyEntity, {
				where: { id: source.id },
				relations: ['channel', 'channel.device'],
			}),
			output,
		};
	};

	it('persists custom quantity/unit through cold hydration and rejects history meaning changes', async () => {
		const { source, output } = await generic();
		const proposed = dto(source);
		proposed.quantity = 'voltage';
		proposed.unit = 'mV';
		(proposed.policy as VirtualNumericTransformPolicyDto).scale = 1000;
		(proposed.policy as VirtualNumericTransformPolicyDto).offset = 0;
		proposed.policy.outputRange.maximum = 100000;
		expect((await transforms.preview(output.id, proposed)).unit).toBe('mV');
		await transforms.configure(output.id, proposed);
		await start();
		await sample(source, 1.65);
		expect(outputState(output).value).toBe(1650);
		const cold = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		expect(instanceToPlain(cold)).toMatchObject({
			unit: 'mV',
			measurement_quantity: 'voltage',
			category: PropertyCategory.VALUE,
		});
		expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: source.id })).unit).toBeNull();
		const edited = dto(source, 1);
		edited.quantity = 'voltage';
		edited.unit = 'kV';
		(edited.policy as VirtualNumericTransformPolicyDto).scale = 0.001;
		(edited.policy as VirtualNumericTransformPolicyDto).offset = 0;
		const revision = await graph.revision();
		const historyWrites = storage.enqueueWritePoint.mock.calls.length;
		await expect(transforms.preview(output.id, edited)).rejects.toThrow('immutable');
		await expect(transforms.configure(output.id, edited)).rejects.toThrow('immutable');
		edited.unit = 'mV';
		edited.quantity = 'custom_voltage';
		await expect(transforms.configure(output.id, edited)).rejects.toThrow('immutable');
		expect(await graph.revision()).toBe(revision);
		expect(outputState(output).value).toBe(1650);
		expect(storage.enqueueWritePoint).toHaveBeenCalledTimes(historyWrites);
		const changed = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		expect(instanceToPlain(changed)).toMatchObject({ unit: 'mV', measurement_quantity: 'voltage' });
		const authoring = new VirtualDevicesService({} as never, {} as never, {} as never, {} as never, {} as never, graph);
		await expect(
			authoring.assertDerivedOutputSupported(changed, (output.channel as ChannelEntity).id, database.manager),
		).resolves.toBeUndefined();
		transformRuntime.onModuleDestroy();
		runtime.onModuleDestroy();
		await database.destroy();
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'test.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		new VirtualTransformMetadataSubscriber(database);
		const restarted = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: output.id });
		expect(instanceToPlain(restarted)).toMatchObject({ unit: 'mV', measurement_quantity: 'voltage' });
		const persisted = await database.manager.findOneByOrFail(VirtualTransformConfigEntity, {
			outputPropertyId: output.id,
		});
		expect(persisted).toMatchObject({ unit: 'mV', quantity: 'voltage', revision: 1 });
	});

	it.each(['<script>', 'mV\n', 'mV\u0000', ' mV', 'mV;alert(1)', 'x'.repeat(33)])(
		'rejects unsafe custom unit %j in both preview and persistence',
		async (unit) => {
			const { source, output } = await generic();
			const proposed = dto(source);
			proposed.quantity = 'custom';
			proposed.unit = unit;
			await expect(transforms.preview(output.id, proposed)).rejects.toThrow('incompatible_output');
			await expect(transforms.configure(output.id, proposed)).rejects.toThrow('incompatible_output');
		},
	);

	it('keeps generic Celsius labels ineligible for temperature composition and checks the real sensor VALUE slot', async () => {
		const { source, output } = await generic();
		const proposed = dto(source);
		proposed.quantity = 'custom';
		proposed.unit = '°C';
		await transforms.configure(output.id, proposed);
		const aggregate = await measurement(VirtualDeviceMode.SENSOR_AGGREGATE),
			second = await measurement();
		await expect(configure(aggregate, [output, second])).rejects.toThrow('canonical transformed temperatures');
		const invalid = dto(source, 1);
		invalid.quantity = 'temperature';
		await expect(transforms.configure(output.id, invalid)).rejects.toThrow('immutable');
		const validation = new DeviceValidationService({} as never);
		const result = validation.validateDeviceStructure({
			category: DeviceCategory.SENSOR,
			channels: [
				{
					category: ChannelCategory.DEVICE_INFORMATION,
					properties: getRequiredProperties(ChannelCategory.DEVICE_INFORMATION).map((property) => ({
						category: property,
						dataType: getPropertyMetadata(ChannelCategory.DEVICE_INFORMATION, property).data_type,
						permissions: getPropertyMetadata(ChannelCategory.DEVICE_INFORMATION, property).permissions,
					})),
				},
				{
					category: ChannelCategory.ANALOG_INPUT,
					properties: [
						{ category: PropertyCategory.VALUE, dataType: DataTypeType.FLOAT, permissions: [PermissionType.READ_ONLY] },
					],
				},
				{
					category: ChannelCategory.ANALOG_INPUT,
					properties: [
						{ category: PropertyCategory.VALUE, dataType: DataTypeType.FLOAT, permissions: [PermissionType.READ_ONLY] },
					],
				},
			],
		});
		expect(result).toMatchObject({ isValid: true, issues: [] });
	});
});
