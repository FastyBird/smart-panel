import { Body, Controller, Logger, Put } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import { RawRoute } from '../../../modules/api/decorators/raw-route.decorator';
import { Public } from '../../../modules/auth/guards/auth.guard';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME } from '../devices-third-party.constants';
import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';
import { PropertiesUpdateRequestDto } from '../dto/third-party-property-update-request.dto';
import { DemoControlResponseModel } from '../models/demo-control-response.model';
import { ThirdPartyDemoControlModel } from '../models/demo-control.model';

@ApiTags(DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME)
@Controller('demo')
export class ThirdPartyDemoController {
	private readonly logger = new Logger(ThirdPartyDemoController.name);
	private queue: { [key: string]: NodeJS.Timeout } = {};

	constructor(private readonly channelsPropertiesService: ChannelsPropertiesService) {}

	@ApiOperation({
		tags: [DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME],
		summary: 'Demo webhook endpoint for third-party device property updates',
		description:
			'Processes property update requests from third-party devices. This endpoint accepts an array of property update requests and returns the processing status for each property. Properties are updated asynchronously with a debounce delay to optimize performance.',
		operationId: 'update-devices-third-party-plugin-demo-properties',
	})
	@ApiBody({
		type: PropertiesUpdateRequestDto,
		description: 'Array of device properties to update',
	})
	@ApiSuccessResponse(
		DemoControlResponseModel,
		'Properties update request processed successfully. The response includes the status for each property update request.',
	)
	@ApiBadRequestResponse('Invalid request data or malformed property values')
	@ApiUnprocessableEntityResponse('One or more properties could not be updated')
	@ApiInternalServerErrorResponse('Internal server error occurred while processing the request')
	@RawRoute()
	@Public()
	@Put('webhook')
	async controlDevice(@Body() body: PropertiesUpdateRequestDto): Promise<DemoControlResponseModel> {
		this.logger.debug('[THIRD-PARTY][DEMO CONTROLLER] Execute demo property update');

		const controlData = {
			properties: [],
		};

		for (const property of body.properties) {
			controlData.properties.push({
				...property,
				status: ThirdPartyPropertiesUpdateStatus.SUCCESS,
			});
		}

		for (const update of body.properties) {
			const property = await this.channelsPropertiesService.findOne(update.property);

			if (property === null) {
				this.logger.warn(
					`[THIRD-PARTY][DEMO CONTROLLER] Property to update was not found in system ${update.property}`,
				);

				continue;
			}

			if (property.id in this.queue) {
				clearTimeout(this.queue[property.id]);
			}

			this.queue[property.id] = setTimeout(() => {
				void (async () => {
					this.logger.debug(
						`[THIRD-PARTY][DEMO CONTROLLER] Updating property ${property.id} with value ${update.value}`,
					);

					await this.channelsPropertiesService.update(property.id, {
						type: property.type,
						value: update.value,
					});

					delete this.queue[property.id];
				})();
			}, 500);
		}

		const controlModel = toInstance(ThirdPartyDemoControlModel, controlData);

		const response = new DemoControlResponseModel();
		response.data = controlModel;

		return response;
	}
}
