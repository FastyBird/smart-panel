import { Repository } from 'typeorm';

import { ModbusFraming } from '../devices-modbus.constants';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import { EndpointConnection } from '../runtime/endpoint-connection';

import { ModbusConnectionsListener, ModbusConnectionsService } from './modbus-connections.service';

const events: string[] = [];

class FakeConnection {
	start = jest.fn(() => {
		events.push(`start:${this.endpoint.port}`);
	});
	stop = jest.fn(() => {
		events.push(`stop:${this.endpoint.port}`);

		return Promise.resolve();
	});
	markOverloaded = jest.fn();
	getHealth = jest.fn(() => ({ state: 'connected' }));

	constructor(readonly endpoint: ModbusEndpointEntity) {}
}

const endpoint = (id: string, overrides: Partial<ModbusEndpointEntity> = {}): ModbusEndpointEntity =>
	Object.assign(new ModbusEndpointEntity(), {
		id,
		name: id,
		host: `10.0.0.${id.length}`,
		port: 502,
		framing: ModbusFraming.TCP,
		connectTimeoutMs: 2000,
		requestTimeoutMs: 1000,
		interRequestDelayMs: 0,
		maxInFlight: 1,
		enabled: true,
		...overrides,
	});

describe('ModbusConnectionsService', () => {
	let endpoints: ModbusEndpointEntity[];
	let created: FakeConnection[];
	let listener: { endpointStopping: jest.Mock; endpointChanged: jest.Mock };
	let service: ModbusConnectionsService;

	beforeEach(() => {
		events.length = 0;
		endpoints = [];
		created = [];
		listener = {
			endpointStopping: jest.fn(),
			endpointChanged: jest.fn(() => Promise.resolve()),
		};

		const repository = {
			find: jest.fn(() => Promise.resolve(endpoints.map((e) => Object.assign(new ModbusEndpointEntity(), e)))),
		};

		service = new ModbusConnectionsService(
			repository as unknown as Repository<ModbusEndpointEntity>,
			(entity: ModbusEndpointEntity) => {
				const connection = new FakeConnection(entity);

				created.push(connection);

				return connection as unknown as EndpointConnection;
			},
		);
	});

	it('does nothing until a listener is attached', async () => {
		endpoints = [endpoint('a')];

		await service.reconcile();

		expect(created).toHaveLength(0);
		expect(service.get('a')).toBeNull();
	});

	it('reports whether a listener is attached', async () => {
		expect(service.isAttached()).toBe(false);

		service.attach(listener as ModbusConnectionsListener);

		expect(service.isAttached()).toBe(true);

		await service.stopAll();

		expect(service.isAttached()).toBe(false);
	});

	it('starts one connection per enabled endpoint', async () => {
		endpoints = [endpoint('a'), endpoint('b', { enabled: false })];

		service.attach(listener as ModbusConnectionsListener);
		await service.reconcile();

		expect(created).toHaveLength(1);
		expect(created[0].start).toHaveBeenCalledTimes(1);
		expect(service.get('a')).toBe(created[0]);
		expect(service.get('b')).toBeNull();
		expect(service.getHealth('a')).toEqual({ state: 'connected' });
		expect(service.getHealth('b')).toBeNull();
		expect(listener.endpointChanged).toHaveBeenCalledWith('a');
	});

	it('rebuilds one connection when an endpoint changes', async () => {
		endpoints = [endpoint('a'), endpoint('b')];

		service.attach(listener as ModbusConnectionsListener);
		await service.reconcile();

		const [old, untouched] = created;

		listener.endpointStopping.mockClear();
		listener.endpointChanged.mockClear();

		endpoints[0].host = '10.10.10.10';
		await service.reconcile();

		expect(old.stop).toHaveBeenCalledTimes(1);
		expect(untouched.stop).not.toHaveBeenCalled();
		expect(created).toHaveLength(3);
		expect(created[2].endpoint.host).toBe('10.10.10.10');
		expect(created[2].start).toHaveBeenCalledTimes(1);
		expect(service.get('a')).toBe(created[2]);
		expect(listener.endpointStopping).toHaveBeenCalledTimes(1);
		expect(listener.endpointStopping).toHaveBeenCalledWith('a');
		expect(listener.endpointChanged).toHaveBeenCalledTimes(1);
		expect(listener.endpointChanged).toHaveBeenCalledWith('a');
	});

	it('reports a running connection as not current once its endpoint changed and until the reconcile', async () => {
		endpoints = [endpoint('a')];

		service.attach(listener as ModbusConnectionsListener);
		await service.reconcile();

		expect(service.isCurrent(endpoints[0])).toBe(true);
		expect(service.isCurrent(endpoint('a', { name: 'renamed' }))).toBe(true);

		const updated = endpoint('a', { host: '10.10.10.10' });

		expect(service.isCurrent(updated)).toBe(false);

		endpoints = [updated];
		await service.reconcile();

		expect(service.isCurrent(updated)).toBe(true);
		expect(service.isCurrent(endpoint('missing'))).toBe(false);
	});

	it('stops the old connection before starting the new one and tells the listener first', async () => {
		endpoints = [endpoint('a')];
		service.attach(listener as ModbusConnectionsListener);
		await service.reconcile();

		events.length = 0;
		listener.endpointStopping.mockImplementation((id: string) => events.push(`stopping:${id}`));
		listener.endpointChanged.mockImplementation((id: string) => {
			events.push(`changed:${id}`);

			return Promise.resolve();
		});

		endpoints[0].port = 1502;
		await service.reconcile();

		expect(events).toEqual(['stopping:a', 'stop:502', 'start:1502', 'changed:a']);
	});

	it('does not rebuild for a name-only change', async () => {
		endpoints = [endpoint('a')];
		service.attach(listener as ModbusConnectionsListener);
		await service.reconcile();

		endpoints[0].name = 'renamed';
		await service.reconcile();

		expect(created).toHaveLength(1);
		expect(created[0].stop).not.toHaveBeenCalled();
	});

	it('stops a connection when its endpoint is disabled or removed', async () => {
		endpoints = [endpoint('a'), endpoint('b')];
		service.attach(listener as ModbusConnectionsListener);
		await service.reconcile();

		listener.endpointChanged.mockClear();

		endpoints[0].enabled = false;
		endpoints = [endpoints[0]];
		await service.reconcile();

		expect(created[0].stop).toHaveBeenCalledTimes(1);
		expect(created[1].stop).toHaveBeenCalledTimes(1);
		expect(created).toHaveLength(2);
		expect(service.get('a')).toBeNull();
		expect(service.get('b')).toBeNull();
		expect(listener.endpointChanged.mock.calls.map(([id]) => id as string).sort()).toEqual(['a', 'b']);
	});

	it('serialises concurrent reconciles', async () => {
		endpoints = [endpoint('a')];
		service.attach(listener as ModbusConnectionsListener);

		await Promise.all([service.reconcile(), service.reconcile(), service.reconcile()]);

		expect(created).toHaveLength(1);
	});

	it('keeps reconciling when a listener callback fails', async () => {
		endpoints = [endpoint('a'), endpoint('b')];
		listener.endpointChanged.mockRejectedValueOnce(new Error('boom'));
		service.attach(listener as ModbusConnectionsListener);

		await expect(service.reconcile()).resolves.toBeUndefined();

		expect(listener.endpointChanged).toHaveBeenCalledTimes(2);
	});

	it('stops every connection and detaches on stopAll', async () => {
		endpoints = [endpoint('a'), endpoint('b')];
		service.attach(listener as ModbusConnectionsListener);
		await service.reconcile();

		await service.stopAll();

		expect(created[0].stop).toHaveBeenCalledTimes(1);
		expect(created[1].stop).toHaveBeenCalledTimes(1);
		expect(service.get('a')).toBeNull();

		await service.reconcile();

		expect(created).toHaveLength(2);
	});
});
