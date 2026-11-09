import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DEVICES_MODBUS_PLUGIN_NAME, ModbusByteOrder, ModbusRegisterType } from '../devices-modbus.constants';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusPropertyValue, decodeBit, decodeRegisters, registerSpan } from '../lib/codec';
import { ModbusEndpointUnavailableError, ModbusExceptionError } from '../lib/errors';
import { ReadBlock, ReadLimits, ReadPoint, planReadBlocks, sliceForPoint, splitBlock } from '../lib/read-planner';

import { EndpointConnection } from './endpoint-connection';

export interface ModbusDeviceSnapshot {
	deviceId: string;
	endpointId: string;
	unitId: number;
	pollIntervalMs: number;
	byteOrder: ModbusByteOrder;
	wordOrder: ModbusByteOrder;
	limits: ReadLimits;
	reads: Array<{ propertyId: string; binding: ModbusBindingEntity }>;
}

export interface PollerCallbacks {
	report(propertyId: string, value: ModbusPropertyValue | null, sampledAt: Date): Promise<void>;
	setConnectionState(state: ConnectionState, reason?: string): Promise<void>;
	/** `false` once the owner replaced or dropped this poller; late results are then discarded. */
	isCurrent(): boolean;
	/** The poller's overload flag changed (see `isOverloaded()`). */
	setOverloaded(overloaded: boolean): void;
}

/** Polls failing in a row before the device is reported `lost`. */
export const FAILED_POLLS_UNTIL_LOST = 3;

const FUNCTION_CODES: Record<ModbusRegisterType, number> = {
	[ModbusRegisterType.COIL]: 1,
	[ModbusRegisterType.DISCRETE_INPUT]: 2,
	[ModbusRegisterType.HOLDING_REGISTER]: 3,
	[ModbusRegisterType.INPUT_REGISTER]: 4,
};

const isBitTable = (registerType: ModbusRegisterType): boolean =>
	registerType === ModbusRegisterType.COIL || registerType === ModbusRegisterType.DISCRETE_INPUT;

interface Schedule {
	intervalMs: number;
	blocks: ReadBlock[];
	timer: ReturnType<typeof setInterval> | null;
	running: boolean;
	overloaded: boolean;
}

type ReadOutcome = { kind: 'ok' } | { kind: 'stale' } | { kind: 'failed'; error: Error };

/**
 * Polls the read bindings of one device over its endpoint connection.
 *
 * - Points are grouped by effective interval (binding override or device interval); every group has its own read
 *   plan and timer, and at most one poll in flight. A tick that finds its poll still running is skipped and flags
 *   the poller overloaded until a poll of that group completes within its interval.
 * - A value is reported only when it differs from the last value reported for the property.
 * - An illegal function / data address / data value exception (0x01-0x03) invalidates the block's properties and
 *   splits the block into single points for the next poll, so one bad point cannot hide its neighbours. Every other
 *   exception (busy, acknowledge, server failure, gateway, unknown) is transient: like timeouts, connection errors
 *   and an unavailable endpoint it fails the poll without splitting, so a single busy reply never multiplies traffic;
 *   `FAILED_POLLS_UNTIL_LOST` failed polls in a row report `lost` and invalidate every read property once.
 * - `connected` is passed to `callbacks.setConnectionState` after every successful poll and `lost` after every failed
 *   poll while lost; the owner deduplicates, so a state its store missed once is stored by a later poll.
 * - Nothing is reported once `stop()` was called or `callbacks.isCurrent()` turned `false`. Callback failures are
 *   logged and never stop the loop.
 */
