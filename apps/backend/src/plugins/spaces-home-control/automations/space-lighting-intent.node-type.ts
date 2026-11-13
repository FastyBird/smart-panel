import { IsEnum, IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';

import {
	AutomationActionNodeType,
	AutomationNodeConfigProblem,
	AutomationNodeConfigValidator,
} from '../../../modules/automations/graph/node-type';
import { automationIntentContext } from '../../../modules/automations/nodes/intent-context.utils';
import { createConfigValidatorFromDto } from '../../../modules/automations/utils/node-config-dto.utils';
import { IntentContext } from '../../../modules/intents/models/intent.model';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { IntentExecutionResult } from '../services/space-intent-base.service';
import { LightingIntentType, LightingMode, LightingRole } from '../spaces-home-control.constants';

import { SPACE_CARD_OWNER, SPACE_ID_SCHEMA, SpaceTargetDto, describeError, spaceReferences } from './space-cards.utils';

export const SPACE_LIGHTING_INTENT_NODE_TYPE = 'space.lighting.intent';

/** The lighting intents an automation can ask a space for */
export const SPACE_LIGHTING_INTENTS = [
	LightingIntentType.ON,
	LightingIntentType.OFF,
	LightingIntentType.SET_MODE,
	LightingIntentType.ROLE_ON,
	LightingIntentType.ROLE_OFF,
	LightingIntentType.ROLE_BRIGHTNESS,
] as const;

export type SpaceLightingIntent = (typeof SPACE_LIGHTING_INTENTS)[number];

const ROLE_INTENTS: readonly LightingIntentType[] = [
	LightingIntentType.ROLE_ON,
	LightingIntentType.ROLE_OFF,
	LightingIntentType.ROLE_BRIGHTNESS,
];

export const SPACE_LIGHTING_MODES = Object.values(LightingMode);

/** Hidden lights are never controlled by an intent, so they can not be a target */
export const SPACE_LIGHTING_ROLES = Object.values(LightingRole).filter((role) => role !== LightingRole.HIDDEN);

const INTENT_REASON = `The lighting intent must be one of ${SPACE_LIGHTING_INTENTS.join(', ')}.`;
const MODE_REASON = `The lighting mode must be one of ${SPACE_LIGHTING_MODES.join(', ')}.`;
const ROLE_REASON = `The lighting role must be one of ${SPACE_LIGHTING_ROLES.join(', ')}.`;
const BRIGHTNESS_REASON = 'The brightness must be a whole number from 0 to 100.';

export class SpaceLightingIntentConfigDto extends SpaceTargetDto {
	@IsIn(SPACE_LIGHTING_INTENTS, { message: JSON.stringify([{ field: 'intent', reason: INTENT_REASON }]) })
	intent: SpaceLightingIntent;

	@ValidateIf((config: SpaceLightingIntentConfigDto) => config.intent === LightingIntentType.SET_MODE)
	@IsEnum(LightingMode, { message: JSON.stringify([{ field: 'mode', reason: MODE_REASON }]) })
	mode?: LightingMode;

	@ValidateIf((config: SpaceLightingIntentConfigDto) => ROLE_INTENTS.includes(config.intent))
	@IsIn(SPACE_LIGHTING_ROLES, { message: JSON.stringify([{ field: 'role', reason: ROLE_REASON }]) })
	role?: LightingRole;

	@ValidateIf((config: SpaceLightingIntentConfigDto) => config.intent === LightingIntentType.ROLE_BRIGHTNESS)
	@IsInt({ message: JSON.stringify([{ field: 'brightness', reason: BRIGHTNESS_REASON }]) })
	@Min(0, { message: JSON.stringify([{ field: 'brightness', reason: BRIGHTNESS_REASON }]) })
	@Max(100, { message: JSON.stringify([{ field: 'brightness', reason: BRIGHTNESS_REASON }]) })
	brightness?: number;
}

/** The part of the space intent service the action needs */
export interface SpaceLightingCommander {
	/** Answers null when the space does not exist */
	executeLightingIntent(
		spaceId: string,
		intent: LightingIntentDto,
		executionContext: IntentContext,
	): Promise<IntentExecutionResult | null>;
}

/** Which of the optional fields an intent uses; a field another intent uses is refused, not ignored */
const FIELDS_OF_INTENT: Record<SpaceLightingIntent, readonly ('mode' | 'role' | 'brightness')[]> = {
	[LightingIntentType.ON]: [],
	[LightingIntentType.OFF]: [],
	[LightingIntentType.SET_MODE]: ['mode'],
	[LightingIntentType.ROLE_ON]: ['role'],
	[LightingIntentType.ROLE_OFF]: ['role'],
	[LightingIntentType.ROLE_BRIGHTNESS]: ['role', 'brightness'],
};

const toIntent = (config: SpaceLightingIntentConfigDto): LightingIntentDto => {
	const intent = new LightingIntentDto();

	intent.type = config.intent;

	if (config.intent === LightingIntentType.SET_MODE) intent.mode = config.mode;
	if (ROLE_INTENTS.includes(config.intent)) intent.role = config.role;
	if (config.intent === LightingIntentType.ROLE_BRIGHTNESS) intent.brightness = config.brightness;

	return intent;
};

/**
 * The action "set the lighting of a space".
 *
 * It sends a lighting intent to a room or zone through the same service the panel, the space tile and Buddy
 * use, so the lights of the space are chosen by their roles, offline lights are skipped and the change can be
 * undone from the panel. The intent carries the automation as its origin. It turns the lights on or off, applies
 * a lighting mode, or turns on, off or dims the lights of one role. It writes only to lights, so nothing it
 * does is a write the safety policy guards.
 *
 * It takes `done` when every light it addressed took the change; a space that does not exist, a light that
 * failed or a light that was skipped because it is offline takes `error`. A space without lights takes `done`.
 */
export const createSpaceLightingIntentNodeType = (
	lighting: SpaceLightingCommander,
): AutomationActionNodeType<SpaceLightingIntentConfigDto> => {
	const validateShape = createConfigValidatorFromDto(SpaceLightingIntentConfigDto);

	const validateConfig: AutomationNodeConfigValidator = async (config) => {
		const shape = await validateShape(config);

		if (shape.length > 0) return shape;

		const intent = (config as unknown as SpaceLightingIntentConfigDto).intent;
		const used = FIELDS_OF_INTENT[intent];
		const problems: AutomationNodeConfigProblem[] = [];

		for (const field of ['mode', 'role', 'brightness'] as const) {
			if (config[field] !== undefined && !used.includes(field)) {
				problems.push({ field, reason: `"${field}" does not apply to the ${intent} intent.` });
			}
		}

		return problems;
	};

	return {
		type: SPACE_LIGHTING_INTENT_NODE_TYPE,
		kind: 'action',
		name: 'Set space lighting',
		description:
			'Turns the lights of a room or zone on or off, applies a lighting mode, or turns on, off or dims the lights of one role.',
		owner: SPACE_CARD_OWNER,
		validateConfig,
		configSchema: {
			type: 'object',
			properties: {
				space_id: SPACE_ID_SCHEMA,
				intent: { type: 'string', enum: [...SPACE_LIGHTING_INTENTS], description: 'What to do with the lights.' },
				mode: {
					type: 'string',
					enum: [...SPACE_LIGHTING_MODES],
					description: 'The lighting mode to apply; only for set_mode.',
				},
				role: {
					type: 'string',
					enum: [...SPACE_LIGHTING_ROLES],
					description: 'The lights of this role; only for role_on, role_off and role_brightness.',
				},
				brightness: {
					type: 'integer',
					minimum: 0,
					maximum: 100,
					description: 'The brightness in percent; only for role_brightness.',
				},
			},
			required: ['space_id', 'intent'],
			additionalProperties: false,
		},
		references: spaceReferences,
		execute: async (config, context) => {
			if (context.signal.aborted) {
				return { success: false, reason: 'The run was cancelled before the lighting was changed.' };
			}

			let result: IntentExecutionResult | null;

			try {
				result = await lighting.executeLightingIntent(
					config.space_id,
					toIntent(config),
					automationIntentContext(context),
				);
			} catch (error) {
				return { success: false, reason: `The lighting was not changed: ${describeError(error)}` };
			}

			if (result === null) {
				return { success: false, reason: 'The lighting was not changed: the space does not exist.' };
			}

			const offline = result.skippedOfflineDevices ?? 0;

			if (!result.success || result.failedDevices > 0 || offline > 0) {
				return {
					success: false,
					reason: `The lighting changed on ${result.affectedDevices} light(s); ${result.failedDevices} failed and ${offline} were offline.`,
				};
			}

			return { success: true };
		},
	};
};
