import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME } from '../devices-homekit.constants';
import { ReqHomeKitMapDevicesDto } from '../dto/bridge-map.dto';
import { HomeKitCandidatesResponseModel } from '../models/bridge-candidate.model';
import { HomeKitBridgeStatusResponseModel } from '../models/bridge-status.model';
import { HomeKitBridgeService } from '../services/homekit-bridge.service';
import { HomeKitWizardService } from '../services/homekit-wizard.service';

@ApiTags(DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME)
@Controller('bridge')
export class HomeKitBridgeController {
	constructor(
		private readonly bridgeService: HomeKitBridgeService,
		private readonly wizardService: HomeKitWizardService,
	) {}

	@ApiOperation({
		tags: [DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME],
		summary: 'Get HomeKit Gateway bridge status',
		description: 'Returns runtime bridge status, pairing status, pairing setup URI, and QR code data URL.',
		operationId: 'get-devices-homekit-plugin-bridge-status',
	})
	@ApiSuccessResponse(HomeKitBridgeStatusResponseModel, 'HomeKit Gateway status was successfully retrieved')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('status')
	async getStatus(): Promise<HomeKitBridgeStatusResponseModel> {
		const status = await this.bridgeService.getStatus();
		const response = new HomeKitBridgeStatusResponseModel();
		response.data = status;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME],
		summary: 'Reset HomeKit pairing and generate fresh credentials',
		description:
			'Clears all existing paired Apple Home controllers, generates new MAC address, and unpairs the bridge.',
		operationId: 'reset-devices-homekit-plugin-pairing',
	})
	@ApiCreatedSuccessResponse(HomeKitBridgeStatusResponseModel, 'HomeKit pairing was successfully reset')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('reset-pairing')
	async resetPairing(): Promise<HomeKitBridgeStatusResponseModel> {
		await this.bridgeService.resetPairing();
		const status = await this.bridgeService.getStatus();
		const response = new HomeKitBridgeStatusResponseModel();
		response.data = status;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME],
		summary: 'Get all device candidates for HomeKit mapping',
		description:
			'Returns all registered Smart Panel devices with compatibility, suggested service type, and current mapping status.',
		operationId: 'get-devices-homekit-plugin-candidates',
	})
	@ApiSuccessResponse(HomeKitCandidatesResponseModel, 'Device candidates were successfully retrieved')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('candidates')
	async getCandidates(): Promise<HomeKitCandidatesResponseModel> {
		const candidates = await this.wizardService.getCandidates();
		const response = new HomeKitCandidatesResponseModel();
		response.data = candidates;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME],
		summary: 'Update mapped devices bridged into HomeKit',
		description:
			'Updates the list of Smart Panel devices exposed to Apple Home, dynamically updating the active bridge.',
		operationId: 'map-devices-homekit-plugin-candidates',
	})
	@ApiBody({ type: ReqHomeKitMapDevicesDto })
	@ApiCreatedSuccessResponse(HomeKitCandidatesResponseModel, 'Mapped devices were successfully updated')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('candidates/map')
	async mapDevices(@Body() body: ReqHomeKitMapDevicesDto): Promise<HomeKitCandidatesResponseModel> {
		await this.wizardService.mapDevices(body.data.device_ids);
		const candidates = await this.wizardService.getCandidates();
		const response = new HomeKitCandidatesResponseModel();
		response.data = candidates;
		return response;
	}
}
