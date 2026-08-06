import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { StorageService } from '../../storage/services/storage.service';
import { ConnectionState, DEVICES_MODULE_NAME, OnlineDeviceState, PropertyCategory } from '../devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

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

@Injectable()
export class DeviceConnectionStateService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceConnectionStateService');

	private statusMap: Map<DeviceEntity['id'], { online: boolean; status: ConnectionState; lastChanged: Date }> =
		new Map();
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

	async write(device: DeviceEntity, property: ChannelPropertyEntity, status: ConnectionState): Promise<void> {
		if (property.category !== PropertyCategory.STATUS) {
			this.logger.error(`Failed to write device provided property if=${property.id} is not device status property`, {
				resource: device.id,
			});

			return;
		}

		if (this.statusMap.has(device.id) && this.statusMap.get(device.id).status === status) {
			// no change → skip storage write
			return;
		}

		const isOnline = OnlineDeviceState.includes(status);
		const lastChanged = new Date();

		// Update local cache regardless of storage availability
		this.statusMap.set(device.id, { online: isOnline, status, lastChanged });
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

	async readLatestManyStrict(
		devices: Array<Pick<DeviceEntity, 'id'>>,
	): Promise<Map<DeviceEntity['id'], DeviceConnectionStateValue>> {
		const statuses = new Map<DeviceEntity['id'], DeviceConnectionStateValue>();
		const missingIds: DeviceEntity['id'][] = [];

		for (const device of devices) {
			const cached = this.statusMap.get(device.id);

			if (cached) {
				statuses.set(device.id, cached);
			} else {
				missingIds.push(device.id);
			}
		}

		if (missingIds.length === 0) {
			return statuses;
		}
		if (!this.storageService.isConnected()) {
			throw new Error('Device connection status storage is unavailable');
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

		try {
			const rows = await this.storageService.query<DeviceStatusRow>(query);
			const rowByDevice = new Map(rows.map((row) => [row.deviceId, row]));

			for (const id of missingIds) {
				const row = rowByDevice.get(id);
				const status = row ? this.toStatus(row) : this.unknownStatus();
				this.statusMap.set(id, status);
				statuses.set(id, status);
			}

			return statuses;
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to batch read device statuses from storage error=${err.message}`, {
				stack: err.stack,
			});

			throw error;
		}
	}

	private async readLatestInternal(
		device: Pick<DeviceEntity, 'id'>,
		strict: boolean,
	): Promise<DeviceConnectionStateValue> {
		// Check local cache first
		if (this.statusMap.has(device.id)) {
			this.logger.debug(
				`Loaded cached status for device id=${device.id}, status=${this.statusMap.get(device.id)?.status}`,
				{ resource: device.id },
			);

			return this.statusMap.get(device.id);
		}

		// Return default if storage not connected
		if (!this.storageService.isConnected()) {
			if (strict) {
				throw new Error('Device connection status storage is unavailable');
			}

			return this.unknownStatus();
		}

		try {
			const query = `
        SELECT * FROM device_status
        WHERE deviceId = '${device.id}'
        ORDER BY time DESC
        LIMIT 1
      `;

			this.logger.debug(`Fetching latest status id=${device.id}`, { resource: device.id });

			const result = await this.storageService.query<DeviceStatusRow>(query);

			if (!result.length) {
				this.logger.debug(`No stored status found for id=${device.id}`, { resource: device.id });

				return this.unknownStatus();
			}

			const latest = result[0];
			const connectionState = this.toStatus(latest);

			this.logger.debug(`Read latest value id=${device.id} status=${latest.status}`, { resource: device.id });

			this.statusMap.set(device.id, connectionState);
			if (latest.propertyId) {
				this.statusPropertyMap.set(device.id, latest.propertyId);
			}

			return connectionState;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read latest status from storage id=${device.id} error=${err.message}`, {
				resource: device.id,
				stack: err.stack,
			});

			if (strict) {
				throw error;
			}

			return this.unknownStatus();
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
		// Always clear local cache
		this.statusMap.delete(device.id);
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
		// Always clear local cache
		const deviceId = [...this.statusPropertyMap.entries()].find(([_, val]) => val === property.id)?.[0];

		if (typeof deviceId !== 'undefined') {
			this.statusMap.delete(deviceId);
			this.statusPropertyMap.delete(deviceId);
		}

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM device_status WHERE propertyId = '${property.id}'`;

			await this.storageService.query(query);

			this.logger.log(
				`Deleted device status for propertyId=${property.id}${deviceId ? ` deviceId=${deviceId}` : ''}`,
				deviceId ? { resource: deviceId } : {},
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to delete device status from storage propertyId=${property.id} error=${err.message}`, {
				...(deviceId ? { resource: deviceId } : {}),
				stack: err.stack,
			});
		}
	}
}
