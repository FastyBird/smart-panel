import { z } from 'zod';

import {
	SpacesModuleClimateIntentMode as ClimateMode,
	SpacesModuleDataLightingStateDetected_mode as LightingMode,
	PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey as MediaActivity,
	SpacesHomeControlPluginDataActivityClimateThermostat_preset as Preset,
} from '../../../openapi';

export { ClimateMode, LightingMode, MediaActivity, Preset };

export const ActivityDraftSchema = z
	.object({
		enabled: z.boolean(),
		display_order: z.number().int().min(0).max(1000),
		configuration: z.object({
			lighting: z.object({ enabled: z.boolean(), mode: z.nativeEnum(LightingMode), brightness: z.number().int().min(0).max(100).optional() }),
			climate: z.object({
				enabled: z.boolean(),
				mode: z.nativeEnum(ClimateMode).optional(),
				thermostat_preset: z.nativeEnum(Preset).optional(),
				setpoint: z.number().finite().optional(),
				setpoint_delta: z.number().finite().optional(),
			}),
			covers: z.object({ enabled: z.boolean(), position: z.number().int().min(0).max(100) }),
			media: z.object({ enabled: z.boolean(), activity: z.nativeEnum(MediaActivity) }),
			security: z.object({ enabled: z.boolean() }),
		}),
	})
	.superRefine(({ configuration: { climate, lighting } }, context) => {
		const numeric = climate.setpoint !== undefined || climate.setpoint_delta !== undefined;
		if (
			(climate.thermostat_preset !== undefined && (numeric || climate.mode !== undefined)) ||
			(climate.setpoint !== undefined && climate.setpoint_delta !== undefined) ||
			(climate.enabled && climate.thermostat_preset === undefined && !numeric) ||
			(numeric && climate.mode !== ClimateMode.heat && climate.mode !== ClimateMode.cool)
		)
			context.addIssue({ code: z.ZodIssueCode.custom, path: ['configuration', 'climate'], message: 'invalid' });
		if (lighting.mode === LightingMode.off && lighting.brightness !== undefined)
			context.addIssue({ code: z.ZodIssueCode.custom, path: ['configuration', 'lighting'], message: 'invalid' });
	});
