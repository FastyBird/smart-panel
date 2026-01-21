import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';
import { SIMULATOR_CONNECTION_STATES } from '../devices-simulator.constants';

export const SimulatorConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	updateOnStart: z.boolean().default(false),
	simulationInterval: z.coerce.number().int().min(0).max(3_600_000),
	latitude: z.coerce.number().min(-90).max(90),
	smoothTransitions: z.boolean().default(true),
	connectionStateOnStart: z.enum(SIMULATOR_CONNECTION_STATES).default('connected'),
});
