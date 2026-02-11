/**
 * OpenAPI extra models for Energy module
 */
import { EnergyDeltaEntity } from './entities/energy-delta.entity';
import { EnergyBreakdownItemModel } from './models/energy-breakdown-item.model';
import { EnergyDeltaItemModel } from './models/energy-delta.model';
import {
	EnergyHomeBreakdownResponseModel,
	EnergyHomeSummaryResponseModel,
	EnergyHomeTimeseriesResponseModel,
} from './models/energy-home-response.model';
import { EnergyDeltasResponseModel, EnergySummaryResponseModel } from './models/energy-response.model';
import {
	EnergySpaceBreakdownResponseModel,
	EnergySpaceSummaryResponseModel,
	EnergySpaceTimeseriesResponseModel,
} from './models/energy-space-response.model';
import { EnergySpaceSummaryModel } from './models/energy-space-summary.model';
import { EnergySummaryModel } from './models/energy-summary.model';
import { EnergyTimeseriesPointModel } from './models/energy-timeseries-point.model';

export const ENERGY_SWAGGER_EXTRA_MODELS = [
	// Response models
	EnergySummaryResponseModel,
	EnergyDeltasResponseModel,
	EnergySpaceSummaryResponseModel,
	EnergySpaceTimeseriesResponseModel,
	EnergySpaceBreakdownResponseModel,
	EnergyHomeSummaryResponseModel,
	EnergyHomeTimeseriesResponseModel,
	EnergyHomeBreakdownResponseModel,
	// Data models
	EnergySummaryModel,
	EnergyDeltaItemModel,
	EnergySpaceSummaryModel,
	EnergyTimeseriesPointModel,
	EnergyBreakdownItemModel,
	EnergyDeltaEntity,
];
