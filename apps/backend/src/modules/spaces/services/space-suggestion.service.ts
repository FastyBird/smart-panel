import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceEntity } from '../entities/space.entity';
import {
	BEDROOM_SPACE_PATTERNS,
	LightingIntentType,
	LightingMode,
	SPACES_MODULE_NAME,
	SUGGESTION_COOLDOWN_MS,
	SuggestionFeedback,
	SuggestionType,
} from '../spaces.constants';

import { SpaceIntentService } from './space-intent.service';
import { SpacesService } from './spaces.service';

/**
 * Represents a suggestion generated for a space
 */
export interface SpaceSuggestion {
	type: SuggestionType;
	title: string;
	reason: string | null;
	lightingMode: LightingMode | null;
}

/**
 * Context for evaluating suggestion rules
 */
export interface SuggestionContext {
	space: SpaceEntity;
	currentHour: number;
	lightsOn: boolean;
	averageBrightness: number | null;
}

/**
 * In-memory cooldown storage (per space + suggestion type)
 * In production, this could be stored in Redis or database for persistence
 */
const suggestionCooldowns = new Map<string, number>();

/**
 * Get a cooldown key for a space + suggestion type
 */
function getCooldownKey(spaceId: string, suggestionType: SuggestionType): string {
	return `${spaceId}:${suggestionType}`;
}

/**
 * Check if a suggestion is on cooldown
 */
export function isOnCooldown(spaceId: string, suggestionType: SuggestionType, now: number = Date.now()): boolean {
	const key = getCooldownKey(spaceId, suggestionType);
	const cooldownUntil = suggestionCooldowns.get(key);

	if (!cooldownUntil) {
		return false;
	}

	return now < cooldownUntil;
}

/**
 * Set a cooldown for a suggestion
 */
export function setCooldown(
	spaceId: string,
	suggestionType: SuggestionType,
	durationMs: number = SUGGESTION_COOLDOWN_MS,
	now: number = Date.now(),
): void {
	const key = getCooldownKey(spaceId, suggestionType);
	suggestionCooldowns.set(key, now + durationMs);
}

/**
 * Clear cooldown for testing purposes
 */
export function clearCooldown(spaceId: string, suggestionType: SuggestionType): void {
	const key = getCooldownKey(spaceId, suggestionType);
	suggestionCooldowns.delete(key);
}

/**
 * Clear all cooldowns (for testing)
 */
export function clearAllCooldowns(): void {
	suggestionCooldowns.clear();
}

/**
 * Check if a space name matches bedroom patterns
 */
export function isBedroomSpace(spaceName: string): boolean {
	const lowerName = spaceName.toLowerCase();

	return BEDROOM_SPACE_PATTERNS.some((pattern) => lowerName.includes(pattern));
}

/**
 * Evaluate suggestion rules for a given context.
 * This is a pure function for testability.
 *
 * MVP Rules:
 * 1. After 17:00 with lights in work mode (high brightness) -> suggest Relax mode
 * 2. After 22:00 in bedroom with any lights on -> suggest Night mode or Lights Off
 *
 * @param context - The context to evaluate
 * @returns A suggestion or null if no suggestion applies
 */
export function evaluateSuggestionRules(context: SuggestionContext): SpaceSuggestion | null {
	const { space, currentHour, lightsOn, averageBrightness } = context;

	// Rule 1: Evening (after 22:00) in bedroom with lights on -> Night mode
	if (currentHour >= 22 && isBedroomSpace(space.name) && lightsOn) {
		return {
			type: SuggestionType.LIGHTING_NIGHT,
			title: 'Night lighting',
			reason: 'Late evening - switch to night mode for better sleep',
			lightingMode: LightingMode.NIGHT,
		};
	}

	// Rule 2: Evening (after 17:00) with high brightness -> Relax mode
	// For non-bedrooms, extends until 23:00 when Lights Off rule takes over
	if (currentHour >= 17 && currentHour < 23 && lightsOn && averageBrightness !== null && averageBrightness >= 70) {
		return {
			type: SuggestionType.LIGHTING_RELAX,
			title: 'Relax lighting',
			reason: 'Evening time - switch to a calmer lighting mode',
			lightingMode: LightingMode.RELAX,
		};
	}

	// Rule 3: Late night (after 23:00) with lights on in non-bedroom -> Lights off suggestion
	if (currentHour >= 23 && lightsOn && !isBedroomSpace(space.name)) {
		return {
			type: SuggestionType.LIGHTING_OFF,
			title: 'Turn off lights',
			reason: 'Late night - consider turning off the lights',
			lightingMode: null, // OFF intent, not a mode
		};
	}

	return null;
}

