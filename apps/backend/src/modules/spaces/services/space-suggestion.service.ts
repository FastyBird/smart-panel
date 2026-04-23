import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { CooldownManager } from '../../../common/utils/cooldown-manager';
import { IntentSpecLoaderService } from '../../../plugins/spaces-home-control/spec/intent-spec-loader.service';
import { ResolvedSuggestionRule } from '../../../plugins/spaces-home-control/spec/intent-spec.types';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { SpaceEntity } from '../entities/space.entity';
import {
	LightingIntentType,
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
	intentType: string;
	intentMode: string | null;
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

export const spaceCooldowns = new CooldownManager<SuggestionType>();

/**
 * Tracks the last emitted suggestion per space.
 * - `type`: the suggestion type that was emitted
 * - `emittedAt`: timestamp of emission (used for re-emit after expiry)
 * - `dismissed`: true if the user explicitly dismissed or applied — blocks
 *   re-emission while conditions remain the same
 */
export interface EmittedSuggestionEntry {
	type: SuggestionType;
	emittedAt: number;
	dismissed: boolean;
}

export const lastEmittedSuggestions = new Map<string, EmittedSuggestionEntry>();

/**
 * Check if a space name matches any of the given bedroom patterns
 */
export function isBedroomSpace(spaceName: string, patterns: string[]): boolean {
	const lowerName = spaceName.toLowerCase();

	return patterns.some((pattern) => lowerName.includes(pattern));
}

/**
 * Evaluate suggestion rules for a given context.
 * Rules are evaluated in order — first matching rule wins.
 *
 * @param context - The context to evaluate
 * @param rules - Resolved suggestion rules from YAML spec
 * @param bedroomPatterns - Bedroom name patterns from YAML spec
 * @returns A suggestion or null if no rule matches
 */
export function evaluateSuggestionRules(
	context: SuggestionContext,
	rules: ResolvedSuggestionRule[],
	bedroomPatterns: string[],
): SpaceSuggestion | null {
	const { space, currentHour, lightsOn, averageBrightness } = context;
	const isBedroom = isBedroomSpace(space.name, bedroomPatterns);

	for (const rule of rules) {
		// Check hour_from condition
		if (rule.hourFrom !== null && currentHour < rule.hourFrom) {
			continue;
		}

		// Check hour_to condition
		if (rule.hourTo !== null && currentHour >= rule.hourTo) {
			continue;
		}

		// Check lights_on condition
		if (rule.lightsOn !== null && lightsOn !== rule.lightsOn) {
			continue;
		}

		// Check min_brightness condition
		if (rule.minBrightness !== null) {
			if (averageBrightness === null || averageBrightness < rule.minBrightness) {
				continue;
			}
		}

		// Check space_is_bedroom condition
		if (rule.spaceIsBedroom !== null && isBedroom !== rule.spaceIsBedroom) {
			continue;
		}

		// All conditions passed — return this suggestion
		return {
			type: rule.id as SuggestionType,
			title: rule.title,
			reason: rule.reason,
			intentType: rule.intentType,
			intentMode: rule.intentMode,
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
		private readonly specLoader: IntentSpecLoaderService,
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
		// Get space - throws if not found
		const space = await this.spacesService.getOneOrThrow(spaceId);

		// Check if suggestions are enabled
		if (!space.suggestionsEnabled) {
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

		// Evaluate rules from YAML spec
		const suggestion = evaluateSuggestionRules(
			context,
			this.specLoader.getSuggestionRules(),
			this.specLoader.getBedroomPatterns(),
		);

		if (!suggestion) {
			return null;
		}

		// Check cooldown
		if (spaceCooldowns.isOnCooldown(spaceId, suggestion.type)) {
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

		const entry = lastEmittedSuggestions.get(spaceId);

		// If dismissed, mark as dismissed and set cooldown
		if (feedback === SuggestionFeedback.DISMISSED) {
			if (entry && entry.type === suggestionType) {
				entry.dismissed = true;
			}

			spaceCooldowns.setCooldown(spaceId, suggestionType, SUGGESTION_COOLDOWN_MS);

			return { success: true };
		}

		// If applied, execute the intent — only mark dismissed and set cooldown on success
		if (feedback === SuggestionFeedback.APPLIED) {
			const intentResult = await this.executeIntent(spaceId, suggestionType);

			if (intentResult) {
				if (entry && entry.type === suggestionType) {
					entry.dismissed = true;
				}

				spaceCooldowns.setCooldown(spaceId, suggestionType, SUGGESTION_COOLDOWN_MS);
			}

			return {
				success: true,
				intentExecuted: intentResult,
			};
		}

		return { success: true };
	}

	/**
	 * Execute the intent for a suggestion type.
	 * Looks up the suggestion rule from YAML spec to determine intent type and mode.
	 *
	 * @param spaceId - The UUID of the space to execute the intent in
	 * @param suggestionType - The type of suggestion to execute
	 * @returns true if the intent was executed successfully, false if rule not found or execution failed
	 */
	private async executeIntent(spaceId: string, suggestionType: SuggestionType): Promise<boolean> {
		try {
			const rules = this.specLoader.getSuggestionRules();
			const rule = rules.find((r) => r.id === (suggestionType as string));

			if (!rule) {
				this.logger.warn(`No suggestion rule found for type: ${suggestionType as string}`);

				return false;
			}

			// Map YAML intent_type strings to LightingIntentType enum values
			const intentType = Object.values(LightingIntentType).find((v) => (v as string) === rule.intentType);

			if (!intentType) {
				this.logger.warn(`Unknown intent type: ${rule.intentType} for suggestion: ${rule.id}`);

				return false;
			}

			const intent: LightingIntentDto = Object.assign(new LightingIntentDto(), {
				type: intentType,
				mode: rule.intentMode ?? undefined,
			});

			const result = await this.spaceIntentService.executeLightingIntent(spaceId, intent);

			return result !== null;
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

		const value = property.value?.value;

		return value === true || value === 'true' || value === 1 || value === '1';
	}

	/**
	 * Get a numeric value from a property.
	 */
	private getNumericValue(property: ChannelPropertyEntity | undefined): number | null {
		if (!property) {
			return null;
		}

		const value = property.value?.value;

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
