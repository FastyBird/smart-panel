import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { StorageService } from '../../storage/services/storage.service';
import { ConnectionState, DISPLAYS_MODULE_NAME, OnlineDisplayState } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

@Injectable()
export class DisplayConnectionStateService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'DisplayConnectionStateService');

	private statusMap: Map<DisplayEntity['id'], { online: boolean; status: ConnectionState }> = new Map();

	constructor(private readonly storageService: StorageService) {}

	async write(display: DisplayEntity, status: ConnectionState): Promise<void> {
		if (this.statusMap.has(display.id) && this.statusMap.get(display.id)?.status === status) {
			// no change → skip storage write
			return;
		}

		const isOnline = OnlineDisplayState.includes(status);

		// Update local cache regardless of storage availability
		this.statusMap.set(display.id, { online: isOnline, status });

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			await this.storageService.writePoints([
				{
					measurement: 'display_status',
					tags: { displayId: display.id },
					fields: {
						online: isOnline,
						onlineI: isOnline ? 1 : 0,
						status,
					},
					timestamp: new Date(),
				},
			]);

			this.logger.debug(`Status saved id=${display.id} status=${status}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to write status to storage id=${display.id} error=${err.message}`, err.stack);
		}
	}

	async readLatest(display: DisplayEntity): Promise<{ online: boolean; status: ConnectionState }> {
		// Check local cache first
		if (this.statusMap.has(display.id)) {
			this.logger.debug(
				`Loaded cached status for display id=${display.id}, status=${this.statusMap.get(display.id)?.status}`,
			);

			return this.statusMap.get(display.id);
		}

		// Return default if storage not connected
		if (!this.storageService.isConnected()) {
			return {
				online: false,
				status: ConnectionState.UNKNOWN,
			};
		}

		try {
			const query = `
        SELECT * FROM display_status
        WHERE displayId = '${display.id}'
        ORDER BY time DESC
        LIMIT 1
      `;

			this.logger.debug(`Fetching latest status id=${display.id}`);

			const result = await this.storageService.query<{
				online: boolean;
				onlineI: number;
				status: ConnectionState;
				displayId: DisplayEntity['id'];
			}>(query);

			if (!result.length) {
				this.logger.debug(`No stored status found for id=${display.id}`);

				return {
					online: false,
					status: ConnectionState.UNKNOWN,
				};
			}

			const latest = result[0];

			this.logger.debug(`Read latest value id=${display.id} status=${latest.status}`);

			this.statusMap.set(display.id, { online: latest.online, status: latest.status });

			return latest;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read latest status from storage id=${display.id} error=${err.message}`, err.stack);

			return {
				online: false,
				status: ConnectionState.UNKNOWN,
			};
		}
	}

	async delete(display: DisplayEntity): Promise<void> {
		// Always clear local cache
		this.statusMap.delete(display.id);

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM display_status WHERE displayId = '${display.id}'`;

			await this.storageService.query(query);

			this.logger.log(`Deleted display status for id=${display.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to delete display status from storage id=${display.id} error=${err.message}`,
				err.stack,
			);
		}
	}
}
