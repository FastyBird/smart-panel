/**
 * OpenAPI extra models for Energy module
 */
import { EnergyDeltaEntity } from './entities/energy-delta.entity';
import { EnergyDeltaItemModel } from './models/energy-delta.model';
import { EnergyDeltasResponseModel, EnergySummaryResponseModel } from './models/energy-response.model';
import { EnergySummaryModel } from './models/energy-summary.model';

export const ENERGY_SWAGGER_EXTRA_MODELS = [
	// Response models
	EnergySummaryResponseModel,
	EnergyDeltasResponseModel,
	// Data models
	EnergySummaryModel,
	EnergyDeltaItemModel,
	EnergyDeltaEntity,
];
