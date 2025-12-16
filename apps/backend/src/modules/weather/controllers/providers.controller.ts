import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { ProvidersResponseModel } from '../models/provider.model';
import { WeatherProviderRegistryService } from '../services/weather-provider-registry.service';
import { WEATHER_MODULE_API_TAG_NAME } from '../weather.constants';

@ApiTags(WEATHER_MODULE_API_TAG_NAME)
@Controller('weather/providers')
export class ProvidersController {
	private readonly logger = new Logger(ProvidersController.name);

	constructor(private readonly providerRegistry: WeatherProviderRegistryService) {}

	@ApiOperation({
		tags: [WEATHER_MODULE_API_TAG_NAME],
		summary: 'Get available weather providers',
		description: 'Retrieve list of all registered weather provider plugins',
		operationId: 'get-weather-module-providers',
	})
	@ApiSuccessResponse(ProvidersResponseModel, 'Weather providers retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	getProviders(): ProvidersResponseModel {
		this.logger.debug('[LOOKUP] Fetching available weather providers');

		const providers = this.providerRegistry.getAll();

		const response = new ProvidersResponseModel();
		response.data = providers;

		return response;
	}
}
