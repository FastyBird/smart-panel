import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_ZIGBEE2MQTT_API_TAG_NAME, DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';
import { ReqZ2mWizardAdoptDto } from '../dto/wizard-adopt.dto';
import { Z2mWizardAdoptionResponseModel, Z2mWizardSessionResponseModel } from '../models/zigbee2mqtt-response.model';
import { Z2mWizardService } from '../services/wizard.service';

@ApiTags(DEVICES_ZIGBEE2MQTT_API_TAG_NAME)
@Controller('wizard')
export class Zigbee2mqttWizardController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'WizardController',
	);

	constructor(private readonly wizardService: Z2mWizardService) {}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Start Zigbee2MQTT adoption wizard session',
		description:
			'Creates a wizard session, returning the list of currently unadopted Zigbee devices with mapping previews.',
		operationId: 'create-devices-zigbee2mqtt-plugin-wizard',
	})
	@ApiCreatedSuccessResponse(Z2mWizardSessionResponseModel, 'Wizard session was started successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async startSession(): Promise<Z2mWizardSessionResponseModel> {
		this.logger.debug('Starting Zigbee2MQTT wizard session');

		const response = new Z2mWizardSessionResponseModel();
		response.data = await this.wizardService.start();
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Get Zigbee2MQTT wizard session state',
		description:
			'Returns the current state of the wizard session, including any newly-paired devices that arrived since the last poll and remaining permit_join time.',
		operationId: 'get-devices-zigbee2mqtt-plugin-wizard',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiSuccessResponse(Z2mWizardSessionResponseModel, 'Wizard session was successfully retrieved.')
	@ApiNotFoundResponse('Wizard session could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	getSession(@Param('id') id: string): Z2mWizardSessionResponseModel {
		const session = this.wizardService.get(id);

		if (!session) {
			throw new NotFoundException('Wizard session could not be found');
		}

		const response = new Z2mWizardSessionResponseModel();
		response.data = session;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'End Zigbee2MQTT wizard session',
		description: 'Terminates the wizard session. If permit_join is active for this session it is disabled.',
		operationId: 'delete-devices-zigbee2mqtt-plugin-wizard',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiNoContentResponse({ description: 'Wizard session ended' })
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async endSession(@Param('id') id: string): Promise<void> {
		this.logger.debug(`Ending Zigbee2MQTT wizard session id=${id}`);

		await this.wizardService.end(id);
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Enable Zigbee2MQTT pairing mode (permit_join)',
		description: 'Enables permit_join on the bridge for 254 seconds, scoped to this wizard session.',
		operationId: 'enable-devices-zigbee2mqtt-plugin-wizard-permit-join',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiSuccessResponse(Z2mWizardSessionResponseModel, 'Pairing mode enabled')
	@ApiNotFoundResponse('Wizard session could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/permit-join')
	async enablePermitJoin(@Param('id') id: string): Promise<Z2mWizardSessionResponseModel> {
		const session = await this.wizardService.enablePermitJoin(id);

		if (!session) {
			throw new NotFoundException('Wizard session could not be found');
		}

		const response = new Z2mWizardSessionResponseModel();
		response.data = session;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Disable Zigbee2MQTT pairing mode (permit_join)',
		description: 'Disables permit_join on the bridge.',
		operationId: 'disable-devices-zigbee2mqtt-plugin-wizard-permit-join',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiSuccessResponse(Z2mWizardSessionResponseModel, 'Pairing mode disabled')
	@ApiNotFoundResponse('Wizard session could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id/permit-join')
	async disablePermitJoin(@Param('id') id: string): Promise<Z2mWizardSessionResponseModel> {
		const session = await this.wizardService.disablePermitJoin(id);

		if (!session) {
			throw new NotFoundException('Wizard session could not be found');
		}

		const response = new Z2mWizardSessionResponseModel();
		response.data = session;
		return response;
	}

	@ApiOperation({
		tags: [DEVICES_ZIGBEE2MQTT_API_TAG_NAME],
		summary: 'Adopt selected devices from wizard',
		description:
			'Adopts each requested device with the supplied display name and category. Devices already adopted in another flow are updated instead of created.',
		operationId: 'adopt-devices-zigbee2mqtt-plugin-wizard',
	})
	@ApiParam({ name: 'id', type: 'string' })
	@ApiBody({ type: ReqZ2mWizardAdoptDto })
	@ApiSuccessResponse(Z2mWizardAdoptionResponseModel, 'Adoption results returned')
	@ApiBadRequestResponse('Invalid request data')
	@ApiNotFoundResponse('Wizard session could not be found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/adopt')
	async adopt(@Param('id') id: string, @Body() body: ReqZ2mWizardAdoptDto): Promise<Z2mWizardAdoptionResponseModel> {
		this.logger.debug(`Adopting Zigbee2MQTT wizard devices session=${id} count=${body.data.devices.length}`);

		const results = await this.wizardService.adopt(id, body.data.devices);

		if (results === null) {
			throw new NotFoundException('Wizard session could not be found');
		}

		const response = new Z2mWizardAdoptionResponseModel();
		response.data = { results } as never;
		return response;
	}
}
