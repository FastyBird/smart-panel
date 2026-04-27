import { Module } from '@nestjs/common';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
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
	imports: [SystemModule],
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
			readme: `# Rotating File Logger

> Plugin · by FastyBird · platform: logging

Persists application logs to disk in a configurable directory. Files are rotated daily and old logs are cleaned up on a cron schedule based on the configured retention window — the simplest way to keep a forensic trail without external log shippers.

## What you get

- A reliable, self-managing on-disk log archive: write speed isn't bottlenecked, files are rotated automatically, and you don't have to remember to clean them up
- A direct, plain-text format that any tool can consume (\`grep\`, \`tail -f\`, log shippers, viewers in the admin UI)
- Bounded disk usage thanks to the retention policy — a verbose deployment cannot fill the disk silently
- Plays nicely with the system module: the same structured log entries the API exposes are mirrored to disk

## Features

- **Daily rotation** — one file per day, timestamped (e.g. \`smart-panel-2026-04-27.log\`)
- **Retention policy** — files older than \`retention_days\` are deleted automatically
- **Cron-driven cleanup** — schedule the eviction job with a standard cron expression so it runs at a quiet hour
- **Custom prefix & directory** — pick the file name and storage location to match your deployment layout
- **Atomic-safe writes** — log writes are flushed in line with the application's structured logger so a crash doesn't truncate a half-written entry

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`dir\` | Directory where log files are written | system default (\`./logs\`) |
| \`file_prefix\` | Prefix for rotated files (\`[A-Za-z0-9._-]+\`) | \`smart-panel\` |
| \`retention_days\` | Days to retain rotated files (≥ 1) | \`7\` |
| \`cleanup_cron\` | Cron expression for the cleanup job | \`0 3 * * *\` |`,
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
