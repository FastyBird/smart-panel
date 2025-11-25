import { Body, Controller, HttpCode, Logger, Put } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiUnprocessableEntityResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { toInstance } from '../../../common/utils/transform.utils';
import { RawRoute } from '../../../modules/api/decorators/raw-route.decorator';
import { Public } from '../../../modules/auth/guards/auth.guard';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';
import { PropertiesUpdateRequestDto } from '../dto/third-party-property-update-request.dto';
import { ThirdPartyDemoControlModel } from '../models/demo-control.model';

@ApiTags('devices-third-party-plugin')
@Controller('demo')
export class ThirdPartyDemoController {
	private readonly logger = new Logger(ThirdPartyDemoController.name);
	private queue: { [key: string]: NodeJS.Timeout } = {};

	constructor(private readonly channelsPropertiesService: ChannelsPropertiesService) {}

	@ApiOperation({
		summary: 'Demo webhook endpoint for third-party device property updates',
	})
	@ApiBody({
		type: PropertiesUpdateRequestDto,
		description: 'Array of device properties to update',
	})
	@ApiNoContentResponse({
		description: 'Properties update request processed successfully',
	})
	@ApiBadRequestResponse('Invalid request data or malformed property values')
	@ApiUnprocessableEntityResponse('One or more properties could not be updated')
	@ApiInternalServerErrorResponse('Internal server error occurred while processing the request')
	@RawRoute()
	@Public()
	@Put('webhook')
	@HttpCode(204)
	async controlDevice(@Body() body: PropertiesUpdateRequestDto): Promise<ThirdPartyDemoControlModel> {
		this.logger.debug('[THIRD-PARTY][DEMO CONTROLLER] Execute demo property update');

		const response = {
			properties: [],
		};

		for (const property of body.properties) {
			response.properties.push({
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

		return toInstance(ThirdPartyDemoControlModel, response);
	}
}
