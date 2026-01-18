import { Injectable } from '@nestjs/common';

import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { MediaIntentDto } from '../dto/media-intent.dto';

import { ClimateIntentResult, ClimateIntentService, ClimateState } from './climate-intent.service';
import { CoversIntentResult, CoversIntentService, CoversState } from './covers-intent.service';
import { LightingIntentService } from './lighting-intent.service';
import { MediaIntentResult, MediaIntentService, MediaState } from './media-intent.service';
import { IntentExecutionResult } from './space-intent-base.service';

// Re-export types for backward compatibility
export { ClimateState, ClimateIntentResult } from './climate-intent.service';
export { CoversState, CoversIntentResult } from './covers-intent.service';
export { LightDevice, LightModeSelection, selectLightsForMode } from './lighting-intent.service';
export { CoverDevice, CoverModeSelection, selectCoversForMode } from './covers-intent.service';
export {
	MediaDevice,
	MediaModeSelection,
	selectMediaForMode,
	MediaIntentResult,
	MediaState,
} from './media-intent.service';
export { IntentExecutionResult } from './space-intent-base.service';

/**
 * Facade service that delegates to domain-specific intent services.
 * This service maintains backward compatibility with existing code
 * while delegating all actual logic to specialized services.
 */
@Injectable()
export class SpaceIntentService {
	constructor(
		private readonly lightingIntentService: LightingIntentService,
		private readonly climateIntentService: ClimateIntentService,
		private readonly coversIntentService: CoversIntentService,
		private readonly mediaIntentService: MediaIntentService,
	) {}

	// =====================
	// Lighting Methods
	// =====================

	/**
	 * Execute a lighting intent for all lights in a space.
	 * Delegates to LightingIntentService.
	 *
	 * @param spaceId - The UUID of the space to execute the intent in
	 * @param intent - The lighting intent to execute (OFF, ON, SET_MODE, BRIGHTNESS_DELTA)
	 * @returns The execution result with affected/failed device counts, or null if the space doesn't exist
	 */
	async executeLightingIntent(spaceId: string, intent: LightingIntentDto): Promise<IntentExecutionResult | null> {
		return this.lightingIntentService.executeLightingIntent(spaceId, intent);
	}

	// =====================
	// Climate Methods
	// =====================

	/**
	 * Get the current climate state for a space.
	 * Delegates to ClimateIntentService.
	 *
	 * @param spaceId - The UUID of the space to get climate state for
	 * @returns The aggregated climate state including temperature, humidity, mode, and setpoints,
	 *          or null if the space doesn't exist
	 */
	async getClimateState(spaceId: string): Promise<ClimateState | null> {
		return this.climateIntentService.getClimateState(spaceId);
	}

	/**
	 * Execute a climate intent for the space.
	 * Delegates to ClimateIntentService.
	 *
	 * @param spaceId - The UUID of the space to execute the intent in
	 * @param intent - The climate intent to execute (SETPOINT_DELTA, SETPOINT_SET, SET_MODE)
	 * @returns The execution result with affected/failed device counts and new setpoint values,
	 *          or null if the space doesn't exist
	 */
	async executeClimateIntent(spaceId: string, intent: ClimateIntentDto): Promise<ClimateIntentResult | null> {
		return this.climateIntentService.executeClimateIntent(spaceId, intent);
	}

	/**
	 * Get the primary thermostat device ID for a space.
	 *
	 * @param spaceId - The UUID of the space
	 * @returns The primary thermostat device ID, or null if no thermostat exists
	 * @deprecated Use ClimateIntentService.getPrimaryThermostatId instead
	 */
	async getPrimaryThermostatId(spaceId: string): Promise<string | null> {
		return this.climateIntentService.getPrimaryThermostatId(spaceId);
	}

	// =====================
	// Covers Methods
	// =====================

	/**
	 * Get the current covers state for a space.
	 * Delegates to CoversIntentService.
	 *
	 * @param spaceId - The UUID of the space to get covers state for
	 * @returns The aggregated covers state including position, open/closed status, and device counts,
	 *          or null if the space doesn't exist
	 */
	async getCoversState(spaceId: string): Promise<CoversState | null> {
		return this.coversIntentService.getCoversState(spaceId);
	}

	/**
	 * Execute a covers intent for the space.
	 * Delegates to CoversIntentService.
	 *
	 * @param spaceId - The UUID of the space to execute the intent in
	 * @param intent - The covers intent to execute (OPEN, CLOSE, SET_POSITION, POSITION_DELTA, SET_MODE)
	 * @returns The execution result with affected/failed device counts and new position,
	 *          or null if the space doesn't exist
	 */
	async executeCoversIntent(spaceId: string, intent: CoversIntentDto): Promise<CoversIntentResult | null> {
		return this.coversIntentService.executeCoversIntent(spaceId, intent);
	}

	// =====================
	// Media Methods
	// =====================

	/**
	 * Get the current media state for a space.
	 * Delegates to MediaIntentService.
	 *
	 * @param spaceId - The UUID of the space to get media state for
	 * @returns The aggregated media state including volume, power, mute status, and device counts,
	 *          or null if the space doesn't exist
	 */
	async getMediaState(spaceId: string): Promise<MediaState | null> {
		return this.mediaIntentService.getMediaState(spaceId);
	}

	/**
	 * Execute a media intent for the space.
	 * Delegates to MediaIntentService.
	 *
	 * @param spaceId - The UUID of the space to execute the intent in
	 * @param intent - The media intent to execute (POWER_ON, POWER_OFF, VOLUME_SET, VOLUME_DELTA, MUTE, UNMUTE, SET_MODE)
	 * @returns The execution result with affected/failed device counts and new volume/mute state,
	 *          or null if the space doesn't exist
	 */
	async executeMediaIntent(spaceId: string, intent: MediaIntentDto): Promise<MediaIntentResult | null> {
		return this.mediaIntentService.executeMediaIntent(spaceId, intent);
	}
}
