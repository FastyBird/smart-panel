import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { MediaMode } from '../../spaces/spaces.constants';
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
 * Mode validity status for a space domain (lighting/covers)
 * Used to track if the current state was achieved via intent or manual changes
 */
export interface ModeValidityStatus {
	modeValid: boolean;
	timestamp: Date;
}

export interface LastAppliedMediaState {
	mode: string | null;
	volume: number | null;
	muted: boolean | null;
	source: string | null;
	intentId: string;
	appliedAt: Date;
	status: IntentStatus;
	intentType: string;
}

/**
 * Last applied climate state for a space (mode + setpoints)
 */
export interface LastAppliedClimateState {
	mode: string | null;
	heatingSetpoint: number | null;
	coolingSetpoint: number | null;
	intentId: string;
	appliedAt: Date;
	status: IntentStatus;
}

/**
 * UUID v4 regex pattern for validation.
 * Matches standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sanitize a string value for use in InfluxQL queries.
 * Escapes special characters to prevent injection attacks.
 *
 * @param value - The string value to sanitize
 * @returns Sanitized string safe for use in InfluxQL string literals
 */
function sanitizeInfluxString(value: string): string {
	// Escape backslashes first (must be done before escaping quotes)
	// Then escape single quotes which are used for string literals in InfluxQL
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Validate that a string is a valid UUID format.
 * Provides defense-in-depth even when controller validation exists.
 *
 * @param value - The string to validate
 * @returns true if valid UUID format, false otherwise
 */
function isValidUuid(value: string): boolean {
	return UUID_PATTERN.test(value);
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
	 * Query the last applied media mode for a space.
	 * Note: Uses full intent type 'space.media.setMode' to match what storeMediaStateChange stores.
	 */
	async getLastMediaMode(spaceId: string): Promise<LastAppliedMode | null> {
		return this.getLastAppliedModeByType(spaceId, 'space.media.setMode');
	}

	/**
	 * Query the last applied media state (mode/volume/muted) for a space.
	 */
	async getLastMediaState(spaceId: string): Promise<LastAppliedMediaState | null> {
		if (!this.influxDbService.isConnected()) {
			this.logger.debug(`InfluxDB not connected - cannot query last media state for spaceId=${spaceId}`);
			return null;
		}

		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected spaceId=${spaceId}`);
			return null;
		}

		const safeSpaceId = sanitizeInfluxString(spaceId);

		const query = `
			SELECT intentId, intentType, mode, volume, muted, source, status
			FROM space_intent
			WHERE spaceId = '${safeSpaceId}'
			AND intentType =~ /space\\.media.*/
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
				intentType: string;
				mode: string;
				volume: number;
				muted: boolean;
				status: IntentStatus;
				source: string | null;
			}>(query);

			if (!result.length) {
				return null;
			}

			const row = result[0];

			return {
				mode: row.mode ?? null,
				volume: row.volume !== undefined && row.volume !== null ? Number(row.volume) : null,
				muted: row.muted !== undefined && row.muted !== null ? Boolean(row.muted) : null,
				source: row.source ?? null,
				intentId: row.intentId || '',
				intentType: row.intentType || '',
				appliedAt: new Date(row.time._nanoISO),
				status: row.status,
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(
				`Failed to query last media state from InfluxDB spaceId=${spaceId} error=${err.message}`,
				err.stack,
			);
			return null;
		}
	}

	/**
	 * Query the last applied climate state (mode + setpoints) for a space.
	 */
	async getLastClimateState(spaceId: string): Promise<LastAppliedClimateState | null> {
		if (!this.influxDbService.isConnected()) {
			this.logger.debug(`InfluxDB not connected - cannot query last climate state for spaceId=${spaceId}`);
			return null;
		}

		// Defense-in-depth: Validate spaceId format even though controllers should validate
		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected spaceId=${spaceId}`);
			return null;
		}

		// Sanitize values to prevent InfluxQL injection
		const safeSpaceId = sanitizeInfluxString(spaceId);

		const query = `
			SELECT intentId, mode, heatingSetpoint, coolingSetpoint, status
			FROM space_intent
			WHERE spaceId = '${safeSpaceId}'
			AND intentType = 'climate.setMode'
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
				heatingSetpoint: number;
				coolingSetpoint: number;
				status: IntentStatus;
			}>(query);

			if (!result.length) {
				this.logger.debug(`No last climate state found for spaceId=${spaceId}`);
				return null;
			}

			const row = result[0];

			return {
				mode: row.mode || null,
				heatingSetpoint: row.heatingSetpoint !== undefined && row.heatingSetpoint !== null ? row.heatingSetpoint : null,
				coolingSetpoint: row.coolingSetpoint !== undefined && row.coolingSetpoint !== null ? row.coolingSetpoint : null,
				intentId: row.intentId || '',
				appliedAt: new Date(row.time._nanoISO),
				status: row.status,
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(
				`Failed to query last climate state from InfluxDB spaceId=${spaceId} error=${err.message}`,
				err.stack,
			);
			return null;
		}
	}

	/**
	 * Query the last applied covers mode for a space.
	 */
	async getLastCoversMode(spaceId: string): Promise<LastAppliedMode | null> {
		return this.getLastAppliedModeByType(spaceId, 'covers.setMode');
	}

	/**
	 * Query last applied mode from InfluxDB for a specific intent type string.
	 */
	private async getLastAppliedModeByType(spaceId: string, intentType: string): Promise<LastAppliedMode | null> {
		if (!this.influxDbService.isConnected()) {
			this.logger.debug(`InfluxDB not connected - cannot query last mode for spaceId=${spaceId}`);
			return null;
		}

		// Defense-in-depth: Validate spaceId format even though controllers should validate
		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected spaceId=${spaceId}`);
			return null;
		}

		// Sanitize values to prevent InfluxQL injection
		const safeSpaceId = sanitizeInfluxString(spaceId);
		const safeIntentType = sanitizeInfluxString(intentType);

		const query = `
			SELECT intentId, mode, status
			FROM space_intent
			WHERE spaceId = '${safeSpaceId}'
			AND intentType = '${safeIntentType}'
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

		// Defense-in-depth: Validate spaceId format even though controllers should validate
		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected spaceId=${spaceId}`);
			return [];
		}

		// Sanitize spaceId to prevent InfluxQL injection
		const safeSpaceId = sanitizeInfluxString(spaceId);

		let whereClause = `spaceId = '${safeSpaceId}' AND time >= ${from.getTime()}ms AND time <= ${to.getTime()}ms`;

		if (intentTypes && intentTypes.length > 0) {
			// Sanitize each intent type value
			const typeFilter = intentTypes.map((t) => `intentType = '${sanitizeInfluxString(t)}'`).join(' OR ');
			whereClause += ` AND (${typeFilter})`;
		}

		const query = `
			SELECT intentId, intentType, status, mode, targetsCount, successCount, failedCount
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
		mode: string | null,
		heatingSetpoint: number | null,
		coolingSetpoint: number | null,
		targetsCount: number,
		successCount: number,
		failedCount: number,
	): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			this.logger.warn(`InfluxDB not connected - climate state not persisted spaceId=${spaceId}`);
			return;
		}

		// Only store if at least some targets succeeded
		if (successCount === 0) {
			this.logger.debug(`Skipping climate state storage - no successful targets spaceId=${spaceId}`);
			return;
		}

		const status = failedCount === 0 ? IntentStatus.COMPLETED_SUCCESS : IntentStatus.COMPLETED_PARTIAL;

		// Build fields object - only include non-null values
		const fields: Record<string, string | number> = {
			intentId: '', // No intent ID for direct storage
			targetsCount,
			successCount,
			failedCount,
		};

		if (mode !== null) {
			fields.mode = mode;
		}
		if (heatingSetpoint !== null) {
			fields.heatingSetpoint = heatingSetpoint;
		}
		if (coolingSetpoint !== null) {
			fields.coolingSetpoint = coolingSetpoint;
		}

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'space_intent',
					tags: {
						spaceId,
						intentType: 'climate.setMode',
						status,
					},
					fields,
					timestamp: new Date(),
				},
			]);

			this.logger.debug(
				`Climate state stored spaceId=${spaceId} mode=${mode ?? 'unchanged'} ` +
					`heatingSetpoint=${heatingSetpoint ?? 'unchanged'} coolingSetpoint=${coolingSetpoint ?? 'unchanged'} ` +
					`success=${successCount}/${targetsCount}`,
			);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to store climate state to InfluxDB spaceId=${spaceId} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Store a covers mode change directly (without full intent record).
	 * Called by CoversIntentService after successfully applying a mode.
	 */
	async storeCoversPositionChange(
		spaceId: string,
		mode: string,
		targetsCount: number,
		successCount: number,
		failedCount: number,
	): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			this.logger.warn(`InfluxDB not connected - covers mode not persisted spaceId=${spaceId}`);
			return;
		}

		// Only store if at least some targets succeeded
		if (successCount === 0) {
			this.logger.debug(`Skipping covers mode storage - no successful targets spaceId=${spaceId}`);
			return;
		}

		const status = failedCount === 0 ? IntentStatus.COMPLETED_SUCCESS : IntentStatus.COMPLETED_PARTIAL;

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'space_intent',
					tags: {
						spaceId,
						intentType: 'covers.setMode',
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

			this.logger.debug(`Covers mode stored spaceId=${spaceId} mode=${mode} success=${successCount}/${targetsCount}`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to store covers mode to InfluxDB spaceId=${spaceId} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Store a media intent state change (mode/volume/muted).
	 * Called by MediaIntentService after successfully applying an intent.
	 */
	async storeMediaStateChange(
		spaceId: string,
		intentType: string,
		state: {
			mode?: MediaMode | null;
			volume?: number | null;
			muted?: boolean | null;
			role?: string | null;
			on?: boolean | null;
			source?: string | null;
		},
	): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			this.logger.warn(`InfluxDB not connected - media intent not persisted spaceId=${spaceId}`);
			return;
		}

		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected spaceId=${spaceId}`);
			return;
		}

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'space_intent',
					tags: {
						spaceId,
						intentType,
						status: IntentStatus.COMPLETED_SUCCESS,
					},
					fields: {
						intentId: '',
						mode: state.mode ?? '',
						volume: state.volume ?? null,
						muted: state.muted ?? null,
						role: state.role ?? '',
						on: state.on ?? null,
						source: state.source ?? null,
						targetsCount: 0,
						successCount: 0,
						failedCount: 0,
					},
					timestamp: new Date(),
				},
			]);

			this.logger.debug(`Media intent stored spaceId=${spaceId} intentType=${intentType}`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to store media state to InfluxDB spaceId=${spaceId} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Delete all intent history for a space.
	 */
	async deleteSpaceHistory(spaceId: string): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			return;
		}

		// Defense-in-depth: Validate spaceId format even though controllers should validate
		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected for deletion spaceId=${spaceId}`);
			return;
		}

		// Sanitize spaceId to prevent InfluxQL injection
		const safeSpaceId = sanitizeInfluxString(spaceId);

		try {
			const query = `DELETE FROM space_intent WHERE spaceId = '${safeSpaceId}'`;
			await this.influxDbService.query(query);
			this.logger.log(`Deleted intent history for spaceId=${spaceId}`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to delete intent history spaceId=${spaceId} error=${err.message}`, err.stack);
		}
	}

	/**
	 * Store mode validity status for a space domain.
	 * Called when an intent is applied (modeValid = true) or when state diverges (modeValid = false).
	 *
	 * @param spaceId - The space ID
	 * @param domain - The domain (lighting/covers)
	 * @param modeValid - Whether the mode is still valid from intent (false = manually changed)
	 */
	async storeModeValidity(spaceId: string, domain: 'lighting' | 'covers', modeValid: boolean): Promise<void> {
		if (!this.influxDbService.isConnected()) {
			this.logger.debug(`InfluxDB not connected - mode validity not stored spaceId=${spaceId}`);
			return;
		}

		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected spaceId=${spaceId}`);
			return;
		}

		try {
			await this.influxDbService.writePoints([
				{
					measurement: 'space_mode_validity',
					tags: {
						spaceId,
						domain,
					},
					fields: {
						modeValid,
					},
					timestamp: new Date(),
				},
			]);

			this.logger.debug(`Mode validity stored spaceId=${spaceId} domain=${domain} modeValid=${modeValid}`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(
				`Failed to store mode validity spaceId=${spaceId} domain=${domain} error=${err.message}`,
				err.stack,
			);
		}
	}

	/**
	 * Query the current mode validity status for a space domain.
	 * Returns true if the mode was set by intent and hasn't been manually changed.
	 */
	async getModeValidity(spaceId: string, domain: 'lighting' | 'covers'): Promise<ModeValidityStatus | null> {
		if (!this.influxDbService.isConnected()) {
			this.logger.debug(`InfluxDB not connected - cannot query mode validity spaceId=${spaceId}`);
			return null;
		}

		if (!isValidUuid(spaceId)) {
			this.logger.warn(`Invalid spaceId format rejected spaceId=${spaceId}`);
			return null;
		}

		const safeSpaceId = sanitizeInfluxString(spaceId);
		const safeDomain = sanitizeInfluxString(domain);

		const query = `
			SELECT modeValid
			FROM space_mode_validity
			WHERE spaceId = '${safeSpaceId}'
			AND domain = '${safeDomain}'
			ORDER BY time DESC
			LIMIT 1
		`
			.trim()
			.replace(/\s+/g, ' ');

		try {
			const result = await this.influxDbService.query<{
				time: { _nanoISO: string };
				modeValid: boolean;
			}>(query);

			if (!result.length) {
				return null;
			}

			const row = result[0];

			return {
				modeValid: row.modeValid,
				timestamp: new Date(row.time._nanoISO),
			};
		} catch (error) {
			const err = error as Error;
			this.logger.error(
				`Failed to query mode validity spaceId=${spaceId} domain=${domain} error=${err.message}`,
				err.stack,
			);
			return null;
		}
	}

	/**
	 * Check if an intent type is a space-level intent.
	 * These intents operate on spaces (rooms) rather than individual devices,
	 * and their completions are stored in InfluxDB for historical tracking.
	 */
	private isSpaceLevelIntent(type: IntentType): boolean {
		return [
			// Lighting domain - space-level operations
			IntentType.SPACE_LIGHTING_ON,
			IntentType.SPACE_LIGHTING_OFF,
			IntentType.SPACE_LIGHTING_SET_MODE,
			IntentType.SPACE_LIGHTING_BRIGHTNESS_DELTA,
			IntentType.SPACE_LIGHTING_ROLE_ON,
			IntentType.SPACE_LIGHTING_ROLE_OFF,
			IntentType.SPACE_LIGHTING_ROLE_BRIGHTNESS,
			IntentType.SPACE_LIGHTING_ROLE_COLOR,
			IntentType.SPACE_LIGHTING_ROLE_COLOR_TEMP,
			IntentType.SPACE_LIGHTING_ROLE_WHITE,
			IntentType.SPACE_LIGHTING_ROLE_SET,
			// Climate domain - space-level operations
			IntentType.SPACE_CLIMATE_SET_MODE,
			IntentType.SPACE_CLIMATE_SETPOINT_SET,
			IntentType.SPACE_CLIMATE_SETPOINT_DELTA,
			IntentType.SPACE_CLIMATE_SET,
			// Covers domain - space-level operations
			IntentType.SPACE_COVERS_OPEN,
			IntentType.SPACE_COVERS_CLOSE,
			IntentType.SPACE_COVERS_STOP,
			IntentType.SPACE_COVERS_SET_POSITION,
			IntentType.SPACE_COVERS_POSITION_DELTA,
			IntentType.SPACE_COVERS_ROLE_POSITION,
			IntentType.SPACE_COVERS_SET_MODE,
			// Media domain - space-level operations
			IntentType.SPACE_MEDIA_POWER_ON,
			IntentType.SPACE_MEDIA_POWER_OFF,
			IntentType.SPACE_MEDIA_VOLUME_SET,
			IntentType.SPACE_MEDIA_VOLUME_DELTA,
			IntentType.SPACE_MEDIA_MUTE,
			IntentType.SPACE_MEDIA_UNMUTE,
			IntentType.SPACE_MEDIA_ROLE_POWER,
			IntentType.SPACE_MEDIA_ROLE_VOLUME,
			IntentType.SPACE_MEDIA_SET_MODE,
			IntentType.SPACE_MEDIA_PLAY,
			IntentType.SPACE_MEDIA_PAUSE,
			IntentType.SPACE_MEDIA_STOP,
			IntentType.SPACE_MEDIA_NEXT,
			IntentType.SPACE_MEDIA_PREVIOUS,
			IntentType.SPACE_MEDIA_INPUT_SET,
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

			if (typeof obj.coversMode === 'string') {
				return obj.coversMode;
			}
		}

		return null;
	}
}
