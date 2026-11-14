/*
 * The configurations of the space cards as the backend accepts them, for immediate feedback in their
 * forms. Messages are translation keys of the plugin.
 */
import { z } from 'zod';

import { changeRules, defineNodeConfigSchema, optionListSchema } from '../../../modules/automations/nodes/nodes.schemas';

import {
	SpaceAutomationNodeType as NodeType,
	SPACE_ACTIVITY_MODES,
	SPACE_AUTOMATIONS_VALIDATION_PREFIX,
	SPACE_LIGHTING_FIELDS,
	SPACE_LIGHTING_FIELDS_OF_INTENT,
	SPACE_LIGHTING_INTENTS,
	SPACE_LIGHTING_MODES,
	SPACE_LIGHTING_ROLES,
	SPACE_OCCUPANCY_STATES,
	type SpaceAutomationNodeType,
	type SpaceLightingIntent,
} from './space-automations.constants';

const message = (key: string): { message: string } => ({ message: `${SPACE_AUTOMATIONS_VALIDATION_PREFIX}${key}` });

const spaceCard = <T extends z.ZodRawShape>(shape: T, rules?: Parameters<typeof defineNodeConfigSchema>[1]) =>
	defineNodeConfigSchema({ space_id: z.string(message('space')).uuid(message('space')), ...shape }, rules, SPACE_AUTOMATIONS_VALIDATION_PREFIX);

const OccupancySchema = z.enum(SPACE_OCCUPANCY_STATES, message('occupancy'));

const ActivityModeSchema = z.enum(SPACE_ACTIVITY_MODES, message('activityMode'));

export const SpaceOccupancyChangedConfigSchema = spaceCard({
	to: OccupancySchema.optional(),
});

export const SpaceOccupancyIsConfigSchema = spaceCard({
	state: OccupancySchema,
});

export const SpaceModeChangedConfigSchema = spaceCard(
	{
		to: ActivityModeSchema.optional(),
		from: ActivityModeSchema.optional(),
	},
	changeRules
);

export const SpaceModeIsConfigSchema = spaceCard({
	modes: optionListSchema(ActivityModeSchema, 'activityModes', SPACE_ACTIVITY_MODES.length, SPACE_AUTOMATIONS_VALIDATION_PREFIX),
});

export const SpaceModeSetConfigSchema = spaceCard({
	mode: ActivityModeSchema,
});

export const SpaceLightingIntentConfigSchema = spaceCard(
	{
		intent: z.enum(SPACE_LIGHTING_INTENTS, message('lightingIntent')),
		mode: z.enum(SPACE_LIGHTING_MODES, message('lightingMode')).optional(),
		role: z.enum(SPACE_LIGHTING_ROLES, message('lightingRole')).optional(),
		brightness: z.number(message('brightness')).int(message('brightness')).min(0, message('brightness')).max(100, message('brightness')).optional(),
	},
	(config, report): void => {
		if (!(SPACE_LIGHTING_INTENTS as readonly unknown[]).includes(config.intent)) return;

		const used = SPACE_LIGHTING_FIELDS_OF_INTENT[config.intent as SpaceLightingIntent];

		// A field another intent uses is refused by the backend, not ignored; one the intent uses is required
		for (const field of SPACE_LIGHTING_FIELDS) {
			const given = typeof config[field] !== 'undefined' && config[field] !== null;

			if (given && !used.includes(field)) report([field], 'notUsedByIntent');
			if (!given && used.includes(field)) report([field], 'required');
		}
	}
);

export const SPACE_AUTOMATION_CONFIG_SCHEMAS: Record<SpaceAutomationNodeType, z.ZodType> = {
	[NodeType.OCCUPANCY_CHANGED]: SpaceOccupancyChangedConfigSchema,
	[NodeType.OCCUPANCY_IS]: SpaceOccupancyIsConfigSchema,
	[NodeType.MODE_CHANGED]: SpaceModeChangedConfigSchema,
	[NodeType.MODE_IS]: SpaceModeIsConfigSchema,
	[NodeType.MODE_SET]: SpaceModeSetConfigSchema,
	[NodeType.LIGHTING_INTENT]: SpaceLightingIntentConfigSchema,
};
