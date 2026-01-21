import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import { DEVICES_SIMULATOR_PLUGIN_NAME } from '../devices-simulator.constants';

type ApiUpdateConfig = {
	type: typeof DEVICES_SIMULATOR_PLUGIN_NAME;
	enabled?: boolean;
	update_on_start?: boolean;
	simulation_interval?: number;
	latitude?: number;
	smooth_transitions?: boolean;
	connection_state_on_start?: 'connected' | 'disconnected' | 'lost' | 'alert' | 'unknown';
};

type ApiConfig = {
	type: typeof DEVICES_SIMULATOR_PLUGIN_NAME;
	enabled: boolean;
	update_on_start: boolean;
	simulation_interval: number;
	latitude: number;
	smooth_transitions: boolean;
	connection_state_on_start?: 'connected' | 'disconnected' | 'lost' | 'alert' | 'unknown';
};

export const SimulatorConfigSchema = ConfigPluginSchema.extend({
	updateOnStart: z.boolean(),
	simulationInterval: z.number().min(0).max(3_600_000),
	latitude: z.number().min(-90).max(90),
	smoothTransitions: z.boolean(),
	connectionStateOnStart: z.enum(['connected', 'disconnected', 'lost', 'alert', 'unknown']).optional(),
});

// BACKEND API
// ===========

export const SimulatorConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_PLUGIN_NAME),
		update_on_start: z.boolean().optional(),
		simulation_interval: z
			.number()
			.min(0)
			.max(3_600_000)
			.optional(),
		latitude: z
			.number()
			.min(-90)
			.max(90)
			.optional(),
		smooth_transitions: z.boolean().optional(),
		connection_state_on_start: z.enum(['connected', 'disconnected', 'lost', 'alert', 'unknown']).optional(),
	})
);

export const SimulatorConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(DEVICES_SIMULATOR_PLUGIN_NAME),
		update_on_start: z.boolean(),
		simulation_interval: z.number(),
		latitude: z.number(),
		smooth_transitions: z.boolean(),
		connection_state_on_start: z.enum(['connected', 'disconnected', 'lost', 'alert', 'unknown']).optional(),
	})
);
