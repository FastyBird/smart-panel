import { Injectable } from '@nestjs/common';

import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';

import { ClimateIntentResult, ClimateIntentService, ClimateState } from './climate-intent.service';
import { CoversIntentResult, CoversIntentService, CoversState } from './covers-intent.service';
import { LightingIntentService } from './lighting-intent.service';
import { IntentExecutionResult } from './space-intent-base.service';

// Re-export types for backward compatibility
export { ClimateState, ClimateIntentResult } from './climate-intent.service';
export { CoversState, CoversIntentResult } from './covers-intent.service';
export { LightDevice, LightModeSelection, selectLightsForMode } from './lighting-intent.service';
export { CoverDevice, CoverModeSelection, selectCoversForMode } from './covers-intent.service';
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
	) {}

	// =====================
	// Lighting Methods
	// =====================

	/**
	 * Execute a lighting intent for all lights in a space.
	 * Delegates to LightingIntentService.
	 * Returns null if space doesn't exist.
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
	 * Returns null if space doesn't exist.
	 */
	async getClimateState(spaceId: string): Promise<ClimateState | null> {
		return this.climateIntentService.getClimateState(spaceId);
	}

	/**
	 * Execute a climate intent for the space.
	 * Delegates to ClimateIntentService.
	 * Returns null if space doesn't exist.
	 */
	async executeClimateIntent(spaceId: string, intent: ClimateIntentDto): Promise<ClimateIntentResult | null> {
		return this.climateIntentService.executeClimateIntent(spaceId, intent);
	}

	/**
	 * Get the primary thermostat device ID for a space (legacy method for undo service).
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
	 * Returns null if space doesn't exist.
	 */
	async getCoversState(spaceId: string): Promise<CoversState | null> {
		return this.coversIntentService.getCoversState(spaceId);
	}

	/**
	 * Execute a covers intent for the space.
	 * Delegates to CoversIntentService.
	 * Returns null if space doesn't exist.
	 */
	async executeCoversIntent(spaceId: string, intent: CoversIntentDto): Promise<CoversIntentResult | null> {
		return this.coversIntentService.executeCoversIntent(spaceId, intent);
	}
}