@Injectable()
export class SpaceSuggestionService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceSuggestionService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly spaceIntentService: SpaceIntentService,
	) {}

	/**
	 * Get a suggestion for a space.
	 * Returns null if no suggestion is available or suggestions are disabled.
	 * Throws SpacesNotFoundException if the space does not exist.
	 *
	 * @param spaceId - The space ID
	 * @returns A suggestion or null
	 * @throws SpacesNotFoundException if space not found
	 */
	async getSuggestion(spaceId: string): Promise<SpaceSuggestion | null> {
		this.logger.debug(`Getting suggestion for space id=${spaceId}`);

		// Get space - throws if not found
		const space = await this.spacesService.getOneOrThrow(spaceId);

		// Check if suggestions are enabled
		if (!space.suggestionsEnabled) {
			this.logger.debug(`Suggestions disabled for space id=${spaceId}`);

			return null;
		}

		// Get lighting state
		const { lightsOn, averageBrightness } = await this.getLightingState(spaceId);

		// Build context
		const context: SuggestionContext = {
			space,
			currentHour: new Date().getHours(),
			lightsOn,
			averageBrightness,
		};

		// Evaluate rules
		const suggestion = evaluateSuggestionRules(context);

		if (!suggestion) {
			this.logger.debug(`No suggestion applicable for space id=${spaceId}`);

			return null;
		}

		// Check cooldown
		if (isOnCooldown(spaceId, suggestion.type)) {
			this.logger.debug(`Suggestion ${suggestion.type} is on cooldown for space id=${spaceId}`);

			return null;
		}

		this.logger.log(`Suggestion generated for space id=${spaceId} type=${suggestion.type}`);

		return suggestion;
	}

	/**
	 * Record feedback for a suggestion and optionally execute the intent.
	 * Throws SpacesNotFoundException if the space does not exist.
	 *
	 * @param spaceId - The space ID
	 * @param suggestionType - The type of suggestion
	 * @param feedback - The user feedback (applied or dismissed)
	 * @returns Result with success status and optional intent execution status
	 * @throws SpacesNotFoundException if space not found
	 */
	async recordFeedback(
		spaceId: string,
		suggestionType: SuggestionType,
		feedback: SuggestionFeedback,
	): Promise<{ success: boolean; intentExecuted?: boolean }> {
		this.logger.log(`Recording feedback for space id=${spaceId} type=${suggestionType} feedback=${feedback}`);

		// Validate space exists - throws if not found
		await this.spacesService.getOneOrThrow(spaceId);

		// If dismissed, set cooldown and return
		if (feedback === SuggestionFeedback.DISMISSED) {
			setCooldown(spaceId, suggestionType);
			this.logger.debug(`Suggestion dismissed for space id=${spaceId} type=${suggestionType}`);

			return { success: true };
		}

		// If applied, execute the intent and only set cooldown on success
		if (feedback === SuggestionFeedback.APPLIED) {
			const intentResult = await this.executeIntent(spaceId, suggestionType);

			// Only set cooldown if intent execution succeeded
			if (intentResult) {
				setCooldown(spaceId, suggestionType);
			}

			return {
				success: true,
				intentExecuted: intentResult,
			};
		}

		return { success: true };
	}

	/**
	 * Execute the lighting intent for a suggestion type.
	 */
	private async executeIntent(spaceId: string, suggestionType: SuggestionType): Promise<boolean> {
		this.logger.debug(`Executing intent for suggestion type=${suggestionType} space id=${spaceId}`);

		try {
			switch (suggestionType) {
				case SuggestionType.LIGHTING_RELAX:
					await this.spaceIntentService.executeLightingIntent(spaceId, {
						type: LightingIntentType.SET_MODE,
						mode: LightingMode.RELAX,
					});

					return true;

				case SuggestionType.LIGHTING_NIGHT:
					await this.spaceIntentService.executeLightingIntent(spaceId, {
						type: LightingIntentType.SET_MODE,
						mode: LightingMode.NIGHT,
					});

					return true;

				case SuggestionType.LIGHTING_OFF:
					await this.spaceIntentService.executeLightingIntent(spaceId, {
						type: LightingIntentType.OFF,
					});

					return true;

				default:
					this.logger.warn(`Unknown suggestion type: ${suggestionType as string}`);

					return false;
			}
		} catch (error) {
			this.logger.error(`Failed to execute intent for suggestion type=${suggestionType}: ${error}`);

			return false;
		}
	}

	/**
	 * Get the current lighting state for a space.
	 * Returns whether any lights are on and the average brightness.
	 */
	private async getLightingState(spaceId: string): Promise<{ lightsOn: boolean; averageBrightness: number | null }> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		let lightsOn = false;
		const brightnessValues: number[] = [];

		for (const device of devices) {
			if (device.category !== DeviceCategory.LIGHTING) {
				continue;
			}

			const lightState = this.extractLightState(device);

			if (lightState.isOn) {
				lightsOn = true;

				if (lightState.brightness !== null) {
					brightnessValues.push(lightState.brightness);
				}
			}
		}

		const averageBrightness =
			brightnessValues.length > 0
				? brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length
				: null;

		return { lightsOn, averageBrightness };
	}

	/**
	 * Extract the on/off and brightness state from a lighting device.
	 */
	private extractLightState(device: DeviceEntity): { isOn: boolean; brightness: number | null } {
		const lightChannel = device.channels?.find((ch) => ch.category === ChannelCategory.LIGHT);

		if (!lightChannel) {
			return { isOn: false, brightness: null };
		}

		const onProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.ON);
		const brightnessProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.BRIGHTNESS);

		const isOn = this.isTruthyValue(onProperty);
		const brightness = this.getNumericValue(brightnessProperty);

		return { isOn, brightness };
	}

	/**
	 * Check if a property value is truthy (on).
	 */
	private isTruthyValue(property: ChannelPropertyEntity | undefined): boolean {
		if (!property) {
			return false;
		}

		const value = property.value;

		return value === true || value === 'true' || value === 1 || value === '1';
	}

	/**
	 * Get a numeric value from a property.
	 */
	private getNumericValue(property: ChannelPropertyEntity | undefined): number | null {
		if (!property) {
			return null;
		}

		const value = property.value;

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);

			return isNaN(parsed) ? null : parsed;
		}

		return null;
	}
}
