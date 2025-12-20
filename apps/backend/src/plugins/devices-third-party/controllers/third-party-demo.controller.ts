import { FastifyReply } from 'fastify';

import { Body, Controller, HttpCode, HttpStatus, Logger, Put, Res } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';

import { RawRoute } from '../../../modules/api/decorators/raw-route.decorator';
import { Public } from '../../../modules/auth/guards/auth.guard';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_THIRD_PARTY_PLUGIN_API_TAG_NAME,
	ThirdPartyPropertiesUpdateStatus,
} from '../devices-third-party.constants';
import { ReqUpdatePropertiesDto } from '../dto/third-party-property-update-request.dto';
import { PropertyUpdateResultModel } from '../dto/third-party-property-update-response.dto';
import { PropertiesUpdateResultResponseModel } from '../models/demo-control-response.model';

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
		servers: [
			{
				url: 'http://third-party.device.local',
				description: 'Dummy local URL for third-party device webhook',
			},
		],
	})
	@ApiBody({
		type: ReqUpdatePropertiesDto,
		description: 'Array of device properties to update',
	})
	@ApiNoContentResponse({
		description:
			'No Content. Indicates that the request was successfully processed and no further response is required.',
	})
	@ApiResponse({
		status: 207,
		description: 'Response from the third-party device after processing the update request.',
		content: {
			'application/json': {
				schema: { $ref: getSchemaPath(PropertiesUpdateResultResponseModel) },
				examples: {
					'Example 1': {
						value: {
							properties: [
								{
									device: '234e5678-a89b-22d3-c456-426614174133',
									channel: '456e7890-c89d-42d5-e678-626816194355',
									property: 'b27b7c58-76f6-407a-bc78-4068e4cfd082',
									status: -80003,
								},
							],
						},
					},
				},
			},
		},
	})
	@ApiBadRequestResponse(
		'Bad Request. Indicates that the request was invalid, possibly due to missing or malformed data.',
	)
	@ApiInternalServerErrorResponse('Internal Server Error. Indicates a server-side error while processing the request.')
	@RawRoute()
	@Public()
	@Put('webhook')
	@HttpCode(HttpStatus.NO_CONTENT)
	async controlDevice(@Body() body: ReqUpdatePropertiesDto, @Res() res: FastifyReply): Promise<void> {
		this.logger.debug('Execute demo property update');

		const results: PropertyUpdateResultModel[] = [];
		let hasErrors = false;

		for (const update of body.properties) {
			const property = await this.channelsPropertiesService.findOne(update.property);

			if (property === null) {
				this.logger.warn(`Property to update was not found in system ${update.property}`);

				results.push({
					device: update.device,
					channel: update.channel,
					property: update.property,
					status: ThirdPartyPropertiesUpdateStatus.RESOURCE_NOT_FOUND,
				});
				hasErrors = true;

				continue;
			}

			results.push({
				device: update.device,
				channel: update.channel,
				property: update.property,
				status: ThirdPartyPropertiesUpdateStatus.SUCCESS,
			});

			if (property.id in this.queue) {
				clearTimeout(this.queue[property.id]);
			}

			this.queue[property.id] = setTimeout(() => {
				void (async () => {
					this.logger.debug(`Updating property ${property.id} with value ${update.value}`);

					await this.channelsPropertiesService.update(property.id, {
						type: property.type,
						value: update.value,
					});

					delete this.queue[property.id];
				})();
			}, 500);
		}

		// If all properties succeeded, return 204 No Content
		if (!hasErrors) {
			return res.status(HttpStatus.NO_CONTENT).send();
		}

		// If there are errors, return 207 Multi-Status with results
		return res.status(HttpStatus.MULTI_STATUS).send({
			properties: results,
		});
	}
}
