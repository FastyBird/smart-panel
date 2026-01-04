import { Body, Controller, Get, NotFoundException, Param, Post, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceResponseModel } from '../../../modules/devices/models/devices-response.model';
import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME,
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
} from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { AdoptHelperRequestDto, HelperMappingPreviewRequestDto } from '../dto/helper-mapping-preview.dto';
import { HelperMappingPreviewResponseModel } from '../models/helper-mapping-preview.model';
import {
	HomeAssistantDiscoveredHelperResponseModel,
	HomeAssistantDiscoveredHelpersResponseModel,
} from '../models/home-assistant-response.model';
import { HelperAdoptionService } from '../services/helper-adoption.service';
import { HelperMappingPreviewService } from '../services/helper-mapping-preview.service';
import { HomeAssistantHttpService } from '../services/home-assistant.http.service';

@ApiTags(DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME)
@Controller('discovered-helpers')
export class HomeAssistantDiscoveredHelpersController {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HomeAssistantDiscoveredHelpersController',
	);

	constructor(
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly helperMappingPreviewService: HelperMappingPreviewService,
		private readonly helperAdoptionService: HelperAdoptionService,
	) {}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Retrieve all Home Assistant discovered helpers',
		description:
			'Fetches a list of all Home Assistant helpers (entities without device_id) that can be adopted into the Smart Panel ecosystem.',
		operationId: 'get-devices-home-assistant-plugin-helpers',
	})
	@ApiSuccessResponse(
		HomeAssistantDiscoveredHelpersResponseModel,
		'A list of Home Assistant discovered helpers successfully retrieved',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Home Assistant discovered helpers could not be loaded')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<HomeAssistantDiscoveredHelpersResponseModel> {
		this.logger.debug('Fetching all Home Assistant discovered helpers');

		try {
			const helpers = await this.homeAssistantHttpService.getDiscoveredHelpers();

			this.logger.debug(`Retrieved ${helpers.length} discovered helpers`);

			const response = new HomeAssistantDiscoveredHelpersResponseModel();
			response.data = helpers;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant discovered helpers could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error('Loading Home Assistant discovered helpers failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Retrieve a Home Assistant discovered helper by entity ID',
		description: 'Fetches a specific Home Assistant discovered helper by its entity ID.',
		operationId: 'get-devices-home-assistant-plugin-helper',
	})
	@ApiParam({ name: 'entityId', type: 'string', description: 'Helper entity ID (e.g., input_boolean.my_toggle)' })
	@ApiSuccessResponse(
		HomeAssistantDiscoveredHelperResponseModel,
		'A Home Assistant discovered helper successfully retrieved',
	)
	@ApiBadRequestResponse('Invalid entity ID format')
	@ApiNotFoundResponse('Home Assistant discovered helper not found')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':entityId')
	async findOne(@Param('entityId') entityId: string): Promise<HomeAssistantDiscoveredHelperResponseModel> {
		this.logger.debug(`Fetching Home Assistant discovered helper entityId=${entityId}`);

		try {
			const helper = await this.homeAssistantHttpService.getDiscoveredHelper(entityId);

			this.logger.debug(`Found Home Assistant discovered helper entityId=${helper.entityId}`);

			const response = new HomeAssistantDiscoveredHelperResponseModel();
			response.data = helper;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(
					'Home Assistant discovered helper could not be loaded from Home Assistant instance',
				);
			}

			this.logger.error('Loading Home Assistant discovered helper failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Preview helper mapping',
		description:
			'Generates a preview of how a Home Assistant helper would be mapped to Smart Panel entities. ' +
			'Returns suggested device category, channels, and properties, along with any warnings about missing required elements.',
		operationId: 'preview-devices-home-assistant-plugin-helper-mapping',
	})
	@ApiParam({ name: 'entityId', type: 'string', description: 'Home Assistant helper entity ID' })
	@ApiBody({ type: HelperMappingPreviewRequestDto, required: false, description: 'Optional mapping overrides' })
	@ApiSuccessResponse(HelperMappingPreviewResponseModel, 'Mapping preview generated successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Home Assistant helper not found')
	@ApiUnprocessableEntityResponse('Devices Home Assistant plugin is not properly configured')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':entityId/preview-mapping')
	async previewMapping(
		@Param('entityId') entityId: string,
		@Body() body?: HelperMappingPreviewRequestDto,
	): Promise<HelperMappingPreviewResponseModel> {
		this.logger.debug(`Previewing mapping for helper entityId=${entityId}`);

		try {
			const request = body ? toInstance(HelperMappingPreviewRequestDto, body) : undefined;
			const preview = await this.helperMappingPreviewService.generatePreview(entityId, request);

			this.logger.debug(
				`Generated mapping preview for helper entityId=${entityId}, warnings=${preview.warnings.length}, readyToAdopt=${preview.readyToAdopt}`,
			);

			const response = new HelperMappingPreviewResponseModel();
			response.data = preview;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Devices Home Assistant plugin is not properly configured', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException('Devices Home Assistant plugin is not properly configured');
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(`Home Assistant helper ${entityId} not found`);
			}

			this.logger.error('Generating mapping preview failed', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}

	@ApiOperation({
		tags: [DEVICES_HOME_ASSISTANT_PLUGIN_API_TAG_NAME],
		summary: 'Adopt a Home Assistant helper',
		description:
			'Creates a Smart Panel device from a Home Assistant helper based on the provided mapping configuration. ' +
			'This will create the device, channels, and properties in the Smart Panel system.',
		operationId: 'adopt-devices-home-assistant-plugin-helper',
	})
	@ApiBody({ type: AdoptHelperRequestDto, description: 'Helper adoption configuration' })
	@ApiCreatedSuccessResponse(DeviceResponseModel, 'Helper adopted successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiNotFoundResponse('Home Assistant helper not found')
	@ApiUnprocessableEntityResponse('Helper adoption failed due to validation errors or already adopted')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('adopt')
	async adoptHelper(@Body() body: AdoptHelperRequestDto): Promise<DeviceResponseModel> {
		this.logger.debug(`Adopting helper entity_id=${body.entityId}`);

		try {
			const request = toInstance(AdoptHelperRequestDto, body);
			const device = await this.helperAdoptionService.adoptHelper(request);

			this.logger.debug(`Adopted helper entity_id=${body.entityId} as device id=${device.id}`);

			const response = new DeviceResponseModel();
			response.data = device;
			return response;
		} catch (error) {
			const err = error as Error;

			if (error instanceof DevicesHomeAssistantValidationException) {
				this.logger.error('Helper adoption validation failed', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException(err.message);
			} else if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw new NotFoundException(err.message);
			} else if (error instanceof DevicesHomeAssistantException) {
				this.logger.error('Helper adoption failed', {
					message: err.message,
					stack: err.stack,
				});

				throw new UnprocessableEntityException(err.message);
			}

			this.logger.error('Helper adoption failed with unexpected error', {
				message: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}
}
