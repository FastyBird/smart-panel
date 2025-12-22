import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';

import { UpdateInfluxDbConfigDto } from './dto/update-config.dto';
import { INFLUXDB_MODULE_NAME } from './influxdb.constants';
import { InfluxDbConfigModel } from './models/config.model';
import { InfluxDbService } from './services/influxdb.service';

@Module({
	imports: [NestConfigModule, forwardRef(() => ConfigModule)],
	providers: [InfluxDbService],
	exports: [InfluxDbService],
})
export class InfluxDbModule implements OnModuleInit {
	constructor(private readonly modulesMapperService: ModulesTypeMapperService) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<InfluxDbConfigModel, UpdateInfluxDbConfigDto>({
			type: INFLUXDB_MODULE_NAME,
			class: InfluxDbConfigModel,
			configDto: UpdateInfluxDbConfigDto,
		});
	}
}
