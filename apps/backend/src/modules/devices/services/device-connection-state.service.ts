import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { type CreationStorageDestinations, StorageService } from '../../storage/services/storage.service';
import { ConnectionState, DEVICES_MODULE_NAME, OnlineDeviceState, PropertyCategory } from '../devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import {
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	ReadCacheObservation,
	creationHasDataMethod,
	creationMethodCurrent,
	originalReadCacheApi,
} from './device-creation-context';

export interface DeviceConnectionStateValue {
	online: boolean;
	status: ConnectionState;
	lastChanged: Date | null;
}

interface DeviceStatusRow {
	time?: Date | string;
	online?: boolean;
	onlineI?: number;
	status?: ConnectionState;
	deviceId: DeviceEntity['id'];
	propertyId?: ChannelPropertyEntity['id'];
}

type ReadReceiverCall<Receiver, Args extends unknown[], Result> = Readonly<{
	call: (receiver: Receiver, ...args: Args) => Result;
}>;
const stateStoragePrototype: Readonly<{
	captureCreationDestinations: () => CreationStorageDestinations;
	areCreationDestinationsCurrent: (capture: CreationStorageDestinations) => boolean;
}> = StorageService.prototype;
const stateStorageReadMethods: Readonly<{
	capture: ReadReceiverCall<StorageService, [], CreationStorageDestinations>;
	check: ReadReceiverCall<StorageService, [capture: CreationStorageDestinations], boolean>;
}> = Object.freeze({
	capture: stateStoragePrototype.captureCreationDestinations,
	check: stateStoragePrototype.areCreationDestinationsCurrent,
});
interface StatusReadObservation {
	readonly token: ReadCacheObservation;
	readonly queries: Readonly<{
		query: ReadReceiverCall<StorageService, [query: string], Promise<DeviceStatusRow[]>>;
		queryStrict: ReadReceiverCall<StorageService, [query: string], Promise<DeviceStatusRow[]>>;
	}>;
	readonly current: () => boolean;
}
@Injectable()
export class DeviceConnectionStateService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceConnectionStateService');

	private statusMap: Map<DeviceEntity['id'], DeviceConnectionStateValue> = new Map();
	private readonly statusProvenance = new Map<
		string,
		Readonly<{
			entry: DeviceConnectionStateValue;
			kind: 'reported' | 'owned' | 'historical';
			lease?: DeviceCreationPublicationLease;
		}>
	>();

	private statusPropertyMap: Map<DeviceEntity['id'], ChannelPropertyEntity['id']> = new Map();

	constructor(private readonly storageService: StorageService) {}

	/**
	 * Returns the number of currently-registered devices that are online.
	 *
	 * Merges two data sources so the count is accurate at every stage:
	 * 1. In-memory cache — authoritative for devices that have already
	 *    reported since this process started.
	 * 2. Storage `device_status_1m` (14-day RP) — fills gaps for devices
	 *    that haven't reported yet (cold-start / slow-syncing plugins).
	 *
	 * Only device IDs present in [currentDeviceIds] are counted, which
	 * filters out ghost entries for deleted/re-created devices in storage.
	 */
	async getOnlineCountForDevices(currentDeviceIds: Set<DeviceEntity['id']>): Promise<number> {
		let count = 0;
		const accountedFor = new Set<DeviceEntity['id']>();

		// Phase 1 — count from in-memory cache (most up-to-date)
		for (const id of currentDeviceIds) {
			if (this.statusMap.has(id)) {
				accountedFor.add(id);

				if (this.statusMap.get(id).online) {
					count++;
				}
			}
		}

		// All current devices are cached — no need for storage
		if (accountedFor.size === currentDeviceIds.size) {
			return count;
		}

		// Phase 2 — fill gaps from storage for devices not yet in cache
		if (!this.storageService.isConnected()) {
			return count;
		}

		try {
			const query = `
				SELECT LAST("onlineI") AS "onlineI"
				FROM "min_14d"."device_status_1m"
				GROUP BY "deviceId"
			`;

			const rows = await this.storageService.query<{ onlineI: number; deviceId?: string }>(query);

			for (const r of rows ?? []) {
				if (!r.deviceId) continue;

				// Only count if it's a current device AND not already counted from cache
				if (currentDeviceIds.has(r.deviceId) && !accountedFor.has(r.deviceId)) {
					if (Number(r.onlineI ?? 0) > 0) {
						count++;
					}
				}
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to query online count from storage: ${err.message}`, {
				stack: err.stack,
			});
		}

		return count;
	}

	private observeStatusRead(id: string): StatusReadObservation {
		if (
			!creationHasDataMethod(this.storageService, 'query') ||
			!creationHasDataMethod(this.storageService, 'queryStrict')
		)
			throw new Error('Original backend read methods unavailable');
		const view: Readonly<{
			query: (query: string) => Promise<DeviceStatusRow[]>;
			queryStrict: (query: string) => Promise<DeviceStatusRow[]>;
		}> = this.storageService;
		const methods: StatusReadObservation['queries'] = { query: view.query, queryStrict: view.queryStrict };
		let destinations: CreationStorageDestinations | undefined;
		if (
			creationMethodCurrent(this.storageService, 'captureCreationDestinations', stateStorageReadMethods.capture) &&
			creationMethodCurrent(this.storageService, 'areCreationDestinationsCurrent', stateStorageReadMethods.check)
		)
			destinations = stateStorageReadMethods.capture.call(this.storageService);
		const token = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, id, true);
		return {
			token,
			queries: methods,
			current: () =>
				originalReadCacheApi.current() &&
				destinations !== undefined &&
				creationMethodCurrent(this.storageService, 'captureCreationDestinations', stateStorageReadMethods.capture) &&
				creationMethodCurrent(this.storageService, 'areCreationDestinationsCurrent', stateStorageReadMethods.check) &&
				creationMethodCurrent(this.storageService, 'query', methods.query) &&
				creationMethodCurrent(this.storageService, 'queryStrict', methods.queryStrict) &&
				stateStorageReadMethods.check.call(this.storageService, destinations),
		};
	}
	private currentReportedStatus(id: string): DeviceConnectionStateValue {
		const entry = this.statusMap.get(id);
		const provenance = this.statusProvenance.get(id);
		if (!entry || provenance?.entry !== entry || provenance.kind === 'historical') return this.unknownStatus();
		if (provenance.kind === 'owned') {
			try {
				if (
					!provenance.lease ||
					!originalReadCacheApi.createdCurrent.call(originalReadCacheApi.receiver, provenance.lease)
				)
					return this.unknownStatus();
			} catch {
				return this.unknownStatus();
			}
		}
		return entry;
	}
	private setStatusCache(
		id: string,
		entry: DeviceConnectionStateValue,
		kind: 'reported' | 'owned' | 'historical',
		lease?: DeviceCreationPublicationLease,
	): void {
		originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, [id]);
		this.statusMap.set(id, entry);
		this.statusProvenance.set(id, { entry, kind, lease });
	}
	captureCreatedMethodGuard(): () => boolean {
		const pins: Readonly<{ receiver: object; key: string; method: unknown }>[] = [];
		for (const { receiver, keys } of [
			{ receiver: this, keys: ['readCreated', 'writeCreated', 'setStatusCache'] },
			{ receiver: this.storageService, keys: ['writeCreatedPoints'] },
		])
			for (const key of keys) {
				if (!creationHasDataMethod(receiver, key)) throw new Error('Original connection state pipeline unavailable');
				const method: unknown = Reflect.get(receiver, key);
				pins.push(Object.freeze({ receiver, key, method }));
			}
		return () => pins.every(({ receiver, key, method }) => creationMethodCurrent(receiver, key, method));
	}

	/** No historical lookup can substitute a successor's status for original committed A. */
	readCreated(lease: DeviceCreationPublicationLease, device: DeviceEntity): DeviceConnectionStateValue {
		DeviceCreationPublicationEngine.assert(lease);
		if (device !== DeviceCreationPublicationEngine.catalog(lease))
			throw new Error('Exact original device snapshot required');
		const id = device.id;
		DeviceCreationPublicationEngine.assert(lease, id);
		// This closed path initializes a NEW incarnation. A cache keyed only by ID may predate it;
		// it is never evidence about the original newly committed catalog.
		return this.unknownStatus();
	}

	async writeCreated(
		lease: DeviceCreationPublicationLease,
		device: DeviceEntity,
		property: ChannelPropertyEntity,
		status: ConnectionState,
		destinations: CreationStorageDestinations,
	): Promise<void> {
		DeviceCreationPublicationEngine.assert(lease);
		if (device !== DeviceCreationPublicationEngine.catalog(lease))
			throw new Error('Exact original device snapshot required');
		const id = device.id;
		const propertyId = property.id;
		DeviceCreationPublicationEngine.assert(lease, id, propertyId);
		if (property.category !== PropertyCategory.STATUS) throw new Error('Original creation status property required');
		const child = DeviceCreationPublicationEngine.beginChild(lease, 'state', id);
		let failure: { cause: unknown } | undefined;
		try {
			await DeviceCreationPublicationEngine.probe(lease, propertyId);
			DeviceCreationPublicationEngine.assertProperty(lease, property);
			const online = OnlineDeviceState.includes(status);
			const lastChanged = new Date();
			const point = {
				measurement: 'device_status',
				tags: { deviceId: id, propertyId },
				fields: { online, onlineI: online ? 1 : 0, status },
				timestamp: lastChanged,
			};
			DeviceCreationPublicationEngine.assert(lease, id, propertyId);
			this.setStatusCache(id, { online, status, lastChanged }, 'owned', lease);
			this.statusPropertyMap.set(id, propertyId);
			await this.storageService.writeCreatedPoints(lease, destinations, [point]);
			DeviceCreationPublicationEngine.assert(lease, id, propertyId);
		} catch (cause) {
			failure = { cause };
			throw cause;
		} finally {
			child.finish(failure);
		}
	}

	async write(device: DeviceEntity, property: ChannelPropertyEntity, status: ConnectionState): Promise<void> {
		DeviceCreationPublicationEngine.invalidateIds([device.id, property.id]);
		if (property.category !== PropertyCategory.STATUS) {
			this.logger.error(`Failed to write device provided property if=${property.id} is not device status property`, {
				resource: device.id,
			});

			return;
		}

		if (this.statusMap.has(device.id) && this.statusMap.get(device.id).status === status) {
			const entry = this.statusMap.get(device.id);
			if (entry) this.statusProvenance.set(device.id, { entry, kind: 'reported' });
			// no change → skip storage write
			return;
		}

		const isOnline = OnlineDeviceState.includes(status);
		const lastChanged = new Date();

		// Update local cache regardless of storage availability
		DeviceCreationPublicationEngine.invalidateIds([device.id]);
		this.setStatusCache(device.id, { online: isOnline, status, lastChanged }, 'reported');
		DeviceCreationPublicationEngine.invalidateIds([device.id]);
		this.statusPropertyMap.set(device.id, property.id);

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			await this.storageService.writePoints([
				{
					measurement: 'device_status',
					tags: { deviceId: device.id, propertyId: property.id },
					fields: {
						online: isOnline,
						onlineI: isOnline ? 1 : 0,
						status,
					},
					timestamp: new Date(),
				},
			]);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to write status to storage id=${device.id} error=${err.message}`, {
				resource: device.id,
				stack: err.stack,
			});
		}
	}

	/**
	 * Latest known connection state for a device, cache-first.
	 *
	 * Takes only the device's id (`Pick<DeviceEntity, 'id'>`) because that is all it reads — callers
	 * holding a full entity pass it unchanged, while callers that only know an id (the virtual
	 * devices plugin aggregating over its source device ids) do not have to load one just to ask.
	 */
	async readLatest(device: Pick<DeviceEntity, 'id'>): Promise<DeviceConnectionStateValue> {
		return this.readLatestInternal(device, false);
	}

	async readLatestStrict(device: Pick<DeviceEntity, 'id'>): Promise<DeviceConnectionStateValue> {
		return this.readLatestInternal(device, true);
	}

	async readLatestMany(
		devices: Array<Pick<DeviceEntity, 'id'>>,
	): Promise<Map<DeviceEntity['id'], DeviceConnectionStateValue>> {
		return this.readLatestManyInternal(devices, false);
	}

	async readLatestManyStrict(
		devices: Array<Pick<DeviceEntity, 'id'>>,
	): Promise<Map<DeviceEntity['id'], DeviceConnectionStateValue>> {
		return this.readLatestManyInternal(devices, true);
	}

	private async readLatestManyInternal(
		devices: Array<Pick<DeviceEntity, 'id'>>,
		strict: boolean,
	): Promise<Map<DeviceEntity['id'], DeviceConnectionStateValue>> {
		const statuses = new Map<DeviceEntity['id'], DeviceConnectionStateValue>();
		const missingIds: DeviceEntity['id'][] = [];

		for (const device of devices) {
			const id = device.id;
			const cached = this.statusMap.get(id);

			if (cached) {
				const token = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, id, true);
				try {
					const current = originalReadCacheApi.current();
					const reported = this.currentReportedStatus(id);
					const owned = this.statusProvenance.get(id)?.kind === 'owned';
					const decision = originalReadCacheApi.finish.call(originalReadCacheApi.receiver, token);
					statuses.set(
						id,
						current && decision === 'publish' ? cached : current && owned ? reported : this.unknownStatus(),
					);
				} finally {
					originalReadCacheApi.close.call(originalReadCacheApi.receiver, token);
				}
			} else {
				missingIds.push(id);
			}
		}

		if (missingIds.length === 0) {
			return statuses;
		}
		if (!this.storageService.isConnected()) {
			if (strict) {
				throw new Error('Device connection status storage is unavailable');
			}

			for (const id of missingIds) {
				statuses.set(id, this.statusMap.get(id) ?? this.unknownStatus());
			}

			return statuses;
		}

		const predicate = missingIds.map((id) => `deviceId = '${this.escapeTagValue(id)}'`).join(' OR ');
		const query = `
        SELECT *
        FROM device_status
        WHERE (${predicate})
        GROUP BY "deviceId"
		ORDER BY time DESC
		LIMIT 1
      `;

		const observations = new Map<string, ReturnType<DeviceConnectionStateService['observeStatusRead']>>();
		try {
			for (const id of missingIds) observations.set(id, this.observeStatusRead(id));
			const iterator: Readonly<{ next: () => Readonly<{ value?: StatusReadObservation }> }> = observations.values();
			const first = iterator.next().value;
			if (!first) throw new Error('Original status query unavailable');
			const rows = await first.queries.queryStrict.call(this.storageService, query);
			const rowByDevice = new Map(rows.map((row) => [row.deviceId, row]));
			for (const id of missingIds) {
				const observation = observations.get(id);
				if (!observation) throw new Error('Original status read unavailable');
				const row = rowByDevice.get(id);
				const status = row ? this.toStatus(row) : this.unknownStatus();
				const binding = { empty: row === undefined, deviceId: row?.deviceId, propertyId: row?.propertyId };
				const current = observation.current();
				const reported = this.currentReportedStatus(id);
				const decision = originalReadCacheApi.finish.call(originalReadCacheApi.receiver, observation.token, binding);
				if (!current) {
					statuses.set(id, this.unknownStatus());
					continue;
				}
				if (decision !== 'publish') {
					statuses.set(id, reported);
					continue;
				}
				DeviceCreationPublicationEngine.invalidateIds([id]);
				this.setStatusCache(id, status, 'historical');
				statuses.set(id, status);
			}
			return statuses;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`Failed to batch read device statuses from storage error=${err.message}`, { stack: err.stack });
			if (strict) throw error;
			for (const id of missingIds) statuses.set(id, this.currentReportedStatus(id));
			return statuses;
		} finally {
			for (const observation of observations.values())
				originalReadCacheApi.close.call(originalReadCacheApi.receiver, observation.token);
		}
	}

	private async readLatestInternal(
		device: Pick<DeviceEntity, 'id'>,
		strict: boolean,
	): Promise<DeviceConnectionStateValue> {
		const id = device.id;
		// Check local cache first
		if (this.statusMap.has(id)) {
			this.logger.debug(`Loaded cached status for device id=${id}, status=${this.statusMap.get(id)?.status}`, {
				resource: id,
			});

			const token = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, id, true);
			try {
				const current = originalReadCacheApi.current();
				const reported = this.currentReportedStatus(id);
				const cached = this.statusMap.get(id);
				const owned = this.statusProvenance.get(id)?.kind === 'owned';
				const decision = originalReadCacheApi.finish.call(originalReadCacheApi.receiver, token);
				return current && decision === 'publish' ? cached : current && owned ? reported : this.unknownStatus();
			} finally {
				originalReadCacheApi.close.call(originalReadCacheApi.receiver, token);
			}
		}

		// Return default if storage not connected
		if (!this.storageService.isConnected()) {
			if (strict) {
				throw new Error('Device connection status storage is unavailable');
			}

			return this.unknownStatus();
		}

		let observation: ReturnType<DeviceConnectionStateService['observeStatusRead']> | undefined;
		try {
			observation = this.observeStatusRead(id);
			const query = `
        SELECT * FROM device_status
        WHERE deviceId = '${id}'
        ORDER BY time DESC
        LIMIT 1
      `;
			this.logger.debug(`Fetching latest status id=${id}`, { resource: id });
			const queryMethod = strict ? observation.queries.queryStrict : observation.queries.query;
			const result = await queryMethod.call(this.storageService, query);
			const latest = result[0];
			const status = latest ? this.toStatus(latest) : this.unknownStatus();
			const propertyId = latest?.propertyId;
			const binding = { empty: latest === undefined, deviceId: latest?.deviceId, propertyId };
			const current = observation.current();
			const reported = this.currentReportedStatus(id);
			const decision = originalReadCacheApi.finish.call(originalReadCacheApi.receiver, observation.token, binding);
			if (!current) return this.unknownStatus();
			if (decision !== 'publish') return reported;
			DeviceCreationPublicationEngine.invalidateIds([id]);
			this.setStatusCache(id, status, 'historical');
			if (propertyId) {
				DeviceCreationPublicationEngine.invalidateIds([id]);
				this.statusPropertyMap.set(id, propertyId);
			}
			return status;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error(`Failed to read latest status from storage id=${id} error=${err.message}`, {
				resource: id,
				stack: err.stack,
			});
			if (strict) throw error;
			return this.currentReportedStatus(id);
		} finally {
			if (observation) originalReadCacheApi.close.call(originalReadCacheApi.receiver, observation.token);
		}
	}

	private toStatus(row: DeviceStatusRow): DeviceConnectionStateValue {
		return {
			online: row.online ?? Number(row.onlineI ?? 0) > 0,
			status: row.status ?? ConnectionState.UNKNOWN,
			lastChanged: row.time ? new Date(row.time) : null,
		};
	}

	private unknownStatus(): DeviceConnectionStateValue {
		return { online: false, status: ConnectionState.UNKNOWN, lastChanged: null };
	}

	private escapeTagValue(value: string): string {
		return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
	}

	async delete(device: DeviceEntity): Promise<void> {
		DeviceCreationPublicationEngine.invalidateIds([device.id]);
		// Always clear local cache
		this.statusMap.delete(device.id);
		this.statusProvenance.delete(device.id);
		this.statusPropertyMap.delete(device.id);

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM device_status WHERE deviceId = '${device.id}'`;

			await this.storageService.query(query);

			this.logger.log(`Deleted device status for id=${device.id}`, { resource: device.id });
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to delete device status from storage id=${device.id} error=${err.message}`, {
				resource: device.id,
				stack: err.stack,
			});
		}
	}

	async deleteByProperty(property: ChannelPropertyEntity): Promise<void> {
		const propertyId = property.id;
		originalReadCacheApi.deleted.call(originalReadCacheApi.receiver, propertyId);
		DeviceCreationPublicationEngine.invalidateIds([propertyId]);
		// Always clear local cache
		const deviceId = [...this.statusPropertyMap.entries()].find(([_, val]) => val === propertyId)?.[0];

		if (typeof deviceId !== 'undefined') {
			DeviceCreationPublicationEngine.invalidateIds([deviceId]);
			this.statusMap.delete(deviceId);
			this.statusProvenance.delete(deviceId);
			this.statusPropertyMap.delete(deviceId);
		}

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM device_status WHERE propertyId = '${propertyId}'`;

			await this.storageService.query(query);

			this.logger.log(
				`Deleted device status for propertyId=${propertyId}${deviceId ? ` deviceId=${deviceId}` : ''}`,
				deviceId ? { resource: deviceId } : {},
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to delete device status from storage propertyId=${propertyId} error=${err.message}`, {
				...(deviceId ? { resource: deviceId } : {}),
				stack: err.stack,
			});
		}
	}
}
