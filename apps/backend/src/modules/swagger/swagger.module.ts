import { Global, Module } from '@nestjs/common';

import { SwaggerModelsRegistryService } from './services/swagger-models-registry.service';
import { SwaggerService } from './services/swagger.service';

@Global()
@Module({
	providers: [SwaggerService, SwaggerModelsRegistryService],
	exports: [SwaggerService, SwaggerModelsRegistryService],
})
export class SwaggerModule {}
