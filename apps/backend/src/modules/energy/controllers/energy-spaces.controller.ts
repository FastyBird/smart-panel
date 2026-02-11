import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ENERGY_MODULE_API_TAG_NAME } from '../energy.constants';
import { resolveEnergyRange } from '../helpers/energy-range.helper';
import { EnergyBreakdownItemModel } from '../models/energy-breakdown-item.model';
import {
	EnergySpaceBreakdownResponseModel,
	EnergySpaceSummaryResponseModel,
	EnergySpaceTimeseriesResponseModel,
} from '../models/energy-space-response.model';
import { EnergySpaceSummaryModel } from '../models/energy-space-summary.model';
import { EnergyTimeseriesPointModel } from '../models/energy-timeseries-point.model';
import { EnergyDataService } from '../services/energy-data.service';

@ApiTags(ENERGY_MODULE_API_TAG_NAME)
@Controller('energy/spaces')
export class EnergySpacesController {
	constructor(private readonly energyData: EnergyDataService) {}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get space energy summary',
		description:
			'Returns total consumption, production, and net energy in kWh for a space over the requested time range. ' +
			'Aggregates data from all rooms belonging to the space. Use spaceId "home" to get whole-home totals. ' +
			'Ranges use Europe/Prague timezone: today = midnight to now, week = 7 days ago midnight to now, month = 30 days ago midnight to now. ' +
			'netKwh = totalConsumptionKwh - totalProductionKwh (positive = net consumption).',
		operationId: 'get-energy-module-space-summary',
	})
	@ApiParam({
		name: 'spaceId',
		type: 'string',
		description: 'Space UUID, or "home" for whole-home aggregation.',
		example: 'home',
	})
	@ApiQuery({
		name: 'range',
		required: false,
		type: 'string',
		enum: ['today', 'yesterday', 'week', 'month'],
		description: 'Time range for the summary. Defaults to "today".',
		example: 'today',
	})
	@ApiSuccessResponse(EnergySpaceSummaryResponseModel, 'Space energy summary retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get(':spaceId/summary')
	async getSpaceSummary(
		@Param('spaceId') spaceId: string,
		@Query('range') range?: string,
	): Promise<EnergySpaceSummaryResponseModel> {
		const { start, end } = resolveEnergyRange(range);
		const summary = await this.energyData.getSpaceSummary(start, end, spaceId);

		const model = new EnergySpaceSummaryModel();
		model.totalConsumptionKwh = summary.totalConsumptionKwh;
		model.totalProductionKwh = summary.totalProductionKwh;
		model.totalGridImportKwh = summary.totalGridImportKwh;
		model.totalGridExportKwh = summary.totalGridExportKwh;
		model.netKwh = summary.netKwh;
		model.netGridKwh = summary.netGridKwh;
		model.hasGridMetrics = summary.hasGridMetrics;
		const validRanges = ['today', 'yesterday', 'week', 'month'];
		model.range = range && validRanges.includes(range) ? range : 'today';
		model.lastUpdatedAt = summary.lastUpdatedAt;

		const response = new EnergySpaceSummaryResponseModel();
		response.data = model;

		return response;
	}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get space energy time-series',
		description:
			'Returns time-series energy data points for a space, aggregated into the requested interval. ' +
			'Supports 5m (native), 1h, and 1d intervals. Missing intervals are zero-filled for UI friendliness. ' +
			'Ranges use Europe/Prague timezone.',
		operationId: 'get-energy-module-space-timeseries',
	})
	@ApiParam({
		name: 'spaceId',
		type: 'string',
		description: 'Space UUID, or "home" for whole-home aggregation.',
		example: 'home',
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
	@ApiSuccessResponse(EnergySpaceTimeseriesResponseModel, 'Space energy time-series retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get(':spaceId/timeseries')
	async getSpaceTimeseries(
		@Param('spaceId') spaceId: string,
		@Query('range') range?: string,
		@Query('interval') interval?: string,
	): Promise<EnergySpaceTimeseriesResponseModel> {
		const resolvedInterval = interval || '1h';
		const { start, end } = resolveEnergyRange(range);
		const points = await this.energyData.getSpaceTimeseries(start, end, resolvedInterval, spaceId);

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

		const response = new EnergySpaceTimeseriesResponseModel();
		response.data = items;

		return response;
	}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get space energy breakdown',
		description:
			'Returns a breakdown of top energy-consuming devices within a space, sorted by consumption descending. ' +
			'Only considers consumption_import source type. Includes device and room names for display.',
		operationId: 'get-energy-module-space-breakdown',
	})
	@ApiParam({
		name: 'spaceId',
		type: 'string',
		description: 'Space UUID, or "home" for whole-home breakdown.',
		example: 'home',
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
	@ApiSuccessResponse(EnergySpaceBreakdownResponseModel, 'Space energy breakdown retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get(':spaceId/breakdown')
	async getSpaceBreakdown(
		@Param('spaceId') spaceId: string,
		@Query('range') range?: string,
		@Query('limit') limitStr?: string,
	): Promise<EnergySpaceBreakdownResponseModel> {
		const parsedLimit = limitStr !== undefined ? parseInt(limitStr, 10) : NaN;
		const limit = Number.isNaN(parsedLimit) ? 10 : Math.max(1, Math.min(100, parsedLimit));
		const { start, end } = resolveEnergyRange(range);
		const items = await this.energyData.getSpaceBreakdown(start, end, spaceId, limit);

		const models: EnergyBreakdownItemModel[] = items.map((item) => {
			const model = new EnergyBreakdownItemModel();
			model.deviceId = item.deviceId;
			model.deviceName = item.deviceName;
			model.roomId = item.roomId;
			model.roomName = item.roomName;
			model.consumptionKwh = item.consumptionKwh;
			return model;
		});

		const response = new EnergySpaceBreakdownResponseModel();
		response.data = models;

		return response;
	}
}
