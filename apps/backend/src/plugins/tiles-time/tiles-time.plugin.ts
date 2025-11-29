import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';

import { CreateTimeTileDto } from './dto/create-tile.dto';
import { TimeUpdateConfigDto } from './dto/update-config.dto';
import { UpdateTimeTileDto } from './dto/update-tile.dto';
import { TimeTileEntity } from './entities/tiles-time.entity';
import { TimeConfigModel } from './models/config.model';
import { TILES_TIME_PLUGIN_NAME, TILES_TIME_TYPE } from './tiles-time.constants';

@Module({
	imports: [TypeOrmModule.forFeature([TimeTileEntity]), DashboardModule, ConfigModule],
})
export class TilesTimePlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly tilesMapper: TilesTypeMapperService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<TimeConfigModel, TimeUpdateConfigDto>({
			type: TILES_TIME_PLUGIN_NAME,
			class: TimeConfigModel,
			configDto: TimeUpdateConfigDto,
		});

		this.tilesMapper.registerMapping<TimeTileEntity, CreateTimeTileDto, UpdateTimeTileDto>({
			type: TILES_TIME_TYPE,
			class: TimeTileEntity,
			createDto: CreateTimeTileDto,
			updateDto: UpdateTimeTileDto,
		});
	}
}
