import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiExtraModels } from '@nestjs/swagger';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { TilesTypeMapperService } from '../../modules/dashboard/services/tiles-type-mapper.service';

import { CreateDayWeatherTileDto, CreateForecastWeatherTileDto } from './dto/create-tile.dto';
import { WeatherUpdateConfigDto } from './dto/update-config.dto';
import { UpdateDayWeatherTileDto, UpdateForecastWeatherTileDto } from './dto/update-tile.dto';
import { DayWeatherTileEntity, ForecastWeatherTileEntity } from './entities/tiles-weather.entity';
import { WeatherConfigModel } from './models/config.model';
import {
	TILES_WEATHER_DAY_TYPE,
	TILES_WEATHER_FORECAST_TYPE,
	TILES_WEATHER_PLUGIN_NAME,
} from './tiles-weather.constants';

@ApiExtraModels(CreateDayWeatherTileDto, CreateForecastWeatherTileDto, UpdateDayWeatherTileDto, UpdateForecastWeatherTileDto)
@Module({
	imports: [TypeOrmModule.forFeature([DayWeatherTileEntity, ForecastWeatherTileEntity]), DashboardModule, ConfigModule],
})
export class TilesWeatherPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly tilesMapper: TilesTypeMapperService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<WeatherConfigModel, WeatherUpdateConfigDto>({
			type: TILES_WEATHER_PLUGIN_NAME,
			class: WeatherConfigModel,
			configDto: WeatherUpdateConfigDto,
		});

		this.tilesMapper.registerMapping<DayWeatherTileEntity, CreateDayWeatherTileDto, UpdateDayWeatherTileDto>({
			type: TILES_WEATHER_DAY_TYPE,
			class: DayWeatherTileEntity,
			createDto: CreateDayWeatherTileDto,
			updateDto: UpdateDayWeatherTileDto,
		});

		this.tilesMapper.registerMapping<
			ForecastWeatherTileEntity,
			CreateForecastWeatherTileDto,
			UpdateForecastWeatherTileDto
		>({
			type: TILES_WEATHER_FORECAST_TYPE,
			class: ForecastWeatherTileEntity,
			createDto: CreateForecastWeatherTileDto,
			updateDto: UpdateForecastWeatherTileDto,
		});
	}
}
