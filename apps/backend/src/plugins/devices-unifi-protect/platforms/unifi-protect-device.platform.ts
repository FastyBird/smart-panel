import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import { ProtectApiClient } from '../client/protect-api.client';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_COMMAND_CONFIRM_TIMEOUT_MS,
	PROTECT_COMMAND_MAX_WAITING_PER_DEVICE,
	PROTECT_COMMAND_PATCH_DEADLINE_MS,
	PROTECT_COMMAND_QUEUE_WAIT_MS,
	PROTECT_COMMAND_READBACK_DEADLINE_MS,
	PROTECT_COMMAND_SETTLE_MS,
	PROTECT_COMMAND_TIMEOUT_MS,
} from '../devices-unifi-protect.constants';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from '../entities/devices-unifi-protect.entity';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectConnectorService, ProtectConsoleIdentity } from '../services/protect-connector.service';
import { ProtectFailureLogLimiter } from '../services/protect-failure-log-limiter';
import { ProtectRealtimeService } from '../services/protect-realtime.service';
import { ProtectSynchronizerService } from '../services/protect-synchronizer.service';

import {
	PROTECT_WRITABLE_MAPPINGS,
	ProtectCommandInput,
	ProtectCommandOutcome,
	ProtectDeviceCommand,
	ProtectPropertyOutcome,
	ProtectWritableMappingName,
	buildProtectPatchBody,
	planProtectCommands,
	protectFieldsMatch,
} from './protect-command';
import { ProtectConfirmationWaiter, ProtectConfirmationWaiters } from './protect-confirmation';

type Raw = Readonly<Record<string, unknown>>;

type ConfirmationSource = 'frame' | 'cache' | 'readback';

interface CommandResult {
	outcome: ProtectCommandOutcome;
	source?: ConfirmationSource;
	/** Class name of an unexpected (non-Protect) error; never its message. */
	errorClass?: string;
}

