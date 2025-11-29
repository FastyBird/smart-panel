/**
 * OpenAPI extra models for Stats module
 */
import { Type } from '@nestjs/common';

import { StatResponseModel, StatsKeysResponseModel, StatsResponseModel } from './models/stats-response.model';
import { AllStatsModel, StatModel, StatsKeysModel } from './models/stats.model';

export const STATS_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Response models
	StatsResponseModel,
	StatResponseModel,
	StatsKeysResponseModel,
	// Data models
	AllStatsModel,
	StatModel,
	StatsKeysModel,
];
