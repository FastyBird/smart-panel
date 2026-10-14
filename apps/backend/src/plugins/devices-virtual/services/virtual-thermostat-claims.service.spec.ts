import { BeforeQueryEvent, DataSource, QueryRunner } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DataTypeType, EventType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};
const settle = async () => {
	for (let i = 0; i < 30; i++) await Promise.resolve();
};

describe('thermostat claim reconciliation recovery', () => {
	let service: VirtualThermostatClaimsService;
	let lock: DeviceStructureLockService;
	let events: EventEmitter2;
	let find: jest.Mock;
	let config: ConfigService;
	const output: IDevicePropertyData = {
		device: Object.assign(new ShellyNgDeviceEntity(), { id: 'relay', canonicalMac: 'AABBCCDDEEFF' }),
		channel: Object.assign(new ChannelEntity(), { id: 'switch', identifier: 'switch:0' }),
		property: Object.assign(new ChannelPropertyEntity(), {
			id: 'output',
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		}),
		value: true,
	};
	const unrelated: IDevicePropertyData = {
		...output,
		device: new DeviceEntity(),
		property: Object.assign(new ChannelPropertyEntity(), { id: 'unrelated' }),
	};
	const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
		id: 'claim',
		controllerId: 'owner',
		sourcePropertyIdentity: 'output',
		physicalIdentity: 'shelly-ng:AABBCCDDEEFF:switch:0:output',
	});
	beforeEach(async () => {
		jest.useFakeTimers();
		find = jest.fn().mockResolvedValue([]);
		lock = new DeviceStructureLockService();
		events = new EventEmitter2();
		config = new ConfigService({ FB_CLI: 'off' });
		service = new VirtualThermostatClaimsService(
			{ manager: { find } } as unknown as DataSource,
			lock,
			{} as VirtualDependencyGraphService,
			new PropertyCommandAdmissionRegistryService(),
			events,
			config,
		);
		await service.onApplicationBootstrap();
	});
	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
	});

	it('exempts only the armed release runner, exact SQL and parameters from catalog revocation', () => {
		const dataSource = { subscribers: [] } as unknown as DataSource;
		const subscriber = new VirtualThermostatOwnershipSubscriber(dataSource, service);
		(subscriber as unknown as { installed: boolean }).installed = true;
		const runner = {} as QueryRunner;
		const query = 'UPDATE "devices_virtual_thermostat_actuator_claims" SET "state" = ? WHERE "id" = ?';
		const parameters = ['released', 'claim'];
		const writes = (
			service as unknown as { releaseWrites: WeakMap<QueryRunner, { query: string; parameters: unknown[] }> }
		).releaseWrites;
		writes.set(runner, { query, parameters });
		const invalidate = jest.spyOn(service, 'invalidate');
		const before = (queryRunner: QueryRunner, sql = query, values = parameters) =>
			subscriber.beforeQuery({
				queryRunner,
				query: sql,
				parameters: values,
			} as BeforeQueryEvent<unknown>);
		before(runner);
		expect(invalidate).not.toHaveBeenCalled();
		before({} as QueryRunner);
		before(runner, query, ['released', 'other-claim']);
		before(runner, 'UPDATE "devices_virtual_thermostat_configs" SET "revision" = 3');
		expect(invalidate).toHaveBeenCalledTimes(3);
		writes.delete(runner);
		before(runner);
		expect(invalidate).toHaveBeenCalledTimes(4);
	});
	it('recovers while idle, keeps guarded commands closed and leaves unrelated outputs available', async () => {
		const captured = service.capture();
		find.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValue([claim]);
		service.invalidate();
		await expect(service.refresh()).rejects.toThrow('database unavailable');
		expect(() => service.assertAllowed(output)).toThrow('reconciling');
		await expect(service.assertAllowed(unrelated)).resolves.toBeUndefined();
		expect(captured.isCurrent(output)).toBe(false);
		await jest.advanceTimersByTimeAsync(999);
		expect(find).toHaveBeenCalledTimes(2);
		await jest.advanceTimersByTimeAsync(1);
		expect(find).toHaveBeenCalledTimes(3);
		expect(() => service.assertAllowed(output)).toThrow('reserved');
		expect(captured.isCurrent(output)).toBe(false);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('coalesces failures into one exponentially delayed retry, capped without abandoning recovery', async () => {
		find.mockRejectedValue(new Error('offline'));
		service.invalidate();
		await expect(service.refresh()).rejects.toThrow();
		for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
			expect(jest.getTimerCount()).toBe(1);
			const calls = find.mock.calls.length;
			await jest.advanceTimersByTimeAsync(delay - 1);
			expect(find).toHaveBeenCalledTimes(calls);
			await jest.advanceTimersByTimeAsync(1);
			expect(find).toHaveBeenCalledTimes(calls + 1);
			expect(() => service.assertAllowed(output)).toThrow('reconciling');
		}
		find.mockResolvedValue([]);
		await jest.advanceTimersByTimeAsync(30000);
		await expect(service.assertAllowed(output)).resolves.toBeUndefined();
		expect(jest.getTimerCount()).toBe(0);
	});

	it('shares one in-flight read and retries stale captures instead of publishing them', async () => {
		const read = deferred<VirtualThermostatActuatorClaimEntity[]>();
		find.mockReturnValueOnce(read.promise).mockResolvedValue([claim]);
		service.invalidate();
		const first = service.refresh();
		const second = service.refresh();
		await settle();
		expect(find).toHaveBeenCalledTimes(2);
		service.invalidate();
		read.resolve([]);
		await Promise.all([first, second]);
		expect(() => service.assertAllowed(output)).toThrow('reconciling');
		expect(jest.getTimerCount()).toBe(1);
		await jest.advanceTimersByTimeAsync(1000);
		expect(() => service.assertAllowed(output)).toThrow('reserved');
	});

	it('cancels an obsolete pending retry after a direct fresh refresh', async () => {
		find.mockRejectedValueOnce(new Error('offline'));
		await expect(service.refresh()).rejects.toThrow();
		await service.refresh();
		expect(jest.getTimerCount()).toBe(0);
		await jest.advanceTimersByTimeAsync(30000);
		expect(find).toHaveBeenCalledTimes(3);
	});
	it('cancels retries after fresh membership without reopening a held recovery fence', async () => {
		const captured = service.capture();
		const release = service.holdRecoveryFence();
		find.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([claim]);
		await expect(service.refresh()).rejects.toThrow('offline');
		expect(jest.getTimerCount()).toBe(1);
		await jest.advanceTimersByTimeAsync(1000);
		expect(service.capture().isCurrent()).toBe(false);
		expect(() => service.assertAllowed(output)).toThrow('reconciling');
		await expect(service.assertAllowed(unrelated)).resolves.toBeUndefined();
		expect(jest.getTimerCount()).toBe(0);
		await jest.advanceTimersByTimeAsync(30000);
		expect(find).toHaveBeenCalledTimes(3);
		release();
		await service.refresh();
		expect(service.capture().isCurrent()).toBe(true);
		expect(captured.isCurrent()).toBe(false);
		expect(() => service.assertAllowed(output)).toThrow('reserved');
	});
	it('requires every recovery fence to be released before successful refresh opens admission', async () => {
		const releaseFirst = service.holdRecoveryFence();
		const releaseSecond = service.holdRecoveryFence();
		await service.refresh();
		expect(service.capture().isCurrent()).toBe(false);
		releaseFirst();
		releaseFirst();
		await service.refresh();
		expect(service.capture().isCurrent()).toBe(false);
		expect(jest.getTimerCount()).toBe(0);
		releaseSecond();
		await service.refresh();
		expect(service.capture().isCurrent()).toBe(true);
	});

	it('waits for committed structure and permits nested writer refresh without a reader deadlock', async () => {
		const release = deferred<void>();
		const writerEntered = deferred<void>();
		const writer = lock.runExclusive(async () => {
			writerEntered.resolve();
			await release.promise;
			find.mockResolvedValue([claim]);
			await service.refresh();
		});
		await writerEntered.promise;
		service.invalidate();
		const reader = service.refresh();
		await settle();
		expect(find).toHaveBeenCalledTimes(1);
		release.resolve();
		await Promise.all([writer, reader]);
		expect(() => service.assertAllowed(output)).toThrow('reserved');
	});

	it('keeps retry reads outside an exclusive writer even when its failure scheduled the timer', async () => {
		const release = deferred<void>();
		const writerEntered = deferred<void>();
		find.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
		const writer = lock.runExclusive(async () => {
			service.invalidate();
			await expect(service.refresh()).rejects.toThrow();
			writerEntered.resolve();
			await release.promise;
		});
		await writerEntered.promise;
		await jest.advanceTimersByTimeAsync(1000);
		expect(find).toHaveBeenCalledTimes(2);
		expect(() => service.assertAllowed(output)).toThrow('reconciling');
		release.resolve();
		await writer;
		await settle();
		expect(find).toHaveBeenCalledTimes(3);
		await expect(service.assertAllowed(output)).resolves.toBeUndefined();
	});

	it('does not run parallel reads when a retry fires during a direct refresh', async () => {
		find.mockRejectedValueOnce(new Error('offline'));
		await expect(service.refresh()).rejects.toThrow();
		const read = deferred<VirtualThermostatActuatorClaimEntity[]>();
		find.mockReturnValueOnce(read.promise);
		const refresh = service.refresh();
		await settle();
		await jest.advanceTimersByTimeAsync(1000);
		expect(find).toHaveBeenCalledTimes(3);
		read.resolve([claim]);
		await refresh;
		await settle();
		expect(() => service.assertAllowed(output)).toThrow('reserved');
		expect(jest.getTimerCount()).toBe(0);
	});

	it('does not publish or reschedule a late failure after shutdown', async () => {
		const read = deferred<VirtualThermostatActuatorClaimEntity[]>();
		find.mockReturnValueOnce(read.promise);
		const refresh = service.refresh();
		await settle();
		service.onModuleDestroy();
		read.reject(new Error('offline'));
		await expect(refresh).rejects.toThrow();
		expect(jest.getTimerCount()).toBe(0);
		events.emit(EventType.DEVICE_UPDATED);
		await service.refresh();
		expect(find).toHaveBeenCalledTimes(2);
	});

	it('retries failed structure events with the same coalesced policy', async () => {
		find.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([claim]);
		events.emit(EventType.DEVICE_UPDATED);
		events.emit(EventType.CHANNEL_PROPERTY_UPDATED);
		await settle();
		expect(jest.getTimerCount()).toBe(1);
		await jest.advanceTimersByTimeAsync(1000);
		expect(() => service.assertAllowed(output)).toThrow('reserved');
	});

	it('does not retry CLI generation failures', async () => {
		jest.spyOn(config, 'get').mockReturnValue('on');
		find.mockRejectedValue(new Error('offline'));
		await expect(service.refresh()).rejects.toThrow();
		expect(jest.getTimerCount()).toBe(0);
	});

	it('disposes pending timers and prevents late in-flight success from reopening admission', async () => {
		find.mockRejectedValueOnce(new Error('offline'));
		await expect(service.refresh()).rejects.toThrow();
		const read = deferred<VirtualThermostatActuatorClaimEntity[]>();
		find.mockReturnValueOnce(read.promise);
		const refresh = service.refresh();
		await settle();
		service.onModuleDestroy();
		read.resolve([]);
		await refresh;
		await jest.advanceTimersByTimeAsync(30000);
		expect(jest.getTimerCount()).toBe(0);
		expect(find).toHaveBeenCalledTimes(3);
		expect(() => service.assertAllowed(output)).toThrow('reconciling');
	});
});
