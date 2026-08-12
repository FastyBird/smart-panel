import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiServiceUnavailableResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_WLED_API_TAG_NAME } from '../devices-wled.constants';
import { WledAdoptRequestDto, WledProbeRequestDto } from '../dto/wled-adoption.dto';
import {
	WledAdoptionResultsResponseModel,
	WledDiscoveryResponseModel,
	WledProbedDeviceResponseModel,
} from '../models/wled-discovery.model';
import { WledService } from '../services/wled.service';

@ApiTags(DEVICES_WLED_API_TAG_NAME)
@Controller('discovery')
export class WledDiscoveryController {
	constructor(private readonly wledService: WledService) {}

	@ApiOperation({
		tags: [DEVICES_WLED_API_TAG_NAME],
		summary: 'Get WLED adoption inventory',
		description: 'Returns all mDNS candidates with their current Smart Panel adoption state.',
		operationId: 'get-devices-wled-plugin-discovery',
	})
	@ApiSuccessResponse(WledDiscoveryResponseModel, 'WLED discovery inventory')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getDiscovery(): Promise<WledDiscoveryResponseModel> {
		const response = new WledDiscoveryResponseModel();
		response.data = await this.wledService.getDiscoveryInventory();
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_WLED_API_TAG_NAME],
		summary: 'Rescan for WLED devices',
		description: 'Restarts mDNS discovery and clears stale discovery candidates.',
		operationId: 'rescan-devices-wled-plugin-discovery',
	})
	@ApiSuccessResponse(WledDiscoveryResponseModel, 'WLED discovery was restarted')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('rescan')
	@HttpCode(200)
	async rescanDiscovery(): Promise<WledDiscoveryResponseModel> {
		const response = new WledDiscoveryResponseModel();
		response.data = await this.wledService.rescanDiscovery();
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_WLED_API_TAG_NAME],
		summary: 'Probe a WLED device',
		description: 'Loads WLED identity and metadata without persisting or registering a device connection.',
		operationId: 'probe-devices-wled-plugin-discovery',
	})
	@ApiBody({ type: WledProbeRequestDto })
	@ApiCreatedSuccessResponse(WledProbedDeviceResponseModel, 'WLED device was probed successfully')
	@ApiBadRequestResponse('Invalid hostname or IP address')
	@ApiServiceUnavailableResponse('WLED device is unavailable')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('probe')
	async probeDevice(@Body() body: WledProbeRequestDto): Promise<WledProbedDeviceResponseModel> {
		const response = new WledProbedDeviceResponseModel();
		response.data = await this.wledService.probeDevice(body.data.host);
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_WLED_API_TAG_NAME],
		summary: 'Adopt WLED devices',
		description: 'Probes and provisions each selected WLED device, returning an independent result for every item.',
		operationId: 'adopt-devices-wled-plugin-discovery',
	})
	@ApiBody({ type: WledAdoptRequestDto })
	@ApiSuccessResponse(WledAdoptionResultsResponseModel, 'WLED adoption results')
	@ApiBadRequestResponse('Invalid adoption request')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('adopt')
	@HttpCode(200)
	async adoptDevices(@Body() body: WledAdoptRequestDto): Promise<WledAdoptionResultsResponseModel> {
		const response = new WledAdoptionResultsResponseModel();
		response.data = await this.wledService.adoptDevices(body.data.devices);
		return response;
	}
}
