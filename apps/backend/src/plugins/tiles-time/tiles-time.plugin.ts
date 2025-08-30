import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';

import { CreateTimeTileDto } from './dto/create-tile.dto';
import { UpdateTimeTileDto } from './dto/update-tile.dto';
import { TimeTileEntity } from './entities/tiles-time.entity';
import { TILES_TIME_TYPE } from './tiles-time.constants';

@Module({
	imports: [TypeOrmModule.forFeature([TimeTileEntity]), DashboardModule],
})
export class TilesTimePlugin {
	constructor(private readonly mapper: TilesTypeMapperService) {}

	onModuleInit() {
		this.mapper.registerMapping<TimeTileEntity, CreateTimeTileDto, UpdateTimeTileDto>({
			type: TILES_TIME_TYPE,
			class: TimeTileEntity,
			createDto: CreateTimeTileDto,
			updateDto: UpdateTimeTileDto,
		});
	}
}
