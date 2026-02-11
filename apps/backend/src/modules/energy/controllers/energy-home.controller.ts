import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ENERGY_MODULE_API_TAG_NAME } from '../energy.constants';
import { normalizeEnergyRange, resolveEnergyRange } from '../helpers/energy-range.helper';
import { EnergyBreakdownItemModel } from '../models/energy-breakdown-item.model';
import {
	EnergyHomeBreakdownResponseModel,
	EnergyHomeSummaryResponseModel,
	EnergyHomeTimeseriesResponseModel,
} from '../models/energy-home-response.model';
import { EnergySpaceSummaryModel } from '../models/energy-space-summary.model';
import { EnergyTimeseriesPointModel } from '../models/energy-timeseries-point.model';
import { EnergyCacheService } from '../services/energy-cache.service';
import { EnergyDataService } from '../services/energy-data.service';

@ApiTags(ENERGY_MODULE_API_TAG_NAME)
@Controller('energy/home')
export class EnergyHomeController {
	constructor(
		private readonly energyData: EnergyDataService,
		private readonly cache: EnergyCacheService,
	) {}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get home energy summary',
		description:
			'Returns total consumption, production, grid import/export, and net energy in kWh aggregated across all spaces and devices (including unassigned). ' +
			'Results are cached with a configurable TTL (default 30s) to reduce query load. ' +
			'Ranges use Europe/Prague timezone: today = midnight to now, week = 7 days ago midnight to now, month = 30 days ago midnight to now.',
		operationId: 'get-energy-module-home-summary',
	})
	@ApiQuery({
		name: 'range',
		required: false,
		type: 'string',
		enum: ['today', 'yesterday', 'week', 'month'],
		description: 'Time range for the summary. Defaults to "today".',
		example: 'today',
	})
	@ApiSuccessResponse(EnergyHomeSummaryResponseModel, 'Home energy summary retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get('summary')
	async getHomeSummary(@Query('range') range?: string): Promise<EnergyHomeSummaryResponseModel> {
		const resolvedRange = normalizeEnergyRange(range);
		const cacheKey = `home:summary:${resolvedRange}`;

		const summary = await this.cache.getOrCompute(cacheKey, async () => {
			const { start, end } = resolveEnergyRange(resolvedRange);

			return this.energyData.getSpaceSummary(start, end, 'home');
		});

		const model = new EnergySpaceSummaryModel();
		model.totalConsumptionKwh = summary.totalConsumptionKwh;
		model.totalProductionKwh = summary.totalProductionKwh;
		model.totalGridImportKwh = summary.totalGridImportKwh;
		model.totalGridExportKwh = summary.totalGridExportKwh;
		model.netKwh = summary.netKwh;
		model.netGridKwh = summary.netGridKwh;
		model.hasGridMetrics = summary.hasGridMetrics;
		model.range = resolvedRange;
		model.lastUpdatedAt = summary.lastUpdatedAt;

		const response = new EnergyHomeSummaryResponseModel();
		response.data = model;

		return response;
	}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get home energy time-series',
		description:
			'Returns time-series energy data points aggregated across all spaces and devices (including unassigned). ' +
			'Supports 5m (native), 1h, and 1d intervals. Missing intervals are zero-filled. ' +
			'Results are cached with a configurable TTL (default 30s). ' +
			'Ranges use Europe/Prague timezone.',
		operationId: 'get-energy-module-home-timeseries',
	})
	@ApiQuery({
		name: 'range',
		required: false,
		type: 'string',
		enum: ['today', 'yesterday', 'week', 'month'],
		description: 'Time range for the time-series. Defaults to "today".',
		example: 'today',
	})
	@ApiQuery({
		name: 'interval',
		required: false,
		type: 'string',
		enum: ['5m', '1h', '1d'],
		description: 'Aggregation interval for data points. Defaults to "1h".',
		example: '1h',
	})
	@ApiSuccessResponse(EnergyHomeTimeseriesResponseModel, 'Home energy time-series retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get('timeseries')
	async getHomeTimeseries(
		@Query('range') range?: string,
		@Query('interval') interval?: string,
	): Promise<EnergyHomeTimeseriesResponseModel> {
		const resolvedRange = normalizeEnergyRange(range);
		const resolvedInterval = interval || '1h';
		const cacheKey = `home:timeseries:${resolvedRange}:${resolvedInterval}`;

		const points = await this.cache.getOrCompute(cacheKey, async () => {
			const { start, end } = resolveEnergyRange(resolvedRange);

			return this.energyData.getSpaceTimeseries(start, end, resolvedInterval, 'home');
		});

		const items: EnergyTimeseriesPointModel[] = points.map((point) => {
			const model = new EnergyTimeseriesPointModel();
			model.intervalStart = point.intervalStart;
			model.intervalEnd = point.intervalEnd;
			model.consumptionDeltaKwh = point.consumptionDeltaKwh;
			model.productionDeltaKwh = point.productionDeltaKwh;
			model.gridImportDeltaKwh = point.gridImportDeltaKwh;
			model.gridExportDeltaKwh = point.gridExportDeltaKwh;
			return model;
		});

		const response = new EnergyHomeTimeseriesResponseModel();
		response.data = items;

		return response;
	}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get home energy breakdown',
		description:
			'Returns a breakdown of top energy-consuming devices across all spaces, sorted by consumption descending. ' +
			'Only considers consumption_import source type. Includes device and room names for display.',
		operationId: 'get-energy-module-home-breakdown',
	})
	@ApiQuery({
		name: 'range',
		required: false,
		type: 'string',
		enum: ['today', 'yesterday', 'week', 'month'],
		description: 'Time range for the breakdown. Defaults to "today".',
		example: 'today',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: 'number',
		description: 'Maximum number of devices to return. Defaults to 10.',
		example: 10,
	})
	@ApiSuccessResponse(EnergyHomeBreakdownResponseModel, 'Home energy breakdown retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get('breakdown')
	async getHomeBreakdown(
		@Query('range') range?: string,
		@Query('limit') limitStr?: string,
	): Promise<EnergyHomeBreakdownResponseModel> {
		const parsedLimit = limitStr !== undefined ? parseInt(limitStr, 10) : NaN;
		const limit = Number.isNaN(parsedLimit) ? 10 : Math.max(1, Math.min(100, parsedLimit));
		const { start, end } = resolveEnergyRange(range);
		const items = await this.energyData.getSpaceBreakdown(start, end, 'home', limit);

		const models: EnergyBreakdownItemModel[] = items.map((item) => {
			const model = new EnergyBreakdownItemModel();
			model.deviceId = item.deviceId;
			model.deviceName = item.deviceName;
			model.roomId = item.roomId;
			model.roomName = item.roomName;
			model.consumptionKwh = item.consumptionKwh;
			return model;
		});

		const response = new EnergyHomeBreakdownResponseModel();
		response.data = models;

		return response;
	}
}
