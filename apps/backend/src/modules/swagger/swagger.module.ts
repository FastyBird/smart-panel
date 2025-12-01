import { Global, Module } from '@nestjs/common';

import { AppInstanceHolder } from '../../common/services/app-instance-holder.service';

import { GenerateOpenapiCommand } from './commands/generate-openapi.command';
import { ExtendedDiscriminatorService } from './services/extended-discriminator.service';
import { SwaggerDocumentService } from './services/swagger-document.service';
import { SwaggerModelsRegistryService } from './services/swagger-models-registry.service';

@Global()
@Module({
	providers: [
		SwaggerDocumentService,
		SwaggerModelsRegistryService,
		ExtendedDiscriminatorService,
		AppInstanceHolder,
		GenerateOpenapiCommand,
	],
	exports: [SwaggerDocumentService, SwaggerModelsRegistryService, ExtendedDiscriminatorService, AppInstanceHolder],
})
export class SwaggerModule {}
