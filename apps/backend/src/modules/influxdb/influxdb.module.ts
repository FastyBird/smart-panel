import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateInfluxDbConfigDto } from './dto/update-config.dto';
import { INFLUXDB_MODULE_NAME } from './influxdb.constants';
import { INFLUXDB_MODULE_SWAGGER_EXTRA_MODELS } from './influxdb.openapi';
import { InfluxDbConfigModel } from './models/config.model';
import { InfluxDbService } from './services/influxdb.service';

@Module({
	imports: [NestConfigModule, ConfigModule, ExtensionsModule, SwaggerModule],
	providers: [InfluxDbService],
	exports: [InfluxDbService],
})
export class InfluxDbModule implements OnModuleInit {
	constructor(
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<InfluxDbConfigModel, UpdateInfluxDbConfigDto>({
			type: INFLUXDB_MODULE_NAME,
			class: InfluxDbConfigModel,
			configDto: UpdateInfluxDbConfigDto,
		});

		for (const model of INFLUXDB_MODULE_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: INFLUXDB_MODULE_NAME,
			name: 'InfluxDB',
			description: 'Time-series database integration for device data analytics and history',
			author: 'FastyBird',
			readme: `# InfluxDB Module

The InfluxDB module provides time-series database integration for storing and querying device data history and analytics.

## Features

- **Data Storage** - Stores device property values over time
- **Analytics** - Query historical data for trends and patterns
- **Retention Policies** - Automatic data cleanup based on age

## Configuration

- **Host** - InfluxDB server hostname or IP address
- **Database** - Database name for storing data
- **Username** - Optional authentication username
- **Password** - Optional authentication password

## Requirements

- InfluxDB 1.x server running and accessible
- Network connectivity to the InfluxDB server`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
