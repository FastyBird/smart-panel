import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { PlatformModule } from '../platform/platform.module';

import { ConfigController } from './controllers/config.controller';
import { ConfigService } from './services/config.service';
import { PluginsTypeMapperService } from './services/plugins-type-mapper.service';

@Module({
	imports: [NestConfigModule, PlatformModule],
	providers: [ConfigService, PluginsTypeMapperService],
	controllers: [ConfigController],
	exports: [ConfigService, PluginsTypeMapperService],
})
export class ConfigModule {}
