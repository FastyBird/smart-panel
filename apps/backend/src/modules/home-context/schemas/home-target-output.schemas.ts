import { z } from 'zod';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import { SceneCategory } from '../../scenes/scenes.constants';
import { SpaceType } from '../../spaces/spaces.constants';
import { HOME_CONTEXT_LIMIT_PROFILES, HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';

const limits = HOME_CONTEXT_LIMIT_PROFILES[HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY];

const writablePropertySchema = z
	.object({
		property_id: z.string(),
		property_name: z.string().nullable(),
		property_category: z.enum(PropertyCategory),
		device_id: z.string(),
		device_name: z.string(),
		channel_id: z.string(),
		channel_name: z.string(),
		channel_category: z.enum(ChannelCategory),
		data_type: z.enum(DataTypeType),
		unit: z.string().nullable(),
		format: z.union([z.array(z.string()), z.array(z.number()), z.null()]),
		step: z.number().nullable(),
		invalid: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	})
	.strict();

export const homeWritablePropertiesResultSchema = z
	.object({
		properties: z.array(writablePropertySchema).max(limits.writableProperties),
		truncated: z.boolean(),
	})
	.strict();

const triggerSceneSchema = z
	.object({
		scene_id: z.string(),
		name: z.string(),
		category: z.enum(SceneCategory),
		primary_space_id: z.string().nullable(),
	})
	.strict();

const triggerSpaceSchema = z
	.object({
		space_id: z.string(),
		name: z.string(),
		type: z.enum(SpaceType),
		modes: z.tuple([z.literal('off'), z.literal('on'), z.literal('work'), z.literal('relax'), z.literal('night')]),
	})
	.strict();

export const homeTriggerTargetsResultSchema = z
	.object({
		scenes: z.array(triggerSceneSchema).max(limits.triggerScenes),
		spaces: z.array(triggerSpaceSchema).max(limits.triggerSpaces),
		truncated: z
			.object({
				scenes: z.boolean(),
				spaces: z.boolean(),
			})
			.strict(),
	})
	.strict();
