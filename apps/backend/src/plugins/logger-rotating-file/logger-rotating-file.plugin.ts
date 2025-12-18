import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config/dist/config.module';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SystemLoggerService } from '../../modules/system/services/system-logger.service';
import { SystemModule } from '../../modules/system/system.module';

import { RotatingFileUpdateConfigDto } from './dto/update-config.dto';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from './logger-rotating-file.constants';
import { LOGGER_ROTATING_FILE_PLUGIN_SWAGGER_EXTRA_MODELS } from './logger-rotating-file.openapi';
import { RotatingFileConfigModel } from './models/config.model';
import { FileLoggerService } from './services/file-logger.service';

@Module({
	imports: [NestConfigModule, SystemModule, ConfigModule, ExtensionsModule],
	providers: [FileLoggerService],
})
export class LoggerRotatingFilePlugin {
	constructor(
		private readonly fileLoggerService: FileLoggerService,
		private readonly configMapper: PluginsTypeMapperService,
		private readonly systemLoggerService: SystemLoggerService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<RotatingFileConfigModel, RotatingFileUpdateConfigDto>({
			type: LOGGER_ROTATING_FILE_PLUGIN_NAME,
			class: RotatingFileConfigModel,
			configDto: RotatingFileUpdateConfigDto,
		});

		this.systemLoggerService.register(this.fileLoggerService);

		for (const model of LOGGER_ROTATING_FILE_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: LOGGER_ROTATING_FILE_PLUGIN_NAME,
			name: 'Rotating File Logger',
			description: 'File-based logging with automatic log rotation',
			author: 'FastyBird',
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}

	async onApplicationBootstrap() {
		await this.fileLoggerService.initialize();
	}
}
