import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { DiscoveredExtensionsController } from './controllers/discovered-extensions.controller';
import { ExtensionsController } from './controllers/extensions.controller';
import {
	EXTENSIONS_MODULE_API_TAG_DESCRIPTION,
	EXTENSIONS_MODULE_API_TAG_NAME,
	EXTENSIONS_MODULE_NAME,
} from './extensions.constants';
import { EXTENSIONS_SWAGGER_EXTRA_MODELS } from './extensions.openapi';
import { UpdateExtensionsConfigDto } from './dto/update-config.dto';
import { ExtensionsConfigModel } from './models/config.model';
import { ExtensionsService } from './services/extensions.service';

@ApiTag({
	tagName: EXTENSIONS_MODULE_NAME,
	displayName: EXTENSIONS_MODULE_API_TAG_NAME,
	description: EXTENSIONS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [NestConfigModule, ConfigModule],
	controllers: [ExtensionsController, DiscoveredExtensionsController],
	providers: [ExtensionsService],
	exports: [ExtensionsService],
})
export class ExtensionsModule implements OnModuleInit {
	constructor(
		private readonly extensionsService: ExtensionsService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	onModuleInit() {
		// Register configuration mapping
		this.modulesMapperService.registerMapping<ExtensionsConfigModel, UpdateExtensionsConfigDto>({
			type: EXTENSIONS_MODULE_NAME,
			class: ExtensionsConfigModel,
			configDto: UpdateExtensionsConfigDto,
		});

		// Register Swagger models
		for (const model of EXTENSIONS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata for this module
		this.extensionsService.registerModuleMetadata({
			type: EXTENSIONS_MODULE_NAME,
			name: 'Extensions',
			description: 'Manage application modules and plugins',
			author: 'FastyBird',
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
