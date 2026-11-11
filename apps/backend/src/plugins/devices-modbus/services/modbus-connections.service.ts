import { Repository } from 'typeorm';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import { EndpointConnection, EndpointHealth } from '../runtime/endpoint-connection';
import { createModbusSerialTransport } from '../transport/modbus-serial.transport';

export const MODBUS_CONNECTION_FACTORY = Symbol('MODBUS_CONNECTION_FACTORY');

export type ModbusConnectionFactory = (endpoint: ModbusEndpointEntity) => EndpointConnection;

/** Implemented by the runtime, which owns the pollers that use the connections. */
export interface ModbusConnectionsListener {
	/** Called synchronously right before the endpoint's connection is stopped (endpoint removed, disabled or edited). */
	endpointStopping(endpointId: string): void;
	/** Called once the endpoint's connection was started, rebuilt or stopped for good. */
	endpointChanged(endpointId: string): Promise<void>;
}

const createConnection: ModbusConnectionFactory = (endpoint) =>
	new EndpointConnection(
		{
			endpointId: endpoint.id,
			framing: endpoint.framing,
			maxInFlight: endpoint.maxInFlight,
			interRequestDelayMs: endpoint.interRequestDelayMs,
		},
		() =>
			createModbusSerialTransport({
				host: endpoint.host,
				port: endpoint.port,
				framing: endpoint.framing,
				connectTimeoutMs: endpoint.connectTimeoutMs,
				requestTimeoutMs: endpoint.requestTimeoutMs,
			}),
	);

/** Everything a running connection was built from; a change to any of it rebuilds the connection. */
const fingerprint = (endpoint: ModbusEndpointEntity): string =>
	JSON.stringify([
		endpoint.host,
		endpoint.port,
		endpoint.framing,
		endpoint.connectTimeoutMs,
		endpoint.requestTimeoutMs,
		endpoint.interRequestDelayMs,
		endpoint.maxInFlight,
	]);

interface RunningConnection {
	connection: EndpointConnection;
	fingerprint: string;
	requestTimeoutMs: number;
	interRequestDelayMs: number;
}

/**
 * Owns one `EndpointConnection` per enabled endpoint while the runtime is attached. Reconciles run one at a time:
 * a changed endpoint has its pollers stopped (listener), its old connection stopped (pending requests reject), then
 * exactly one new connection started, and finally the listener reloads the endpoint's devices.
 */
@Injectable()
export class ModbusConnectionsService {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusConnectionsService');
	private readonly createConnection: ModbusConnectionFactory;

	private readonly connections = new Map<string, RunningConnection>();
	private listener: ModbusConnectionsListener | null = null;
	private queue: Promise<void> = Promise.resolve();

	constructor(
		@InjectRepository(ModbusEndpointEntity)
		private readonly repository: Repository<ModbusEndpointEntity>,
		@Optional()
		@Inject(MODBUS_CONNECTION_FACTORY)
		factory?: ModbusConnectionFactory,
	) {
		this.createConnection = factory ?? createConnection;
	}

	/** Connections are only kept while a listener (the started runtime) is attached. */
	attach(listener: ModbusConnectionsListener): void {
		this.listener = listener;
	}

	/** Whether the runtime is attached, i.e. every enabled endpoint is expected to have a running connection. */
	isAttached(): boolean {
		return this.listener !== null;
	}

	/** Brings the running connections in line with the stored endpoints. A no-op while detached. */
	reconcile(): Promise<void> {
		return this.serialise(() => this.doReconcile());
	}

	/** Detaches the listener and stops every connection. */
	stopAll(): Promise<void> {
		this.listener = null;

		return this.serialise(async () => {
			const running = [...this.connections.values()];

			this.connections.clear();

			await Promise.all(running.map(({ connection }) => this.stopQuietly(connection)));
		});
	}

	get(endpointId: string): EndpointConnection | null {
		return this.connections.get(endpointId)?.connection ?? null;
	}

	/**
	 * Whether the running connection of `endpoint` was built from its current settings. After an update the new
	 * settings are stored before the queued reconcile rebuilds the connection; until then the old one still points at
	 * the previous destination.
	 */
	isCurrent(endpoint: ModbusEndpointEntity): boolean {
		return this.connections.get(endpoint.id)?.fingerprint === fingerprint(endpoint);
	}

	/** The slowest request timeout and inter-request delay over the loaded endpoints, or `null` when none is loaded. */
	getTimingEnvelope(): { requestTimeoutMs: number; interRequestDelayMs: number } | null {
		const running = [...this.connections.values()];

		if (running.length === 0) {
			return null;
		}

		return {
			requestTimeoutMs: Math.max(...running.map((entry) => entry.requestTimeoutMs)),
			interRequestDelayMs: Math.max(...running.map((entry) => entry.interRequestDelayMs)),
		};
	}

	/** Returns the live health of an endpoint, or `null` when it is not running. */
	getHealth(endpointId: string): EndpointHealth | null {
		return this.get(endpointId)?.getHealth() ?? null;
	}

	private serialise(task: () => Promise<void>): Promise<void> {
		const run: Promise<void> = this.queue.then(task);

		this.queue = run.catch((): void => undefined);

		return run;
	}

	private async doReconcile(): Promise<void> {
		if (this.listener === null) {
			return;
		}

		const endpoints = await this.repository.find();
		const listener = this.listener;

		if (listener === null) {
			return;
		}

		const desired = new Map(
			endpoints.filter((endpoint) => endpoint.enabled).map((endpoint) => [endpoint.id, endpoint]),
		);
		const changed = new Set<string>();

		for (const [endpointId, running] of [...this.connections]) {
			const endpoint = desired.get(endpointId);

			if (endpoint && fingerprint(endpoint) === running.fingerprint) {
				continue;
			}

			this.connections.delete(endpointId);
			changed.add(endpointId);

			this.notifyStopping(listener, endpointId);

			await this.stopQuietly(running.connection);
		}

		for (const [endpointId, endpoint] of desired) {
			if (this.connections.has(endpointId)) {
				continue;
			}

			const connection = this.createConnection(endpoint);

			this.connections.set(endpointId, {
				connection,
				fingerprint: fingerprint(endpoint),
				requestTimeoutMs: endpoint.requestTimeoutMs,
				interRequestDelayMs: endpoint.interRequestDelayMs,
			});
			changed.add(endpointId);

			connection.start();
		}

		for (const endpointId of changed) {
			try {
				await listener.endpointChanged(endpointId);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to reload devices of endpoint id=${endpointId}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		}
	}

	private notifyStopping(listener: ModbusConnectionsListener, endpointId: string): void {
		try {
			listener.endpointStopping(endpointId);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to stop pollers of endpoint id=${endpointId}`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	private async stopQuietly(connection: EndpointConnection): Promise<void> {
		try {
			await connection.stop();
		} catch (error) {
			this.logger.warn(`Failed to stop a Modbus connection: ${(error as Error).message}`);
		}
	}
}
