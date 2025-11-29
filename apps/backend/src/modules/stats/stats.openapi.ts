/**
 * OpenAPI extra models for Stats module
 */
import { StatResponseModel, StatsKeysResponseModel, StatsResponseModel } from './models/stats-response.model';
import { AllStatsModel, StatModel, StatsKeysModel } from './models/stats.model';

export const STATS_SWAGGER_EXTRA_MODELS = [
	// Response models
	StatsResponseModel,
	StatResponseModel,
	StatsKeysResponseModel,
	// Data models
	AllStatsModel,
	StatModel,
	StatsKeysModel,
];
