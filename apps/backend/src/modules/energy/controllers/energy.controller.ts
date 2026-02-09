import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ENERGY_MODULE_API_TAG_NAME } from '../energy.constants';
import { EnergyDeltaItemModel } from '../models/energy-delta.model';
import { EnergyDeltasResponseModel, EnergySummaryResponseModel } from '../models/energy-response.model';
import { EnergySummaryModel } from '../models/energy-summary.model';
import { EnergyDataService } from '../services/energy-data.service';

/**
 * Compute the start/end date for a given range keyword.
 */
function resolveRange(range?: string): { start: Date; end: Date } {
	const now = new Date();
	const end = now;

	switch (range) {
		case 'yesterday': {
			const dayStart = new Date(now);
			dayStart.setDate(dayStart.getDate() - 1);
			dayStart.setHours(0, 0, 0, 0);

			const dayEnd = new Date(dayStart);
			dayEnd.setHours(23, 59, 59, 999);

			return { start: dayStart, end: dayEnd };
		}
		case 'week': {
			const weekStart = new Date(now);
			weekStart.setDate(weekStart.getDate() - 7);
			weekStart.setHours(0, 0, 0, 0);

			return { start: weekStart, end };
		}
		case 'month': {
			const monthStart = new Date(now);
			monthStart.setDate(monthStart.getDate() - 30);
			monthStart.setHours(0, 0, 0, 0);

			return { start: monthStart, end };
		}
		case 'today':
		default: {
			const dayStart = new Date(now);
			dayStart.setHours(0, 0, 0, 0);

			return { start: dayStart, end };
		}
	}
}

@ApiTags(ENERGY_MODULE_API_TAG_NAME)
@Controller('energy')
export class EnergyController {
	constructor(private readonly energyData: EnergyDataService) {}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get energy summary',
		description:
			'Returns total consumption and production kWh for the requested time range, optionally filtered by room.',
		operationId: 'get-energy-module-summary',
	})
	@ApiQuery({
		name: 'room_id',
		required: false,
		type: 'string',
		description: 'Filter by room UUID.',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@ApiQuery({
		name: 'range',
		required: false,
		type: 'string',
		enum: ['today', 'yesterday', 'week', 'month'],
		description: 'Time range for the summary. Defaults to "today".',
		example: 'today',
	})
	@ApiSuccessResponse(EnergySummaryResponseModel, 'Energy summary retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get('summary')
	async getSummary(
		@Query('room_id') roomId?: string,
		@Query('range') range?: string,
	): Promise<EnergySummaryResponseModel> {
		const { start, end } = resolveRange(range);
		const summary = await this.energyData.getSummary(start, end, roomId);

		const model = new EnergySummaryModel();
		model.totalConsumptionKwh = summary.totalConsumptionKwh;
		model.totalProductionKwh = summary.totalProductionKwh;
		model.lastUpdatedAt = summary.lastUpdatedAt;

		const response = new EnergySummaryResponseModel();
		response.data = model;

		return response;
	}

	@ApiOperation({
		tags: [ENERGY_MODULE_API_TAG_NAME],
		summary: 'Get energy deltas',
		description:
			'Returns per-interval energy deltas (consumption and production) for the requested time range, optionally filtered by room.',
		operationId: 'get-energy-module-deltas',
	})
	@ApiQuery({
		name: 'room_id',
		required: false,
		type: 'string',
		description: 'Filter by room UUID.',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@ApiQuery({
		name: 'range',
		required: false,
		type: 'string',
		enum: ['today', 'yesterday', 'week', 'month'],
		description: 'Time range for the deltas. Defaults to "today".',
		example: 'today',
	})
	@ApiSuccessResponse(EnergyDeltasResponseModel, 'Energy deltas retrieved successfully.')
	@ApiBadRequestResponse('Invalid request parameters.')
	@ApiInternalServerErrorResponse()
	@Get('deltas')
	async getDeltas(
		@Query('room_id') roomId?: string,
		@Query('range') range?: string,
	): Promise<EnergyDeltasResponseModel> {
		const { start, end } = resolveRange(range);
		const rows = await this.energyData.getDeltas(start, end, roomId);

		const items: EnergyDeltaItemModel[] = rows.map((row) => {
			const item = new EnergyDeltaItemModel();
			item.intervalStart = row.intervalStart;
			item.intervalEnd = row.intervalEnd;
			item.consumptionDeltaKwh = row.consumptionDeltaKwh;
			item.productionDeltaKwh = row.productionDeltaKwh;
			return item;
		});

		const response = new EnergyDeltasResponseModel();
		response.data = items;

		return response;
	}
}
