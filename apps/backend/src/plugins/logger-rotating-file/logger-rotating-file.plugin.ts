import { Module } from '@nestjs/common';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SystemLoggerService } from '../../modules/system/services/system-logger.service';
import { SystemModule } from '../../modules/system/system.module';

import { RotatingFileUpdateConfigDto } from './dto/update-config.dto';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from './logger-rotating-file.constants';
import { LOGGER_ROTATING_FILE_PLUGIN_SWAGGER_EXTRA_MODELS } from './logger-rotating-file.openapi';
import { RotatingFileConfigModel } from './models/config.model';
import { FileLoggerService } from './services/file-logger.service';

@Module({
	imports: [SystemModule, ConfigModule, ExtensionsModule],
	providers: [FileLoggerService],
})
export class LoggerRotatingFilePlugin {
	constructor(
		private readonly fileLoggerService: FileLoggerService,
		private readonly configMapper: PluginsTypeMapperService,
		private readonly systemLoggerService: SystemLoggerService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
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

		// Register plugin metadata for extension discovery
		this.extensionsService.registerPluginMetadata({
			type: LOGGER_ROTATING_FILE_PLUGIN_NAME,
			name: 'Rotating File Logger',
			description: 'File-based logging with automatic log rotation',
			author: 'FastyBird',
			readme: `# Rotating File Logger Plugin

File-based logging with automatic rotation and retention management.

## Features

- **File Logging** - Persist logs to disk for later analysis
- **Automatic Rotation** - Create new log files based on size or time
- **Retention Policy** - Automatically delete old log files
- **Configurable Format** - Customize log output format

## How It Works

The plugin writes application logs to files in a configured directory. When logs reach a certain size or age, they are rotated:

1. Current log file is renamed with timestamp
2. New log file is created
3. Old rotated files are deleted based on retention settings

## Configuration

- **Enabled** - Toggle file logging on/off
- **Log Directory** - Where to store log files
- **Max File Size** - Rotate when file reaches this size
- **Max Files** - Number of rotated files to keep
- **Log Level** - Minimum level to log (debug, info, warn, error)

## Log Location

By default, logs are stored in:
\`\`\`
./logs/smart-panel.log
\`\`\`

Rotated files are named:
\`\`\`
smart-panel-2024-01-15.log
\`\`\``,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.fileLoggerService);
	}
}
