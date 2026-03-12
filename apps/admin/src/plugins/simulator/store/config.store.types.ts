import { z } from 'zod';

import {
	SimulatorConfigResSchema,
	SimulatorConfigSchema,
	SimulatorConfigUpdateReqSchema,
} from './config.store.schemas';

export type ISimulatorConfig = z.infer<typeof SimulatorConfigSchema>;

// BACKEND API
// ===========

export type ISimulatorConfigUpdateReq = z.infer<typeof SimulatorConfigUpdateReqSchema>;

export type ISimulatorConfigRes = z.infer<typeof SimulatorConfigResSchema>;
