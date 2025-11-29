import { Global, Module } from '@nestjs/common';

import { AppInstanceHolder } from '../../common/services/app-instance-holder.service';

import { GenerateOpenapiCommand } from './commands/generate-openapi.command';
import { SwaggerModelsRegistryService } from './services/swagger-models-registry.service';
import { SwaggerService } from './services/swagger.service';

@Global()
@Module({
	providers: [SwaggerService, SwaggerModelsRegistryService, AppInstanceHolder, GenerateOpenapiCommand],
	exports: [SwaggerService, SwaggerModelsRegistryService, AppInstanceHolder],
})
export class SwaggerModule {}
