import { EntityManager } from 'typeorm';
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
import type { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import type {
	NativeClimateRequest,
	NativeClimateUnit,
} from '../../../modules/devices/platforms/native-climate.contract';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { NativeThermostatEntity, NativeThermostatRequestEntity } from '../entities/native-thermostat.entity';

import { NativeThermostatService } from './native-thermostat.service';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';

jest.setTimeout(30_000);

describe('native thermostat durable request lifecycle', () => {
	let database: SqliteDataSource;
	let service: NativeThermostatService;
	let controller: string;
	let source: string;
	let dispatch: jest.Mock;
	let prepare: jest.Mock;
	let unit: NativeClimateUnit;
	let registry: PropertyCommandAdmissionRegistryService;
	let lock: DeviceStructureLockService;
	let guardedDispatch: () => boolean;
	let valueWriter: { write: jest.Mock; publishDerived: jest.Mock };
	let extraUnits: Map<string, NativeClimateUnit>;
	let structuralCompletion: (() => Promise<void>) | undefined;
	let structuralPreflightFailure = false;
	let structuralRollback: (() => void) | undefined;
	let failingMirror: { id: string; reject: boolean } | undefined;

	const start = async () => {
		valueWriter = {
			write: jest.fn((property: VirtualChannelPropertyEntity) => {
				if (failingMirror && property.id === failingMirror.id)
					return failingMirror.reject ? Promise.reject(new Error('local mirror failed')) : Promise.resolve(false);
				return Promise.resolve(true);
			}),
			publishDerived: jest.fn().mockResolvedValue({ state: null }),
		};
		registry = new PropertyCommandAdmissionRegistryService();
		lock = new DeviceStructureLockService();
		const graph = {
			withStructuralWrite: async <T>(work: (manager: EntityManager) => Promise<T>) => {
				const complete = structuralCompletion;
				const preflightFailure = structuralPreflightFailure;
				const rollback = structuralRollback;
				structuralRollback = undefined;
				structuralCompletion = undefined;
				structuralPreflightFailure = false;
				try {
					if (preflightFailure) throw new Error('graph preflight refused');
					return await database.transaction(async (manager) => {
						const value = await work(manager);
						if (rollback) {
							rollback();
							throw new Error('graph write rolled back');
						}
						return value;
					});
				} finally {
					await complete?.();
				}
			},
		};
		service = new NativeThermostatService(
			database,
			lock,
			graph as unknown as VirtualDependencyGraphService,
			{} as DevicesService,
			{
				get: () => ({
					captureNativeClimateUnit: (device: DeviceEntity) => Promise.resolve(extraUnits.get(device.id) ?? unit),
				}),
			} as unknown as PlatformRegistryService,
			registry,
			valueWriter as unknown as PropertyValueService,
			new PropertyProducerRegistryService(new EventEmitter2()),
		);
		await service.onApplicationBootstrap();
	};
	beforeEach(async () => {
		extraUnits = new Map();
		failingMirror = undefined;
		structuralCompletion = undefined;
		structuralPreflightFailure = false;
		structuralRollback = undefined;
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		controller = uuid();
		source = uuid();
		await database.manager.insert(DeviceEntity, [
			{ id: controller, name: 'Native virtual controller', category: DeviceCategory.THERMOSTAT, enabled: true },
			{ id: source, name: 'Canonical source', category: DeviceCategory.THERMOSTAT, enabled: true },
		]);
		dispatch = jest.fn((isAdmitted: () => boolean) => {
			guardedDispatch = isAdmitted;
			return Promise.resolve([{ operation: 'mode', outcome: 'accepted', confirmed: false }]);
		});
		prepare = jest.fn((request: NativeClimateRequest) =>
			Object.keys(request).length === 1 ? { isCurrent: () => true, dispatch } : null,
		);
		unit = {
			contractVersion: 1,
			deviceId: source,
			provider: 'zigbee2mqtt',
			physicalIdentity: 'z2m:test',
			fingerprint: 'v1',
			ownedPropertyIds: ['canonical-mode'],
			capabilities: {
				modes: ['off', 'heat'],
				heating: { minimum: 5, maximum: 30, step: 0.5 },
				cooling: null,
				supportsCompound: false,
			},
			isCurrent: () => true,
			prepare,
			observe: () => ({
				available: false,
				temperature: null,
				mode: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
				activity: null,
				observedAt: null,
				reasons: ['no_live_feedback'],
			}),
		};
		await database.manager.insert(NativeThermostatEntity, {
			controllerId: controller,
			sourceDeviceId: source,
			physicalIdentity: unit.physicalIdentity,
			fingerprint: unit.fingerprint,
			provider: unit.provider,
			revision: 1,
			requested: {},
			propertyIds: {},
			ownedPropertyIds: [...unit.ownedPropertyIds],
			latestRequestId: null,
		});
		await start();
	});
	afterEach(async () => {
		await service.onModuleDestroy();
		await database.destroy();
	});

	it.each(['source', 'aliases'] as const)(
		'retains the original reservation across canonical identity changes through %s',
		async (boundary) => {
			const currentSource = boundary === 'source' ? source : uuid();
			if (currentSource !== source)
				await database.manager.insert(DeviceEntity, {
					id: currentSource,
					name: 'Moved native aliases',
					category: DeviceCategory.THERMOSTAT,
					enabled: true,
				});
			// Provider configuration/catalog changes revoke the original capture before recapture.
			jest.spyOn(unit, 'isCurrent').mockReturnValue(false);
			unit = {
				...unit,
				isCurrent: () => true,
				deviceId: currentSource,
				physicalIdentity: 'renamed-upstream:same-command-bundle',
			};
			await expect(service.preview({ name: 'Second controller', sourceDevice: currentSource })).rejects.toThrow(
				'already reserved',
			);
			expect((await service.candidates()).find((candidate) => candidate.device === currentSource)?.reasons).toEqual([
				'reserved',
			]);
		},
	);

	it('owns ordinary native command scalars and destinations before its first database wait', async () => {
		await database.manager.update(
			NativeThermostatEntity,
			{ controllerId: controller },
			{ propertyIds: { mode: 'mode' } },
		);
		const input: IDevicePropertyData[] = [
			{
				device: { id: controller } as DeviceEntity,
				channel: {} as ChannelEntity,
				property: { id: 'mode' } as ChannelPropertyEntity,
				value: 'heat',
			},
		];
		const issued = service.command(input);
		input[0].value = 'off';
		input[0].property.id = 'replacement';
		await expect(issued).resolves.toBe(true);
		expect(prepare).toHaveBeenCalledWith({ mode: 'heat' });
		expect((await service.get(controller))?.requested).toEqual({ mode: 'heat' });
	});

	it('refuses an unsupported compound before journaling or changing requested state', async () => {
		await expect(
			service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat', heatingSetpoint: 21 }),
		).rejects.toThrow('Unsupported');
		expect(await database.manager.count(NativeThermostatRequestEntity)).toBe(0);
		expect((await service.get(controller))?.requested).toEqual({});
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('journals before transport, accepts one explicit patch and never replays a duplicate id', async () => {
		const requestId = uuid();
		dispatch.mockImplementation(async () => {
			const request = await database.manager.findOneByOrFail(NativeThermostatRequestEntity, { id: requestId });
			expect(request.state).toBe('pending');
			return [{ operation: 'setpoint', outcome: 'accepted', confirmed: false }];
		});
		const dto = { requestId, expectedRevision: 1, heatingSetpoint: 21 };
		const result = await service.request(controller, dto);
		expect(result?.requested).toEqual({ heatingSetpoint: 21 });
		expect(result?.observed.heatingSetpoint).toBeNull();
		expect(result?.latest_request?.operations[0]).toEqual({
			operation: 'setpoint',
			outcome: 'accepted',
			confirmed: false,
		});
		await service.request(controller, dto);
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(prepare).toHaveBeenCalledWith({ heatingSetpoint: 21 });
	});

	it('keeps the original request identity when a retained caller object changes during preparation', async () => {
		const originalId = uuid();
		const input = { requestId: originalId, expectedRevision: 1, mode: 'heat' as const };
		prepare.mockImplementationOnce(() => {
			Object.assign(input, { requestId: uuid(), expectedRevision: 999, mode: 'off' });
			return { isCurrent: () => true, dispatch };
		});
		const result = await service.request(controller, input);
		expect(result?.latest_request?.id).toBe(originalId);
		expect(result?.requested).toEqual({ mode: 'heat' });
		expect(await database.manager.count(NativeThermostatRequestEntity)).toBe(1);
	});

	it('a successor fences older transport without letting older completion overwrite successor intent', async () => {
		let oldCurrent!: () => boolean;
		let release!: () => void;
		let started!: () => void;
		const began = new Promise<void>((resolve) => {
			started = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		dispatch.mockImplementationOnce(async (current: () => boolean) => {
			guardedDispatch = current;
			oldCurrent = current;
			started();
			await gate;
			return [{ operation: 'mode', outcome: current() ? 'accepted' : 'unknown', confirmed: false }];
		});
		const oldId = uuid();
		const older = service.request(controller, { requestId: oldId, expectedRevision: 1, mode: 'heat' });
		await began;
		const newer = await service.request(controller, { requestId: uuid(), expectedRevision: 2, mode: 'off' });
		expect(oldCurrent()).toBe(false);
		release();
		await older;
		expect((await service.get(controller))?.requested).toEqual({ mode: 'off' });
		expect((await service.get(controller))?.latest_request?.id).toBe(newer?.latest_request?.id);
		expect(
			(await database.manager.findOneByOrFail(NativeThermostatRequestEntity, { id: oldId })).operations[0].outcome,
		).toBe('unknown');
	});

	it('a concurrent duplicate joins its original dispatch and never issues another operation', async () => {
		let entered!: () => void, finish!: () => void;
		const began = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		dispatch.mockImplementationOnce(async () => {
			entered();
			await gate;
			return [{ operation: 'mode', outcome: 'accepted', confirmed: false }];
		});
		const dto = { requestId: uuid(), expectedRevision: 1, mode: 'heat' as const };
		const original = service.request(controller, dto);
		await began;
		let duplicateFinished = false;
		const duplicate = service.request(controller, dto).then((value) => {
			duplicateFinished = true;
			return value;
		});
		await Promise.resolve();
		expect(duplicateFinished).toBe(false);
		finish();
		const [a, b] = await Promise.all([original, duplicate]);
		expect(a?.latest_request).toEqual(b?.latest_request);
		expect(b?.latest_request?.state).toBe('settled');
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('does not publish requested settings or observations into properties moved away from their original controller', async () => {
		await service.onModuleDestroy();
		const foreign = uuid();
		await database.manager.insert(DeviceEntity, {
			id: foreign,
			name: 'Other owner',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
		});
		const channel = await database.manager.save(VirtualChannelEntity, {
			id: uuid(),
			device: { id: controller },
			name: 'Original branch',
			category: ChannelCategory.HEATER,
		});
		const target = await database.manager.save(VirtualChannelPropertyEntity, {
			id: uuid(),
			channel,
			name: 'Target',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			valueOrigin: VirtualValueOrigin.LOCAL,
			sourcePropertyId: null,
			permissions: [PermissionType.READ_WRITE],
		});
		const activity = await database.manager.save(VirtualChannelPropertyEntity, {
			id: uuid(),
			channel,
			name: 'Activity',
			category: PropertyCategory.STATUS,
			dataType: DataTypeType.BOOL,
			valueOrigin: VirtualValueOrigin.LOCAL,
			sourcePropertyId: null,
			permissions: [PermissionType.READ_ONLY],
		});
		await database.manager.update(
			NativeThermostatEntity,
			{ controllerId: controller },
			{
				propertyIds: { heating_setpoint: target.id, heating_activity: activity.id },
				requested: { heatingSetpoint: 21 },
			},
		);
		await database.manager.update(VirtualChannelEntity, { id: channel.id }, { device: { id: foreign } });
		unit = {
			...unit,
			observe: () => ({
				available: true,
				temperature: null,
				mode: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
				activity: 'heating',
				observedAt: new Date().toISOString(),
				reasons: [],
				isCurrent: () => true,
			}),
		};
		await start();
		expect(valueWriter.write).not.toHaveBeenCalled();
		expect(valueWriter.publishDerived).not.toHaveBeenCalled();
		expect(dispatch).not.toHaveBeenCalled();
	});

	it.each([false, true])(
		'refuses conflicting enable/mode aliases regardless of order (reverse=%s)',
		async (reverse) => {
			const owner = await database.manager.findOneByOrFail(DeviceEntity, { id: controller });
			await database.manager.update(
				NativeThermostatEntity,
				{ controllerId: controller },
				{ propertyIds: { mode: 'mode', heating_enabled: 'enabled' } },
			);
			const commands: IDevicePropertyData[] = [
				{
					device: owner,
					channel: {} as ChannelEntity,
					property: { id: 'enabled' } as ChannelPropertyEntity,
					value: true,
				},
				{
					device: owner,
					channel: {} as ChannelEntity,
					property: { id: 'mode' } as ChannelPropertyEntity,
					value: 'off',
				},
			];
			expect(await service.command(reverse ? commands.reverse() : commands)).toBe(false);
			expect(dispatch).not.toHaveBeenCalled();
		},
	);

	it.each(['heating', 'cooling', 'idle', null] as const)(
		'publishes schema-typed actual branch activity %p without using requested mode',
		async (activity) => {
			await service.onModuleDestroy();
			const ids: Record<string, string> = {};
			for (const [key, category] of [
				['heating_activity', ChannelCategory.HEATER],
				['cooling_activity', ChannelCategory.COOLER],
			] as const) {
				const channel = await database.manager.save(VirtualChannelEntity, {
					id: uuid(),
					device: { id: controller },
					name: key,
					category,
				});
				const property = await database.manager.save(VirtualChannelPropertyEntity, {
					id: uuid(),
					channel,
					name: key,
					category: PropertyCategory.STATUS,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_ONLY],
					valueOrigin: VirtualValueOrigin.LOCAL,
					sourcePropertyId: null,
				});
				ids[key] = property.id;
			}
			await database.manager.update(NativeThermostatEntity, { controllerId: controller }, { propertyIds: ids });
			unit = {
				...unit,
				observe: () => ({
					available: true,
					temperature: null,
					mode: null,
					heatingSetpoint: null,
					coolingSetpoint: null,
					activity,
					observedAt: new Date().toISOString(),
					reasons: [],
					isCurrent: () => true,
				}),
			};
			await start();
			if (activity === null) expect(valueWriter.publishDerived).not.toHaveBeenCalled();
			else
				for (const [key, active] of [
					['heating_activity', activity === 'heating'],
					['cooling_activity', activity === 'cooling'],
				] as const) {
					const calls = valueWriter.publishDerived.mock.calls as [VirtualChannelPropertyEntity, unknown, unknown][];
					const call = calls.find(([property]) => property.id === ids[key]);
					expect(call?.[0].dataType).toBe(DataTypeType.BOOL);
					expect(call?.[2]).toBe(active);
				}
			expect((await service.get(controller))?.requested).toEqual({});
			expect(dispatch).not.toHaveBeenCalled();
		},
	);

	it.each([false, true])(
		'revalidates ordinary property contracts atomically and refuses foreign metadata (moved=%s)',
		async (moved) => {
			await service.onModuleDestroy();
			const fields = [
				['mode', ChannelCategory.THERMOSTAT, PropertyCategory.MODE, DataTypeType.ENUM, ['off', 'heat', 'cool']],
				['heating_setpoint', ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, DataTypeType.FLOAT, [5, 30]],
				['cooling_setpoint', ChannelCategory.COOLER, PropertyCategory.TEMPERATURE, DataTypeType.FLOAT, [5, 35]],
			] as const;
			const ids: Record<string, string> = {};
			let heatingChannel = '';
			for (const [key, category, propertyCategory, dataType] of fields) {
				const channel = await database.manager.save(VirtualChannelEntity, {
					id: uuid(),
					device: { id: controller },
					name: key,
					category,
				});
				if (key === 'heating_setpoint') heatingChannel = channel.id;
				const property = await database.manager.save(VirtualChannelPropertyEntity, {
					id: uuid(),
					channel,
					name: key,
					category: propertyCategory,
					dataType,
					permissions: [PermissionType.READ_WRITE],
					format: key === 'mode' ? ['off', 'heat', 'cool'] : key === 'heating_setpoint' ? [5, 30] : [5, 35],
					step: key === 'mode' ? null : 0.5,
					valueOrigin: VirtualValueOrigin.LOCAL,
					sourcePropertyId: null,
				});
				ids[key] = property.id;
			}
			await database.manager.update(NativeThermostatEntity, { controllerId: controller }, { propertyIds: ids });
			unit = {
				...unit,
				capabilities: {
					modes: ['off', 'heat', 'cool'],
					heating: { minimum: 5, maximum: 30, step: 0.5 },
					cooling: { minimum: 5, maximum: 35, step: 0.5 },
					supportsCompound: true,
				},
			};
			await start();
			jest.spyOn(unit, 'isCurrent').mockReturnValue(false);
			unit = {
				...unit,
				isCurrent: () => true,
				fingerprint: 'v2',
				capabilities: {
					modes: ['off', 'heat', 'cool', 'auto'],
					heating: { minimum: 10, maximum: 28, step: 0.25 },
					cooling: { minimum: 15, maximum: 35, step: 0.5 },
					supportsCompound: true,
				},
			};
			if (moved) {
				const foreign = uuid();
				await database.manager.insert(DeviceEntity, {
					id: foreign,
					name: 'Foreign controller',
					category: DeviceCategory.THERMOSTAT,
					enabled: true,
				});
				await database.manager.update(VirtualChannelEntity, { id: heatingChannel }, { device: { id: foreign } });
				await expect(service.update(controller, { sourceDevice: source, expectedRevision: 1 })).rejects.toThrow(
					'Native controller property changed',
				);
				expect(
					(await database.manager.findOneByOrFail(NativeThermostatEntity, { controllerId: controller })).fingerprint,
				).toBe('v1');
			} else {
				await expect(service.update(controller, { sourceDevice: source, expectedRevision: 1 })).resolves.toMatchObject({
					revision: 2,
				});
			}
			const mode = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: ids.mode });
			const target = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: ids.heating_setpoint });
			expect(mode.format).toEqual(moved ? ['off', 'heat', 'cool'] : ['off', 'heat', 'cool', 'auto']);
			expect(target.format).toEqual(moved ? [5, 30] : [10, 28]);
			expect(target.step).toBe(moved ? 0.5 : 0.25);
			expect(await database.manager.count(NativeThermostatRequestEntity)).toBe(0);
			expect(dispatch).not.toHaveBeenCalled();
		},
	);

	it('does not publish a retained observation whose original sample expires during property lookup', async () => {
		await service.onModuleDestroy();
		const channel = await database.manager.save(VirtualChannelEntity, {
			id: uuid(),
			device: { id: controller },
			name: 'ambient',
			category: ChannelCategory.TEMPERATURE,
		});
		const property = await database.manager.save(VirtualChannelPropertyEntity, {
			id: uuid(),
			channel,
			name: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.LOCAL,
			sourcePropertyId: null,
		});
		await database.manager.update(
			NativeThermostatEntity,
			{ controllerId: controller },
			{ propertyIds: { temperature: property.id } },
		);
		let sampleCurrent = true;
		unit = {
			...unit,
			observe: () => ({
				available: true,
				temperature: 20,
				mode: 'heat',
				heatingSetpoint: 21,
				coolingSetpoint: null,
				activity: 'heating',
				observedAt: new Date().toISOString(),
				reasons: [],
				isCurrent: () => sampleCurrent,
			}),
		};
		const original = database.manager.findOneBy.bind(database.manager) as EntityManager['findOneBy'];
		const lookup = jest.spyOn(database.manager, 'findOneBy').mockImplementation(async (target, where) => {
			const row = await original(target, where);
			if (target === VirtualChannelPropertyEntity) sampleCurrent = false;
			return row;
		});
		try {
			await start();
			expect(valueWriter.publishDerived).not.toHaveBeenCalled();
		} finally {
			lookup.mockRestore();
		}
	});

	it('catalog mutation revokes an issued callback synchronously', async () => {
		await service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
		expect(guardedDispatch()).toBe(true);
		service.onCatalogChanged({ id: controller });
		expect(guardedDispatch()).toBe(false);
	});

	it('retains pending restart outcome as interrupted and issues no replay', async () => {
		await service.onModuleDestroy();
		const id = uuid();
		await database.manager.insert(NativeThermostatRequestEntity, {
			id,
			controllerId: controller,
			revision: 2,
			request: { mode: 'heat' },
			operations: [],
			state: 'pending',
			createdAt: new Date(),
		});
		await database.manager.update(
			NativeThermostatEntity,
			{ controllerId: controller },
			{ revision: 2, latestRequestId: id, requested: { mode: 'heat' } },
		);
		await start();
		expect((await service.get(controller))?.latest_request?.state).toBe('interrupted');
		expect(dispatch).not.toHaveBeenCalled();
	});
	it.each(['releasing', 'released'] as const)(
		'does not read live source observations from a %s binding',
		async (bindingState) => {
			await service.onModuleDestroy();
			await database.manager.update(
				NativeThermostatEntity,
				{ controllerId: controller },
				{ bindingState, requested: { mode: 'heat' } },
			);
			const observe = jest.fn(
				(): ReturnType<NativeClimateUnit['observe']> => ({
					available: true,
					temperature: 23,
					mode: 'heat',
					heatingSetpoint: 24,
					coolingSetpoint: null,
					activity: 'heating' as const,
					observedAt: new Date().toISOString(),
					reasons: [],
					isCurrent: () => true,
				}),
			);
			unit = { ...unit, observe };
			await start();
			observe.mockClear();
			const result = await service.get(controller);
			expect(result).toMatchObject({
				binding_state: bindingState,
				requested: { mode: 'heat' },
				capabilities: null,
				observed: { available: false, temperature: null, activity: null },
			});
			expect(observe).not.toHaveBeenCalled();
		},
	);

	it.each([false, true])(
		'isolates failed local mirrors from later feedback and other controllers (reject=%s)',
		async (reject) => {
			await service.onModuleDestroy();
			const other = uuid(),
				otherSource = uuid();
			await database.manager.insert(DeviceEntity, [
				{ id: other, name: 'Other native owner', category: DeviceCategory.THERMOSTAT, enabled: true },
				{ id: otherSource, name: 'Other native source', category: DeviceCategory.THERMOSTAT, enabled: true },
			]);
			const property = async (owner: string, category: ChannelCategory, permissions: PermissionType[]) => {
				const channel = await database.manager.save(VirtualChannelEntity, {
					id: uuid(),
					device: { id: owner },
					category,
					name: category,
				});
				return database.manager.save(VirtualChannelPropertyEntity, {
					id: uuid(),
					channel,
					name: 'Temperature',
					category: PropertyCategory.TEMPERATURE,
					dataType: DataTypeType.FLOAT,
					permissions,
					valueOrigin: VirtualValueOrigin.LOCAL,
					sourcePropertyId: null,
				});
			};
			const target = await property(controller, ChannelCategory.HEATER, [PermissionType.READ_WRITE]);
			const ambient = await property(controller, ChannelCategory.TEMPERATURE, [PermissionType.READ_ONLY]);
			const otherAmbient = await property(other, ChannelCategory.TEMPERATURE, [PermissionType.READ_ONLY]);
			await database.manager.update(
				NativeThermostatEntity,
				{ controllerId: controller },
				{ propertyIds: { heating_setpoint: target.id, temperature: ambient.id }, requested: { heatingSetpoint: 20 } },
			);
			unit = {
				...unit,
				observe: () => ({
					available: true,
					temperature: 20,
					mode: null,
					heatingSetpoint: null,
					coolingSetpoint: null,
					activity: null,
					observedAt: new Date().toISOString(),
					reasons: [],
					isCurrent: () => true,
				}),
			};
			extraUnits.set(otherSource, {
				...unit,
				deviceId: otherSource,
				physicalIdentity: 'z2m:other',
				ownedPropertyIds: ['other-mode'],
			});
			await database.manager.insert(NativeThermostatEntity, {
				controllerId: other,
				sourceDeviceId: otherSource,
				physicalIdentity: 'z2m:other',
				fingerprint: 'v1',
				provider: unit.provider,
				revision: 1,
				requested: {},
				propertyIds: { temperature: otherAmbient.id },
				ownedPropertyIds: ['other-mode'],
				latestRequestId: null,
			});
			failingMirror = { id: target.id, reject };
			await start();
			const published = (valueWriter.publishDerived.mock.calls as [VirtualChannelPropertyEntity][]).map(
				([entry]) => entry.id,
			);
			expect(published).toEqual(expect.arrayContaining([ambient.id, otherAmbient.id]));
			valueWriter.write.mockResolvedValue(true);
			await service['refresh']();
			expect(valueWriter.write).toHaveBeenCalledTimes(2);
			expect(dispatch).not.toHaveBeenCalled();
		},
	);

	it.each([
		['cool', 'heating_enabled', 'cool', false],
		['heat', 'cooling_enabled', 'heat', false],
		['auto', 'heating_enabled', 'cool', true],
		['auto', 'cooling_enabled', 'heat', true],
		['heat', 'heating_enabled', 'off', true],
		['cool', 'cooling_enabled', 'off', true],
	] as const)('disables only the selected branch from %s using %s', async (mode, key, expected, sent) => {
		const propertyId = uuid();
		await database.manager.update(
			NativeThermostatEntity,
			{ controllerId: controller },
			{ propertyIds: { [key]: propertyId }, requested: { mode } },
		);
		unit = {
			...unit,
			capabilities: {
				...unit.capabilities,
				modes: ['off', 'heat', 'cool', 'auto'],
				cooling: { minimum: 5, maximum: 30, step: 0.5 },
			},
		};
		expect(await service.commandSettings([{ deviceId: controller, propertyId, value: false }])).toBe(true);
		expect((await service.get(controller))?.requested.mode).toBe(expected);
		expect(dispatch).toHaveBeenCalledTimes(sent ? 1 : 0);
	});

	it('refuses unsupported branch separation on an auto-only unit without stopping its other branch', async () => {
		const propertyId = uuid();
		await database.manager.update(
			NativeThermostatEntity,
			{ controllerId: controller },
			{ propertyIds: { heating_enabled: propertyId }, requested: { mode: 'auto' } },
		);
		prepare.mockImplementation(() => null);
		expect(await service.commandSettings([{ deviceId: controller, propertyId, value: false }])).toBe(false);
		expect((await service.get(controller))?.requested.mode).toBe('auto');
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('a stale release does not revoke an already admitted request before its original publication', async () => {
		let enter!: () => void, finish!: () => void;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		dispatch.mockImplementationOnce(async (current: () => boolean) => {
			enter();
			await gate;
			return [{ operation: 'mode', outcome: current() ? 'accepted' : 'refused', confirmed: false }];
		});
		const attempt = service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
		await entered;
		try {
			await expect(service.release(controller, { expectedRevision: 1 })).rejects.toThrow('revision changed');
		} finally {
			finish();
		}
		const result = await attempt;
		expect(result?.binding_state).toBe('bound');
		expect(result?.latest_request?.operations[0].outcome).toBe('accepted');
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it.each([false, true])(
		'a rolled-back release preserves original admission unless the catalog invalidates it (%s)',
		async (catalogChanged) => {
			let enter!: () => void, finish!: () => void;
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			const gate = new Promise<void>((resolve) => {
				finish = resolve;
			});
			dispatch.mockImplementationOnce(async (current: () => boolean) => {
				enter();
				await gate;
				return [{ operation: 'mode', outcome: current() ? 'accepted' : 'refused', confirmed: false }];
			});
			const attempt = service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
			await entered;
			structuralRollback = () => {
				if (catalogChanged) service.onCatalogChanged({ id: source });
			};
			try {
				await expect(service.release(controller, { expectedRevision: 2 })).rejects.toThrow('graph write rolled back');
				expect(
					await database.manager.findOneByOrFail(NativeThermostatEntity, { controllerId: controller }),
				).toMatchObject({ bindingState: 'bound', revision: 2 });
			} finally {
				finish();
			}
			const result = await attempt;
			expect(result?.latest_request?.operations[0].outcome).toBe(catalogChanged ? 'refused' : 'accepted');
			expect(dispatch).toHaveBeenCalledTimes(1);
		},
	);

	it('a stale release does not discard a request already waiting for structural admission', async () => {
		let enter!: () => void, finish!: () => void;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const holder = lock.runExclusive(async () => {
			enter();
			await gate;
		});
		await entered;
		const attempt = service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' }).then(
			(value) => ({ value }),
			(cause: unknown) => ({ cause }),
		);
		const rejected = expect(service.release(controller, { expectedRevision: 0 })).rejects.toThrow('revision changed');
		finish();
		await holder;
		await rejected;
		const outcome = await attempt;
		expect(outcome).toHaveProperty('value.latest_request.operations.0.outcome', 'accepted');
		expect((await service.get(controller))?.binding_state).toBe('bound');
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it.each([
		['decision', true],
		['decision', false],
		['structure', true],
		['structure', false],
	] as const)(
		'keeps a request queued on %s admission until release settles (rollback=%s)',
		async (ordering, rollback) => {
			let enter!: () => void, unlock!: () => void;
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			const gate = new Promise<void>((resolve) => {
				unlock = resolve;
			});
			const holder = lock.runExclusive(async () => {
				enter();
				await gate;
			});
			await entered;
			if (rollback) structuralRollback = () => {};
			const request = () =>
				service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' }).then(
					(value) => ({ value }),
					(cause: unknown) => ({ cause }),
				);
			let attempt: ReturnType<typeof request>;
			let release: Promise<unknown>;
			if (ordering === 'decision') {
				release = service.release(controller, { expectedRevision: 1 });
				attempt = request();
			} else {
				attempt = request();
				release = service.release(controller, { expectedRevision: 1 });
			}
			const released = release.then(
				(value) => ({ value }),
				(cause: unknown) => ({ cause }),
			);
			unlock();
			await holder;
			const outcome = await released;
			const result = await attempt;
			if (rollback) {
				expect(outcome).toHaveProperty('cause.message', 'graph write rolled back');
				expect(result).toHaveProperty('value.latest_request.operations.0.outcome', 'accepted');
				expect(dispatch).toHaveBeenCalledTimes(1);
			} else {
				expect(outcome).toHaveProperty('value.binding_state', 'released');
				expect(result).toHaveProperty('cause.message', 'Native binding is not bound.');
				expect(dispatch).not.toHaveBeenCalled();
				expect(await database.manager.count(NativeThermostatRequestEntity)).toBe(0);
			}
		},
	);

	it.each(['stale', 'released', 'preflight', 'rollback'] as const)(
		'release %s completion cannot wait on its own provisional request admission',
		async (boundary) => {
			await database.manager.update(
				NativeThermostatEntity,
				{ controllerId: controller },
				{
					revision: 2,
					bindingState: boundary === 'released' ? 'released' : 'bound',
				},
			);
			let request!: Promise<unknown>;
			let settledBeforeRescue = false;
			let rescue: ReturnType<typeof setTimeout> | undefined;
			structuralPreflightFailure = boundary === 'preflight';
			if (boundary === 'rollback') structuralRollback = () => {};
			// Model the awaited publication/rollback completion boundary after the original writer.
			// The rescue only lets a broken implementation unwind so teardown joins all work.
			structuralCompletion = async () => {
				request = service.request(controller, { requestId: uuid(), expectedRevision: 2, mode: 'heat' }).then(
					(value) => ({ value }),
					(cause: unknown) => ({ cause }),
				);
				settledBeforeRescue = await Promise.race([
					request.then(() => true),
					new Promise<false>((resolve) => {
						rescue = setTimeout(() => resolve(false), 2000);
					}),
				]);
				clearTimeout(rescue);
			};
			const release = service.release(controller, { expectedRevision: boundary === 'stale' ? 1 : 2 });
			if (boundary === 'released') expect((await release)?.binding_state).toBe('released');
			else
				await expect(release).rejects.toThrow(
					boundary === 'stale'
						? 'revision changed'
						: boundary === 'rollback'
							? 'graph write rolled back'
							: 'preflight refused',
				);
			const result = await request;
			expect(settledBeforeRescue).toBe(true);
			if (boundary === 'stale') expect(result).toHaveProperty('value.latest_request.operations.0.outcome', 'accepted');
			else {
				expect(result).toHaveProperty('cause');
				expect(dispatch).not.toHaveBeenCalled();
				expect(await database.manager.count(NativeThermostatRequestEntity)).toBe(0);
			}
		},
	);

	it('release entered before queued request admission prevents its first transport', async () => {
		let enter!: () => void, unlock!: () => void;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			unlock = resolve;
		});
		const prior = lock.runExclusive(async () => {
			enter();
			await gate;
		});
		await entered;
		const attempt = service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
		const rejected = expect(attempt).rejects.toThrow('not bound');
		const releasing = service.release(controller, { expectedRevision: 1 });
		unlock();
		await prior;
		await rejected;
		expect((await releasing)?.binding_state).toBe('released');
		expect(dispatch).not.toHaveBeenCalled();
		expect(await database.manager.count(NativeThermostatRequestEntity)).toBe(0);
	});

	it('release drains the original issued attempt outside locks and does not send OFF', async () => {
		let started!: () => void, finish!: () => void;
		let originalCurrent!: () => boolean;
		const began = new Promise<void>((resolve) => {
			started = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		dispatch.mockImplementationOnce(async (current: () => boolean) => {
			originalCurrent = current;
			started();
			await gate;
			return [{ operation: 'mode', outcome: 'unknown', confirmed: false }];
		});
		const attempt = service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
		await began;
		let settled = false;
		const releasing = service.release(controller, { expectedRevision: 2 }).then((value) => {
			settled = true;
			return value;
		});
		const snapshot = await service.get(controller);
		expect(snapshot?.binding_state).toBe('releasing');
		// Only a revision-validated release owns revocation; it still fences before original work settles.
		expect(originalCurrent()).toBe(false);
		expect(settled).toBe(false);
		await expect(
			service.request(controller, { requestId: uuid(), expectedRevision: 3, mode: 'off' }),
		).rejects.toThrow();
		finish();
		await attempt;
		expect((await releasing)?.binding_state).toBe('released');
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(prepare).toHaveBeenCalledWith({ mode: 'heat' });
	});

	it('an administrator can release a deleted owner while retaining identity and request history', async () => {
		await service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
		await database.manager.delete(DeviceEntity, { id: controller });
		service.onCatalogChanged({ id: controller });
		const released = await service.release(controller, { expectedRevision: 2 });
		expect(released?.binding_state).toBe('released');
		expect(released?.controller).toBe(controller);
		expect(released?.latest_request?.operations[0].confirmed).toBe(false);
		expect(await database.manager.count(NativeThermostatRequestEntity)).toBe(1);
		await database.manager.insert(NativeThermostatEntity, {
			controllerId: uuid(),
			sourceDeviceId: source,
			physicalIdentity: unit.physicalIdentity,
			fingerprint: unit.fingerprint,
			provider: unit.provider,
			bindingState: 'bound',
			revision: 1,
			requested: {},
			propertyIds: {},
			ownedPropertyIds: [],
			latestRequestId: null,
		});
		await expect(
			service.update(controller, { sourceDevice: source, expectedRevision: released?.revision ?? 0 }),
		).rejects.toThrow('not bound');
	});

	it('shutdown revokes and joins original issued transport before returning', async () => {
		let started!: () => void, finish!: () => void;
		let originalCurrent!: () => boolean;
		const began = new Promise<void>((resolve) => {
			started = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		dispatch.mockImplementationOnce(async (current: () => boolean) => {
			originalCurrent = current;
			started();
			await gate;
			return [{ operation: 'mode', outcome: 'unknown', confirmed: false }];
		});
		const attempt = service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
		await began;
		let stopped = false;
		const stop = service.onModuleDestroy().then(() => {
			stopped = true;
		});
		expect(originalCurrent()).toBe(false);
		await Promise.resolve();
		expect(stopped).toBe(false);
		finish();
		await attempt;
		await stop;
		expect(stopped).toBe(true);
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('drift compares qualified observations without overwriting or replaying requested settings', async () => {
		await service.request(controller, { requestId: uuid(), expectedRevision: 1, mode: 'heat' });
		await service.request(controller, { requestId: uuid(), expectedRevision: 2, heatingSetpoint: 22 });
		const observation = {
			available: true,
			temperature: 19,
			mode: 'off' as const,
			heatingSetpoint: 20,
			coolingSetpoint: null,
			activity: 'idle' as const,
			observedAt: new Date().toISOString(),
			reasons: [],
		};
		unit = { ...unit, observe: () => observation };
		service.onCatalogChanged({ id: source });
		expect((await service.get(controller))?.drift).toEqual(['mode', 'heating_setpoint']);
		expect((await service.get(controller))?.requested).toEqual({ mode: 'heat', heatingSetpoint: 22 });
		observation.available = false;
		expect((await service.get(controller))?.drift).toEqual([]);
		expect(dispatch).toHaveBeenCalledTimes(2);
	});

	it('ordinary alias commands require guarded dispatch and canonical admission rejects a newly adopted property id', async () => {
		const sourceDevice = await database.manager.findOneByOrFail(DeviceEntity, { id: source });
		const update: IDevicePropertyData = {
			device: sourceDevice,
			channel: Object.assign(new ChannelEntity(), { id: uuid(), category: ChannelCategory.THERMOSTAT }),
			property: Object.assign(new ChannelPropertyEntity(), { id: 'new-mode-alias', category: PropertyCategory.MODE }),
			value: 'heat',
		};
		expect(registry.requiresGuardedDispatch(update)).toBe(true);
		await expect(registry.assertAllowed(update)).rejects.toThrow('reserved');
		const propertyIds: Record<string, string> = {};
		for (const [key, category, propertyCategory, dataType] of [
			['mode', ChannelCategory.THERMOSTAT, PropertyCategory.MODE, DataTypeType.ENUM],
			['heating_setpoint', ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, DataTypeType.FLOAT],
		] as const) {
			const channel = await database.manager.save(VirtualChannelEntity, {
				id: uuid(),
				device: { id: controller },
				name: key,
				category,
			});
			const property = await database.manager.save(VirtualChannelPropertyEntity, {
				id: uuid(),
				channel,
				name: key,
				category: propertyCategory,
				dataType,
				valueOrigin: VirtualValueOrigin.LOCAL,
				sourcePropertyId: null,
				permissions: [PermissionType.READ_WRITE],
			});
			propertyIds[key] = property.id;
		}
		await database.manager.update(NativeThermostatEntity, { controllerId: controller }, { propertyIds });
		const oldAdmission = registry.capture();
		expect(oldAdmission.isCurrent()).toBe(true);
		await service.update(controller, { sourceDevice: source, expectedRevision: 1 });
		expect(oldAdmission.isCurrent()).toBe(false);
	});
});
