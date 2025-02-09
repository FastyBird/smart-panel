import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { InfluxDbService } from './services/influxdb.service';

@Module({
	imports: [NestConfigModule],
	providers: [InfluxDbService],
	exports: [InfluxDbService],
})
export class InfluxDbModule {}
