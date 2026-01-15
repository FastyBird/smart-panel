import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { INTENTS_MODULE_NAME, IntentStatus, IntentTargetStatus, IntentType } from '../intents.constants';
import { IntentRecord } from '../models/intent.model';

/**
 * Space intent record stored in InfluxDB for historical tracking.
 * Used to track lighting/climate mode changes per space.
 */
export interface SpaceIntentRecord {
	intentId: string;
	spaceId: string;
	intentType: IntentType;
	status: IntentStatus;
	mode: string | null;
	targetsCount: number;
	successCount: number;
	failedCount: number;
	timestamp: Date;
}

/**
 * Last applied mode for a space
 */
export interface LastAppliedMode {
	mode: string;
	intentId: string;
	appliedAt: Date;
	status: IntentStatus;
}

/**
 * Service for persisting intent events to InfluxDB.
 * Enables historical tracking and recovery of last applied modes.
 */
@Injectable()
export class IntentTimeseriesService {
	private readonly logger = createExtensionLogger(INTENTS_MODULE_NAME, 'IntentTimeseriesService');

	constructor(private readonly influxDbService: InfluxDbService) {}

	/**
	 * Store an intent completion event to InfluxDB.
	 * Only stores intents that have a spaceId context and relevant mode information.
	 */
	async storeIntentCompletion(intent: IntentRecord): Promise<void> {
		// Only store intents with space context
		if (!intent.context?.spaceId) {
			this.logger.debug(`Skipping intent storage - no spaceId context intentId=${intent.id}`);
			return;
		}

		// Only store completed intents (successful or partial)
		if (intent.status !== IntentStatus.COMPLETED_SUCCESS && intent.status !== IntentStatus.COMPLETED_PARTIAL) {
			this.logger.debug(
				`Skipping intent storage - not completed successfully intentId=${intent.id} status=${intent.status}`,
			);
			return;
		}

		// Only store space-level intents (lighting/climate modes)
		if (!this.isSpaceLevelIntent(intent.type)) {
			this.logger.debug(`Skipping intent storage - not a space-level intent intentId=${intent.id} type=${intent.type}`);
			return;
		}

		// Extract mode from intent value
		const mode = this.extractModeFromValue(intent.value);

		// Calculate success/failure counts
		const successCount = intent.results?.filter((r) => r.status === IntentTargetStatus.SUCCESS).length ?? 0;
		const failedCount = intent.results?.filter((r) => r.status === IntentTargetStatus.FAILED).length ?? 0;

		if (!this.influxDbService.isConnected()) {
			this.logger.warn(`InfluxDB not connected - intent not persisted intentId=${intent.id}`);
			return;
		}

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'space_intent',
					tags: {
						spaceId: intent.context.spaceId,
						intentType: intent.type,
						status: intent.status,
					},
					fields: {
						intentId: intent.id,
						mode: mode ?? '',
						targetsCount: intent.targets.length,
						successCount,
						failedCount,
					},
					timestamp: intent.completedAt ?? new Date(),
				},
			]);

			this.logger.debug(
				`Intent stored intentId=${intent.id} spaceId=${intent.context.spaceId} type=${intent.type} mode=${mode ?? 'none'}`,
			);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to store intent to InfluxDB intentId=${intent.id} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Query the last applied lighting mode for a space.
	 */
	async getLastLightingMode(spaceId: string): Promise<LastAppliedMode | null> {
		return this.getLastAppliedModeByType(spaceId, 'lighting.setMode');
	}

	/**
	 * Query the last applied climate mode for a space.
	 */
	async getLastClimateMode(spaceId: string): Promise<LastAppliedMode | null> {
		return this.getLastAppliedModeByType(spaceId, 'climate.setMode');
	}

	/**
	 * Query last applied mode from InfluxDB for a specific intent type string.
	 */
	private async getLastAppliedModeByType(spaceId: string, intentType: string): Promise<LastAppliedMode | null> {
		if (!this.influxDbService.isConnected()) {
			this.logger.debug(`InfluxDB not connected - cannot query last mode for spaceId=${spaceId}`);
			return null;
		}

		const query = `
			SELECT intentId, mode, status
			FROM space_intent
			WHERE spaceId = '${spaceId}'
			AND intentType = '${intentType}'
			AND mode != ''
			AND (status = '${IntentStatus.COMPLETED_SUCCESS}' OR status = '${IntentStatus.COMPLETED_PARTIAL}')
			ORDER BY time DESC
			LIMIT 1
		`
			.trim()
			.replace(/\s+/g, ' ');

		try {
			const result = await this.influxDbService.query<{
				time: { _nanoISO: string };
				intentId: string;
				mode: string;
				status: IntentStatus;
			}>(query);

			if (!result.length || !result[0].mode) {
				this.logger.debug(`No last ${intentType} mode found for spaceId=${spaceId}`);
				return null;
			}

			const row = result[0];

			return {
				mode: row.mode,
				intentId: row.intentId || '',
				appliedAt: new Date(row.time._nanoISO),
				status: row.status,
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(
				`Failed to query last ${intentType} mode from InfluxDB spaceId=${spaceId} error=${err.message}`,
				err.stack,
			);
			return null;
		}
	}

	/**
	 * Query intent history for a space within a time range.
	 */
	async getIntentHistory(
		spaceId: string,
		from: Date,
		to: Date,
		intentTypes?: IntentType[],
	): Promise<SpaceIntentRecord[]> {
		if (!this.influxDbService.isConnected()) {
			this.logger.debug(`InfluxDB not connected - cannot query history for spaceId=${spaceId}`);
			return [];
		}

		let whereClause = `spaceId = '${spaceId}' AND time >= ${from.getTime()}ms AND time <= ${to.getTime()}ms`;

		if (intentTypes && intentTypes.length > 0) {
			const typeFilter = intentTypes.map((t) => `intentType = '${t}'`).join(' OR ');
			whereClause += ` AND (${typeFilter})`;
		}

		const query = `
			SELECT intentId, mode, targetsCount, successCount, failedCount
			FROM space_intent
			WHERE ${whereClause}
			ORDER BY time DESC
		`
			.trim()
			.replace(/\s+/g, ' ');

		try {
			const result = await this.influxDbService.query<{
				time: { _nanoISO: string };
				intentId: string;
				mode: string;
				targetsCount: number;
				successCount: number;
				failedCount: number;
				intentType: IntentType;
				status: IntentStatus;
			}>(query);

			return result.map((row) => ({
				intentId: row.intentId,
				spaceId,
				intentType: row.intentType,
				status: row.status,
				mode: row.mode || null,
				targetsCount: row.targetsCount,
				successCount: row.successCount,
				failedCount: row.failedCount,
				timestamp: new Date(row.time._nanoISO),
			}));
		} catch (error) {
			const err = error as Error;
			this.logger.error(
				`Failed to query intent history from InfluxDB spaceId=${spaceId} error=${err.message}`,
				err.stack,
			);
			return [];
		}
	}

	/**
	 * Store a lighting mode change directly (without full intent record).
	 * Called by LightingIntentService after successfully applying a mode.
	 */
	async storeLightingModeChange(
		spaceId: string,
		mode: string,
		targetsCount: number,
		successCount: number,
		failedCount: number,
	): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			this.logger.warn(`InfluxDB not connected - lighting mode not persisted spaceId=${spaceId}`);
			return;
		}

		// Only store if at least some targets succeeded
		if (successCount === 0) {
			this.logger.debug(`Skipping lighting mode storage - no successful targets spaceId=${spaceId}`);
			return;
		}

		const status = failedCount === 0 ? IntentStatus.COMPLETED_SUCCESS : IntentStatus.COMPLETED_PARTIAL;

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'space_intent',
					tags: {
						spaceId,
						intentType: 'lighting.setMode',
						status,
					},
					fields: {
						intentId: '', // No intent ID for direct storage
						mode,
						targetsCount,
						successCount,
						failedCount,
					},
					timestamp: new Date(),
				},
			]);

			this.logger.debug(`Lighting mode stored spaceId=${spaceId} mode=${mode} success=${successCount}/${targetsCount}`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to store lighting mode to InfluxDB spaceId=${spaceId} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Store a climate mode/setpoint change directly (without full intent record).
	 * Called by ClimateIntentService after successfully applying a change.
	 */
	async storeClimateModeChange(
		spaceId: string,
		mode: string,
		targetsCount: number,
		successCount: number,
		failedCount: number,
	): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			this.logger.warn(`InfluxDB not connected - climate mode not persisted spaceId=${spaceId}`);
			return;
		}

		// Only store if at least some targets succeeded
		if (successCount === 0) {
			this.logger.debug(`Skipping climate mode storage - no successful targets spaceId=${spaceId}`);
			return;
		}

		const status = failedCount === 0 ? IntentStatus.COMPLETED_SUCCESS : IntentStatus.COMPLETED_PARTIAL;

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'space_intent',
					tags: {
						spaceId,
						intentType: 'climate.setMode',
						status,
					},
					fields: {
						intentId: '', // No intent ID for direct storage
						mode,
						targetsCount,
						successCount,
						failedCount,
					},
					timestamp: new Date(),
				},
			]);

			this.logger.debug(`Climate mode stored spaceId=${spaceId} mode=${mode} success=${successCount}/${targetsCount}`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to store climate mode to InfluxDB spaceId=${spaceId} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Delete all intent history for a space.
	 */
	async deleteSpaceHistory(spaceId: string): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM space_intent WHERE spaceId = '${spaceId}'`;
			await this.influxDbService.query(query);
			this.logger.log(`Deleted intent history for spaceId=${spaceId}`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to delete intent history spaceId=${spaceId} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Check if an intent type is a space-level intent (lighting/climate mode).
	 */
	private isSpaceLevelIntent(type: IntentType): boolean {
		// These are the intent types used for space-level operations
		return [
			IntentType.LIGHT_TOGGLE,
			IntentType.LIGHT_SET_BRIGHTNESS,
			IntentType.LIGHT_SET_COLOR,
			IntentType.LIGHT_SET_COLOR_TEMP,
			IntentType.LIGHT_SET_WHITE,
			IntentType.DEVICE_SET_PROPERTY,
		].includes(type);
	}

	/**
	 * Extract mode from intent value.
	 * Handles different value structures for lighting and climate intents.
	 */
	private extractModeFromValue(value: unknown): string | null {
		if (!value) {
			return null;
		}

		// Value could be { mode: 'work' } or a map of property values
		if (typeof value === 'object' && value !== null) {
			const obj = value as Record<string, unknown>;

			// Direct mode property
			if (typeof obj.mode === 'string') {
				return obj.mode;
			}

			// Try to find mode in nested structure
			if (typeof obj.lightingMode === 'string') {
				return obj.lightingMode;
			}

			if (typeof obj.climateMode === 'string') {
				return obj.climateMode;
			}
		}

		return null;
	}
}