/** What one batch holds on to: the session it started in. Any change of session ends the batch. */
interface SessionContext {
	client: ProtectApiClient;
	identity: ProtectConsoleIdentity;
	generation: number;
	/** Aborted when the session ends; listeners are added per awaited call and removed when it settles. */
	signal: AbortSignal;
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

interface QueueEntry {
	resolve: (turn: 'granted' | 'busy' | 'cancelled') => void;
	timer: NodeJS.Timeout;
}

interface DeviceQueue {
	waiting: QueueEntry[];
}

const FAILURE_OUTCOMES = new Set<ProtectCommandOutcome>([
	'not_controllable',
	'invalid_value',
	'conflict',
	'unavailable',
	'busy',
	'rejected',
	'unauthorized',
	'not_found',
	'rate_limited',
	'failed',
	'not_confirmed',
]);

/** A failed PATCH that gives no answer on whether the console applied it; the readback decides. */
const classifyPatchError = (error: unknown): ProtectCommandOutcome | 'ambiguous' => {
	if (!(error instanceof ProtectApiError)) {
		return 'failed';
	}

	switch (error.category) {
		case ProtectErrorCategory.BAD_REQUEST:
			return 'rejected';
		case ProtectErrorCategory.PROTOCOL:
			return error.status !== null && error.status >= 400 && error.status <= 499 ? 'rejected' : 'ambiguous';
		case ProtectErrorCategory.AUTHENTICATION:
		case ProtectErrorCategory.AUTHORIZATION:
			return 'unauthorized';
		case ProtectErrorCategory.NOT_FOUND:
			return 'not_found';
		case ProtectErrorCategory.RATE_LIMITED:
			return 'rate_limited';
		case ProtectErrorCategory.CANCELLED:
		case ProtectErrorCategory.VALIDATION:
		case ProtectErrorCategory.TLS_UNTRUSTED:
		case ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH:
			return 'unavailable';
		case ProtectErrorCategory.TIMEOUT:
		case ProtectErrorCategory.UNAVAILABLE:
		case ProtectErrorCategory.UNREACHABLE:
			return 'ambiguous';
		default:
			return 'failed';
	}
};

/** The constructor name only (never a message), and only when it is a plain identifier. */
const errorClassOf = (error: unknown): string => {
	const name = (error as { constructor?: { name?: unknown } } | null | undefined)?.constructor?.name;

	return typeof name === 'string' && /^[A-Za-z0-9_$]{1,64}$/.test(name) ? name : 'unknown';
};

const mappingNameOf = (property: ChannelPropertyEntity): string | null =>
	property instanceof ProtectChannelPropertyEntity && typeof property.protectMappingName === 'string'
		? property.protectMappingName
		: null;

const referencesEntity = (reference: { readonly id: string } | string | undefined, expectedId: string): boolean =>
	(typeof reference === 'string' ? reference : reference?.id) === expectedId;

@Injectable()
export class UnifiProtectDevicePlatform implements IDevicePlatform, OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'DevicePlatform');
	private readonly failureLog = new ProtectFailureLogLimiter();
	private readonly waiters = new ProtectConfirmationWaiters();
	/** A key is present while a command of that device holds its turn; its waiting entries are the FIFO. */
	private readonly queues = new Map<string, DeviceQueue>();
	private generation = 0;
	private session = new AbortController();
	private unsubscribeObserver: (() => void) | null = null;
	private unsubscribeSession: (() => void) | null = null;

	constructor(
		private readonly connector: ProtectConnectorService,
		private readonly realtime: ProtectRealtimeService,
		private readonly synchronizer: ProtectSynchronizerService,
	) {}

	onModuleInit(): void {
		this.unsubscribeObserver ??= this.synchronizer.observeDevices((modelKey, id, raw) => {
			this.waiters.observe(`${modelKey}\u0000${id}`, raw);
		});
		// Any change of session (a new one included) ends the commands of the previous one.
		this.unsubscribeSession ??= this.connector.onSessionChange(() => {
			this.endSession();
		});
	}

	onModuleDestroy(): void {
		this.unsubscribeObserver?.();
		this.unsubscribeObserver = null;
		this.unsubscribeSession?.();
		this.unsubscribeSession = null;
		this.endSession();
	}

	getType(): string {
		return DEVICES_UNIFI_PROTECT_TYPE;
	}

	getCommandTimeoutMs(commandCount: number): number {
		return commandCount > 0 ? PROTECT_COMMAND_TIMEOUT_MS : 0;
	}

	usesAuthoritativePropertyReadback(property: ChannelPropertyEntity): boolean {
		return property instanceof ProtectChannelPropertyEntity;
	}

	process(update: IDevicePropertyData): Promise<boolean> {
		return this.processBatch([update]);
	}

	async processBatch(updates: IDevicePropertyData[]): Promise<boolean> {
		const outcomes = await this.executeBatch(updates);

		return outcomes.every((entry) => entry.outcome === 'confirmed');
	}

	/** Per-property outcomes in input order. Never throws. */
	async executeBatch(updates: IDevicePropertyData[]): Promise<ProtectPropertyOutcome[]> {
		try {
			return await this.execute(updates);
		} catch (error) {
			this.logFailure('failed', updates[0]?.property.id ?? 'unknown', null, errorClassOf(error));

			return updates.map((update) => ({
				propertyId: update.property.id,
				mappingName: mappingNameOf(update.property),
				outcome: 'failed',
			}));
		}
	}

	private async execute(updates: IDevicePropertyData[]): Promise<ProtectPropertyOutcome[]> {
		if (updates.length === 0) {
			return [];
		}

		const failAt = (index: number, outcome: ProtectCommandOutcome): ProtectPropertyOutcome[] => {
			const result = updates.map((update, position) => ({
				propertyId: update.property.id,
				mappingName: mappingNameOf(update.property),
				outcome: position === index ? outcome : ('skipped' as const),
			}));

			this.logFailure(outcome, result[index].propertyId, result[index].mappingName);

			return result;
		};

		const values: (string | number | boolean)[] = [];

		for (let index = 0; index < updates.length; index++) {
			const checked = this.checkTarget(updates[index]);

			if (typeof checked === 'string') {
				return failAt(index, checked);
			}

			values.push(checked.value);
		}

		const client = this.connector.getClient();
		const identity = this.connector.getConsoleIdentity();

		if (client === null || identity === null) {
			return failAt(0, 'unavailable');
		}

		const mismatch = updates.findIndex(
			(update) => (update.device as ProtectDeviceEntity).protectNvrId !== identity.nvrId,
		);

		if (mismatch !== -1) {
			return failAt(mismatch, 'unavailable');
		}

		const inputs: ProtectCommandInput[] = updates.map((update, index) => {
			const device = update.device as ProtectDeviceEntity;
			const mappingName = mappingNameOf(update.property);

			return {
				propertyId: update.property.id,
				mappingName,
				channelIdentifier: update.channel.identifier,
				protectDeviceId: device.protectDeviceId,
				modelKey: device.protectModelKey,
				value: values[index],
				cached: this.lookupCached(device, mappingName),
			};
		});
		const plan = planProtectCommands(inputs);

		if (plan.ok === false) {
			for (const entry of plan.outcomes) {
				if (entry.outcome !== 'skipped') {
					this.logFailure(entry.outcome, entry.propertyId, entry.mappingName);
				}
			}

			return plan.outcomes;
		}

		const context: SessionContext = {
			client,
			identity,
			generation: this.generation,
			signal: this.session.signal,
		};
		const outcomes = new Map<string, ProtectCommandOutcome>();
		let stopped = false;

		for (const command of plan.commands) {
			if (stopped) {
				for (const propertyId of command.propertyIds) {
					outcomes.set(propertyId, 'skipped');
				}

				continue;
			}

			const result = await this.runCommand(command, context);

			for (const propertyId of command.propertyIds) {
				outcomes.set(propertyId, result.outcome);
			}

			if (result.outcome === 'confirmed') {
				this.logger.debug(
					`UniFi Protect command confirmed (${result.source ?? 'readback'}) device=${command.protectDeviceId}`,
				);
			} else {
				stopped = true;
				this.logFailure(
					result.outcome,
					command.propertyIds[0],
					command.mappingNames.get(command.propertyIds[0]) ?? null,
					result.errorClass,
				);
			}
		}

		return updates.map((update, index) => ({
			propertyId: update.property.id,
			mappingName: inputs[index].mappingName,
			outcome: outcomes.get(update.property.id) ?? 'failed',
		}));
	}

	/** Entity checks and panel value validation; the validated value, or the refusing outcome. */
	private checkTarget(update: IDevicePropertyData): { value: string | number | boolean } | ProtectCommandOutcome {
		const { device, channel, property } = update;

		if (
			!(device instanceof ProtectDeviceEntity) ||
			!(channel instanceof ProtectChannelEntity) ||
			!(property instanceof ProtectChannelPropertyEntity) ||
			!device.enabled ||
			typeof device.protectDeviceId !== 'string' ||
			!referencesEntity(channel.device, device.id) ||
			!referencesEntity(property.channel, channel.id) ||
			!property.permissions.some((permission) =>
				[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
			)
		) {
			return 'not_controllable';
		}

		const validation = validatePropertyCommandValue(property, update.value);

		return validation.valid && validation.value !== undefined ? { value: validation.value } : 'invalid_value';
	}

	/** A device without a stored model key is looked up under the mapping's own model key, else camera, then light. */
	private lookupCached(device: ProtectDeviceEntity, mappingName: string | null): Raw | null {
		const mapping =
			mappingName !== null && Object.prototype.hasOwnProperty.call(PROTECT_WRITABLE_MAPPINGS, mappingName)
				? PROTECT_WRITABLE_MAPPINGS[mappingName as ProtectWritableMappingName]
				: null;
		const modelKeys: readonly string[] =
			device.protectModelKey !== null
				? [device.protectModelKey]
				: mapping !== null
					? [mapping.modelKey]
					: ['camera', 'light'];

		for (const modelKey of modelKeys) {
			const cached = this.synchronizer.getCachedDevice(modelKey, device.protectDeviceId);

			if (cached !== null) {
				return cached;
			}
		}

		return null;
	}

	private async runCommand(command: ProtectDeviceCommand, context: SessionContext): Promise<CommandResult> {
		const turn = await this.acquire(command.key);

		if (turn === 'busy') {
			return { outcome: 'busy' };
		}

		if (turn === 'cancelled') {
			return { outcome: 'unavailable' };
		}

		try {
			if (this.generation !== context.generation) {
				return { outcome: 'unavailable' };
			}

			const cached = this.synchronizer.getCachedDevice(command.modelKey, command.protectDeviceId);

			if (cached === null || cached.state !== 'CONNECTED') {
				return { outcome: 'unavailable' };
			}

			const waiter = this.waiters.arm(command.key, command.fields);

			if (waiter === null) {
				return { outcome: 'busy' };
			}

			try {
				return await this.deliver(command, context, waiter);
			} finally {
				waiter.dispose();
			}
		} finally {
			this.release(command.key);
		}
	}

	private async deliver(
		command: ProtectDeviceCommand,
		context: SessionContext,
		waiter: ProtectConfirmationWaiter,
	): Promise<CommandResult> {
		const body = buildProtectPatchBody(command.resource, command.fields);
		const sent = await this.live(
			context,
			context.client.patchDevice(command.resource, command.protectDeviceId, body, {
				deadlineMs: PROTECT_COMMAND_PATCH_DEADLINE_MS,
			}),
		);

		if (sent === null) {
			return { outcome: 'unavailable' };
		}

		if (sent.ok === false) {
			const verdict = classifyPatchError(sent.error);

			if (verdict !== 'ambiguous') {
				return verdict === 'failed' && !(sent.error instanceof ProtectApiError)
					? { outcome: verdict, errorClass: errorClassOf(sent.error) }
					: { outcome: verdict };
			}

			const matched = await this.readback(command, context);

			if (matched === null) {
				return { outcome: 'unavailable' };
			}

			return matched ? { outcome: 'confirmed', source: 'readback' } : { outcome: 'failed' };
		}

		waiter.accept(this.synchronizer.getStoredDevice(command.modelKey, command.protectDeviceId));

		if (waiter.matched) {
			return { outcome: 'confirmed', source: 'cache' };
		}

		const timeoutMs =
			this.realtime.getState() === 'streaming' ? PROTECT_COMMAND_CONFIRM_TIMEOUT_MS : PROTECT_COMMAND_SETTLE_MS;
		const waited = await this.live(context, waiter.wait(timeoutMs));

		if (waited === null || waiter.cancelled) {
			return { outcome: 'unavailable' };
		}

		if (waited.ok && waited.value) {
			return { outcome: 'confirmed', source: 'frame' };
		}

		const matched = await this.readback(command, context);

		if (matched === null) {
			return { outcome: 'unavailable' };
		}

		return matched ? { outcome: 'confirmed', source: 'readback' } : { outcome: 'not_confirmed' };
	}

	/** True when the console shows the commanded values, null when the session ended meanwhile. */
	private async readback(command: ProtectDeviceCommand, context: SessionContext): Promise<boolean | null> {
		const sequence = this.synchronizer.getDeviceSequence(command.modelKey, command.protectDeviceId);
		const options = { deadlineMs: PROTECT_COMMAND_READBACK_DEADLINE_MS };
		const read = await this.live(
			context,
			(command.modelKey === 'light'
				? context.client.getLight(command.protectDeviceId, options)
				: context.client.getCamera(command.protectDeviceId, options)) as Promise<unknown>,
		);

		if (read === null) {
			return null;
		}

		if (read.ok === false) {
			return false;
		}

		const raw = (read.value as { raw: Raw }).raw;
		// Only a readback of the current session is applied; `live` returned null otherwise.
		const applied = await this.live(
			context,
			this.synchronizer.applyDeviceReadback(
				context.identity,
				{ modelKey: command.modelKey, id: command.protectDeviceId, raw },
				sequence,
			),
		);

		if (applied === null) {
			return null;
		}

		if (applied.ok === false) {
			return false;
		}

		// A discarded readback means a newer frame won: judge by what is stored now, never by the discarded object.
		return protectFieldsMatch(
			applied.value ? raw : this.synchronizer.getStoredDevice(command.modelKey, command.protectDeviceId),
			command.fields,
		);
	}

	/** Resolves with the settled promise, or null when the session ended first (or while it was pending). */
	private async live<T>(context: SessionContext, promise: Promise<T>): Promise<Settled<T> | null> {
		const settled = promise.then(
			(value): Settled<T> => ({ ok: true, value }),
			(error: unknown): Settled<T> => ({ ok: false, error }),
		);

		if (context.signal.aborted) {
			return null;
		}

		let onAbort: () => void = () => undefined;
		const ended = new Promise<null>((resolve) => {
			onAbort = () => resolve(null);
			context.signal.addEventListener('abort', onAbort, { once: true });
		});
		let result: Settled<T> | null;

		try {
			result = await Promise.race<Settled<T> | null>([settled, ended]);
		} finally {
			// Nothing of this call may stay reachable from the session once it settled.
			context.signal.removeEventListener('abort', onAbort);
		}

		return result !== null && this.generation === context.generation ? result : null;
	}

	private acquire(key: string): Promise<'granted' | 'busy' | 'cancelled'> {
		const queue = this.queues.get(key);

		if (queue === undefined) {
			this.queues.set(key, { waiting: [] });

			return Promise.resolve('granted');
		}

		if (queue.waiting.length >= PROTECT_COMMAND_MAX_WAITING_PER_DEVICE) {
			return Promise.resolve('busy');
		}

		return new Promise((resolve) => {
			const entry: QueueEntry = {
				resolve,
				timer: setTimeout(() => {
					const index = queue.waiting.indexOf(entry);

					if (index !== -1) {
						queue.waiting.splice(index, 1);
					}

					resolve('busy');
				}, PROTECT_COMMAND_QUEUE_WAIT_MS),
			};

			entry.timer.unref();
			queue.waiting.push(entry);
		});
	}

	private release(key: string): void {
		const queue = this.queues.get(key);
		const next = queue?.waiting.shift();

		if (next === undefined) {
			this.queues.delete(key);

			return;
		}

		clearTimeout(next.timer);
		next.resolve('granted');
	}

	/** Session end: every in-flight command ends as unavailable, nothing waiting for a turn is ever sent. */
	private endSession(): void {
		this.generation++;
		this.session.abort();
		this.session = new AbortController();
		this.waiters.cancelAll();

		for (const queue of this.queues.values()) {
			for (const entry of queue.waiting.splice(0)) {
				clearTimeout(entry.timer);
				entry.resolve('cancelled');
			}
		}
	}

	private logFailure(
		outcome: ProtectCommandOutcome,
		propertyId: string,
		mappingName: string | null,
		errorClass?: string,
	): void {
		if (!FAILURE_OUTCOMES.has(outcome)) {
			return;
		}

		// Keyed by the outcome, a bounded set: one line per outcome and interval.
		if (this.failureLog.consume(outcome).log) {
			this.logger.warn(
				`UniFi Protect command failed (${outcome}) property=${propertyId} mapping=${mappingName ?? 'unknown'}${errorClass === undefined ? '' : ` error=${errorClass}`}`,
			);
		}
	}
}
