export const ENERGY_MODULE_PREFIX = 'energy';

export const ENERGY_MODULE_NAME = 'energy-module';

export const ENERGY_MODULE_API_TAG_NAME = 'Energy module';

export const ENERGY_MODULE_API_TAG_DESCRIPTION =
	'Provides endpoints for retrieving energy consumption and production data, including per-interval deltas computed from cumulative kWh meter readings.';

/**
 * Fixed interval size for delta bucketing (in minutes).
 */
export const DELTA_INTERVAL_MINUTES = 5;

export enum EnergySourceType {
	CONSUMPTION_IMPORT = 'consumption_import',
	GENERATION_PRODUCTION = 'generation_production',
}