export class DevicePoller {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'DevicePoller');

	private readonly bindings = new Map<string, ModbusBindingEntity>();
	private readonly points: ReadPoint[] = [];
	private readonly schedules: Schedule[] = [];

	private readonly lastReported = new Map<string, ModbusPropertyValue | null>();
	/** Properties whose last report failed; the failure is logged once until a report succeeds again. */
	private readonly failingReports = new Set<string>();

	private active = false;
	private state: ConnectionState | null = null;
	private stateUpdates: Promise<void> = Promise.resolve();
	private consecutiveFailures = 0;

	constructor(
		private readonly device: ModbusDeviceSnapshot,
		private readonly connection: EndpointConnection,
		private readonly callbacks: PollerCallbacks,
	) {
		const groups = new Map<number, ReadPoint[]>();

		for (const { propertyId, binding } of device.reads) {
			const point: ReadPoint = {
				key: propertyId,
				registerType: binding.registerType,
				address: binding.address,
				span: isBitTable(binding.registerType) ? 1 : registerSpan(binding.dataType),
			};
			const intervalMs = binding.pollIntervalMs ?? device.pollIntervalMs;

			this.bindings.set(propertyId, binding);
			this.points.push(point);
			groups.set(intervalMs, [...(groups.get(intervalMs) ?? []), point]);
		}

		for (const [intervalMs, points] of groups) {
			this.schedules.push({
				intervalMs,
				blocks: planReadBlocks(points, device.limits),
				timer: null,
				running: false,
				overloaded: false,
			});
		}
	}

	start(): void {
		if (this.active) {
			return;
		}

		this.active = true;

		void this.setState(ConnectionState.INIT);

		for (const schedule of this.schedules) {
			schedule.timer = setInterval(() => this.tick(schedule), schedule.intervalMs);
			schedule.timer.unref?.();

			this.tick(schedule);
		}
	}

	stop(): void {
		this.active = false;

		for (const schedule of this.schedules) {
			if (schedule.timer !== null) {
				clearInterval(schedule.timer);
				schedule.timer = null;
			}
		}
	}

	isOverloaded(): boolean {
		return this.active && this.schedules.some((schedule) => schedule.overloaded);
	}

	/**
	 * Reads the given read-bound properties (all when omitted) right away and reports them even when unchanged.
	 * Rejects when the endpoint did not answer; does not affect the device's connection state.
	 */
	async pollNow(propertyIds?: string[]): Promise<void> {
		if (!this.isCurrent()) {
			throw new ModbusEndpointUnavailableError('Modbus device is not being polled');
		}

		const wanted = propertyIds ? new Set(propertyIds) : null;
		const points = this.points.filter((point) => wanted === null || wanted.has(point.key));

		if (points.length === 0) {
			return;
		}

		const outcome = await this.readBlocks(planReadBlocks(points, this.device.limits), null, true);

		if (outcome.kind === 'failed') {
			throw outcome.error;
		}
	}

	private isCurrent(): boolean {
		return this.active && this.callbacks.isCurrent();
	}

	private tick(schedule: Schedule): void {
		this.poll(schedule).catch((error: Error) => {
			this.logger.error(`Unexpected error while polling device id=${this.device.deviceId}`, {
				message: error.message,
				stack: error.stack,
			});
		});
	}

	private async poll(schedule: Schedule): Promise<void> {
		if (schedule.running) {
			this.setScheduleOverloaded(schedule, true);

			return;
		}

		schedule.running = true;

		const startedAt = Date.now();
		let outcome: ReadOutcome;

		try {
			outcome = await this.readBlocks(schedule.blocks, schedule, false);
		} finally {
			schedule.running = false;
		}

		if (outcome.kind === 'stale' || !this.isCurrent()) {
			return;
		}

		if (Date.now() - startedAt <= schedule.intervalMs) {
			this.setScheduleOverloaded(schedule, false);
		}

		if (outcome.kind === 'failed') {
			await this.pollFailed(outcome.error);
		} else {
			this.consecutiveFailures = 0;

			// Repeated after every successful poll: the owner deduplicates, and a state its store missed is stored now.
			await this.setState(ConnectionState.CONNECTED);
		}
	}

	private async readBlocks(blocks: ReadBlock[], schedule: Schedule | null, force: boolean): Promise<ReadOutcome> {
		for (const block of [...blocks]) {
			if (!this.isCurrent()) {
				return { kind: 'stale' };
			}

			const sampledAt = new Date();
			let values: boolean[] | number[];

			try {
				values = await this.connection.read({
					unitId: this.device.unitId,
					registerType: block.registerType,
					address: block.address,
					count: block.count,
				});
			} catch (error) {
				if (!this.isCurrent()) {
					return { kind: 'stale' };
				}

				if (error instanceof ModbusExceptionError && error.isRequestError) {
					await this.invalidateBlock(block, error, sampledAt, schedule, force);

					continue;
				}

				return { kind: 'failed', error: error instanceof Error ? error : new Error(String(error)) };
			}

			if (!this.isCurrent()) {
				return { kind: 'stale' };
			}

			for (const point of block.points) {
				await this.publish(point.key, this.decode(point, sliceForPoint(block, values, point)), sampledAt, force);
			}
		}

		return { kind: 'ok' };
	}

	private decode(point: ReadPoint, raw: (number | boolean)[]): ModbusPropertyValue | null {
		const binding = this.bindings.get(point.key);

		if (!binding) {
			return null;
		}

		let value: ModbusPropertyValue | null;

		try {
			value = isBitTable(binding.registerType)
				? decodeBit(raw[0] === true, binding)
				: decodeRegisters(raw as number[], {
						dataType: binding.dataType,
						byteOrder: binding.byteOrder ?? this.device.byteOrder,
						wordOrder: binding.wordOrder ?? this.device.wordOrder,
						bit: binding.bit,
						invert: binding.invert,
						scale: binding.scale,
						offset: binding.offset,
						valueMap: binding.valueMap,
					});
		} catch (error) {
			this.logger.warn(
				`Failed to decode property id=${point.key} of device id=${this.device.deviceId}: ${(error as Error).message}`,
			);

			return null;
		}

		if (value === null && this.lastReported.get(point.key) !== null) {
			this.logger.warn(
				`Raw value ${JSON.stringify(raw)} of property id=${point.key} (device id=${this.device.deviceId}, ` +
					`address=${point.address}) is not in its value map; reporting it as invalid`,
			);
		}

		return value;
	}

	private async invalidateBlock(
		block: ReadBlock,
		error: ModbusExceptionError,
		sampledAt: Date,
		schedule: Schedule | null,
		force: boolean,
	): Promise<void> {
		this.logger.warn(
			`Modbus exception ${error.code} on endpoint id=${this.device.endpointId} unit=${this.device.unitId} ` +
				`function=${FUNCTION_CODES[block.registerType]} address=${block.address} count=${block.count}: ` +
				`${error.message}; invalidating ${block.points.length} propert(ies)`,
		);

		for (const point of block.points) {
			await this.publish(point.key, null, sampledAt, force);
		}

		const index = schedule ? schedule.blocks.indexOf(block) : -1;

		if (schedule && index !== -1) {
			const parts = splitBlock(block);

			if (parts.length > 1) {
				schedule.blocks.splice(index, 1, ...parts);
			}
		}
	}

	private async pollFailed(error: Error): Promise<void> {
		this.consecutiveFailures++;

		this.logger.debug(
			`Poll of device id=${this.device.deviceId} failed (${this.consecutiveFailures} in a row): ${error.message}`,
		);

		if (this.consecutiveFailures < FAILED_POLLS_UNTIL_LOST) {
			return;
		}

		const reason = `No answer for ${this.consecutiveFailures} consecutive polls: ${error.message}`;

		// Already lost: the properties were invalidated once; the state is repeated for the same reason as `connected`.
		if (this.state === ConnectionState.LOST) {
			await this.setState(ConnectionState.LOST, reason);

			return;
		}

		const now = new Date();

		for (const point of this.points) {
			await this.publish(point.key, null, now, false);
		}

		await this.setState(ConnectionState.LOST, reason);
	}

	private async publish(
		propertyId: string,
		value: ModbusPropertyValue | null,
		sampledAt: Date,
		force: boolean,
	): Promise<void> {
		if (!this.isCurrent()) {
			return;
		}

		if (!force && this.lastReported.has(propertyId) && this.lastReported.get(propertyId) === value) {
			return;
		}

		try {
			await this.callbacks.report(propertyId, value, sampledAt);

			this.lastReported.set(propertyId, value);
			this.failingReports.delete(propertyId);
		} catch (error) {
			if (!this.failingReports.has(propertyId)) {
				this.failingReports.add(propertyId);

				this.logger.warn(
					`Failed to report property id=${propertyId} of device id=${this.device.deviceId}: ${(error as Error).message}`,
				);
			}
		}
	}

	/** State updates run one after another so they reach the store in the order they were decided. */
	private setState(state: ConnectionState, reason?: string): Promise<void> {
		this.state = state;

		this.stateUpdates = this.stateUpdates.then(async () => {
			if (!this.isCurrent()) {
				return;
			}

			try {
				await this.callbacks.setConnectionState(state, reason);
			} catch (error) {
				this.logger.warn(
					`Failed to set connection state ${state} of device id=${this.device.deviceId}: ${(error as Error).message}`,
				);
			}
		});

		return this.stateUpdates;
	}

	private setScheduleOverloaded(schedule: Schedule, overloaded: boolean): void {
		const before = this.isOverloaded();

		schedule.overloaded = overloaded;

		const after = this.isOverloaded();

		if (before !== after) {
			this.callbacks.setOverloaded(after);
		}
	}
}
