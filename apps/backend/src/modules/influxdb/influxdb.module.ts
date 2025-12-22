import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateInfluxDbConfigDto } from './dto/update-config.dto';
import { INFLUXDB_MODULE_NAME } from './influxdb.constants';
import { INFLUXDB_MODULE_SWAGGER_EXTRA_MODELS } from './influxdb.openapi';
import { InfluxDbConfigModel } from './models/config.model';
import { InfluxDbService } from './services/influxdb.service';

@ApiTag({
	tagName: INFLUXDB_MODULE_NAME,
	displayName: 'InfluxDB module',
	description: 'Endpoints related to InfluxDB time-series database configuration.',
})
@Module({
	imports: [NestConfigModule, forwardRef(() => ConfigModule), ExtensionsModule, SwaggerModule],
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
			description: 'Time-series database for storing device metrics and historical data',
			author: 'FastyBird',
			readme: `# InfluxDB Module

The InfluxDB module provides time-series data storage for the Smart Panel, enabling historical data tracking and analytics.

## Features

- **Device Metrics** - Store property values with timestamps
- **Connection Status** - Track device online/offline history
- **WebSocket Stats** - Monitor client connection metrics
- **API Metrics** - Track request counts and latency
- **Retention Policies** - Automatic data lifecycle management

## How It Works

The module connects to an InfluxDB instance and stores:

- Device property value changes
- Device connection state changes
- WebSocket heartbeat metrics
- API request statistics

Data is organized with retention policies:
- \`raw_24h\` - Raw data retained for 24 hours
- \`min_14d\` - Aggregated minute data for 14 days

## Configuration

- **Host** - InfluxDB server address (default: 127.0.0.1)
- **Database** - Database name (default: fastybird)
- **Username** - Optional authentication username
- **Password** - Optional authentication password

## Requirements

- InfluxDB 1.x server running and accessible
- Network connectivity between Smart Panel and InfluxDB`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
