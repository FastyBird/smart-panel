import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';

import { CreateDayWeatherTileDto, CreateForecastWeatherTileDto } from './dto/create-tile.dto';
import { UpdateDayWeatherTileDto, UpdateForecastWeatherTileDto } from './dto/update-tile.dto';
import { DayWeatherTileEntity, ForecastWeatherTileEntity } from './entities/tiles-weather.entity';
import { TILES_WEATHER_DAY_TYPE, TILES_WEATHER_FORECAST_TYPE } from './tiles-weather.constants';

@Module({
	imports: [TypeOrmModule.forFeature([DayWeatherTileEntity, ForecastWeatherTileEntity]), DashboardModule],
})
export class TilesWeatherPlugin {
	constructor(private readonly mapper: TilesTypeMapperService) {}

	onModuleInit() {
		this.mapper.registerMapping<DayWeatherTileEntity, CreateDayWeatherTileDto, UpdateDayWeatherTileDto>({
			type: TILES_WEATHER_DAY_TYPE,
			class: DayWeatherTileEntity,
			createDto: CreateDayWeatherTileDto,
			updateDto: UpdateDayWeatherTileDto,
		});

		this.mapper.registerMapping<ForecastWeatherTileEntity, CreateForecastWeatherTileDto, UpdateForecastWeatherTileDto>({
			type: TILES_WEATHER_FORECAST_TYPE,
			class: ForecastWeatherTileEntity,
			createDto: CreateForecastWeatherTileDto,
			updateDto: UpdateForecastWeatherTileDto,
		});
	}
}
