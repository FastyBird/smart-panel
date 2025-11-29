/**
 * OpenAPI extra models for Websocket module
 */
import { Type } from '@nestjs/common';

import { Availability5mModel, ClientsNowModel, ModuleStatsModel } from './models/ws.model';

export const WEBSOCKET_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Data models
	ClientsNowModel,
	Availability5mModel,
	ModuleStatsModel,
];
