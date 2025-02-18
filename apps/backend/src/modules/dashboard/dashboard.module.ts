import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DevicesModule } from '../devices/devices.module';
import { SeedModule } from '../seed/seeding.module';
import { SeedService } from '../seed/services/seed.service';
import { WebsocketModule } from '../websocket/websocket.module';

import { PagesCardsController } from './controllers/pages.cards.controller';
import { PagesCardsDataSourceController } from './controllers/pages.cards.data-source.controller';
import { PagesController } from './controllers/pages.controller';
import { PagesDataSourceController } from './controllers/pages.data-source.controller';
import { PagesTilesController } from './controllers/pages.tiles.controller';
import { PagesTilesDataSourceController } from './controllers/pages.tiles.data-source.controller';
import { CreateDeviceChannelDataSourceDto } from './dto/create-data-source.dto';
import { CreateCardsPageDto, CreateDevicePageDto, CreateTilesPageDto } from './dto/create-page.dto';
import {
	CreateDayWeatherTileDto,
	CreateDeviceTileDto,
	CreateForecastWeatherTileDto,
	CreateTimeTileDto,
} from './dto/create-tile.dto';
import { UpdateDeviceChannelDataSourceDto } from './dto/update-data-source.dto';
import { UpdateCardsPageDto, UpdateDevicePageDto, UpdateTilesPageDto } from './dto/update-page.dto';
import {
	UpdateDayWeatherTileDto,
	UpdateDeviceTileDto,
	UpdateForecastWeatherTileDto,
	UpdateTimeTileDto,
} from './dto/update-tile.dto';
import {
	CardEntity,
	CardsPageEntity,
	DataSourceEntity,
	DayWeatherTileEntity,
	DeviceChannelDataSourceEntity,
	DevicePageEntity,
	DeviceTileEntity,
	ForecastWeatherTileEntity,
	PageEntity,
	TileEntity,
	TilesPageEntity,
	TimeTileEntity,
} from './entities/dashboard.entity';
import { CardsService } from './services/cards.service';
import { DashboardSeederService } from './services/dashboard-seeder.service';
import { DataSourcesTypeMapperService } from './services/data-source-type-mapper.service';
import { DataSourceService } from './services/data-source.service';
import { PagesTypeMapperService } from './services/pages-type-mapper.service';
import { PagesService } from './services/pages.service';
import { TilesTypeMapperService } from './services/tiles-type-mapper.service';
import { TilesService } from './services/tiles.service';
import { ChannelPropertyExistsConstraintValidator } from './validators/channel-property-exists-constraint.validator';
import { DeviceChannelExistsConstraintValidator } from './validators/device-channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from './validators/device-exists-constraint.validator';
import { PageTileTypeConstraintValidator } from './validators/page-tile-type-constraint.validator';
import { TileDataSourceTypeConstraintValidator } from './validators/tile-data-source-type-constraint.validator';

@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([
			PageEntity,
			CardsPageEntity,
			TilesPageEntity,
			DevicePageEntity,
			CardEntity,
			TileEntity,
			DeviceTileEntity,
			TimeTileEntity,
			DayWeatherTileEntity,
			ForecastWeatherTileEntity,
			DataSourceEntity,
			DeviceChannelDataSourceEntity,
		]),
		DevicesModule,
		SeedModule,
		WebsocketModule,
	],
	providers: [
		PagesService,
		CardsService,
		TilesService,
		DataSourceService,
		PagesTypeMapperService,
		TilesTypeMapperService,
		DataSourcesTypeMapperService,
		PageTileTypeConstraintValidator,
		TileDataSourceTypeConstraintValidator,
		DeviceExistsConstraintValidator,
		DeviceChannelExistsConstraintValidator,
		ChannelPropertyExistsConstraintValidator,
		DashboardSeederService,
	],
	controllers: [
		PagesController,
		PagesCardsController,
		PagesCardsDataSourceController,
		PagesTilesController,
		PagesTilesDataSourceController,
		PagesDataSourceController,
	],
	exports: [
		PagesService,
		CardsService,
		TilesService,
		DataSourceService,
		PagesTypeMapperService,
		TilesTypeMapperService,
		DataSourcesTypeMapperService,
		DashboardSeederService,
	],
})
export class DashboardModule {
	constructor(
		private readonly pageMapper: PagesTypeMapperService,
		private readonly tileMapper: TilesTypeMapperService,
		private readonly dataSourceMapper: DataSourcesTypeMapperService,
		private readonly moduleSeeder: DashboardSeederService,
		private readonly seedService: SeedService,
	) {}

	onModuleInit() {
		// Pages
		this.pageMapper.registerMapping<CardsPageEntity, CreateCardsPageDto, UpdateCardsPageDto>({
			type: 'cards',
			class: CardsPageEntity,
			createDto: CreateCardsPageDto,
			updateDto: UpdateCardsPageDto,
		});
		this.pageMapper.registerMapping<TilesPageEntity, CreateTilesPageDto, UpdateTilesPageDto>({
			type: 'tiles',
			class: TilesPageEntity,
			createDto: CreateTilesPageDto,
			updateDto: UpdateTilesPageDto,
		});
		this.pageMapper.registerMapping<DevicePageEntity, CreateDevicePageDto, UpdateDevicePageDto>({
			type: 'device',
			class: DevicePageEntity,
			createDto: CreateDevicePageDto,
			updateDto: UpdateDevicePageDto,
		});

		// Tiles
		this.tileMapper.registerMapping<DeviceTileEntity, CreateDeviceTileDto, UpdateDeviceTileDto>({
			type: 'device',
			class: DeviceTileEntity,
			createDto: CreateDeviceTileDto,
			updateDto: UpdateDeviceTileDto,
		});
		this.tileMapper.registerMapping<TimeTileEntity, CreateTimeTileDto, UpdateTimeTileDto>({
			type: 'clock',
			class: TimeTileEntity,
			createDto: CreateTimeTileDto,
			updateDto: UpdateTimeTileDto,
		});
		this.tileMapper.registerMapping<DayWeatherTileEntity, CreateDayWeatherTileDto, UpdateDayWeatherTileDto>({
			type: 'weather-day',
			class: DayWeatherTileEntity,
			createDto: CreateDayWeatherTileDto,
			updateDto: UpdateDayWeatherTileDto,
		});
		this.tileMapper.registerMapping<
			ForecastWeatherTileEntity,
			CreateForecastWeatherTileDto,
			UpdateForecastWeatherTileDto
		>({
			type: 'weather-forecast',
			class: ForecastWeatherTileEntity,
			createDto: CreateForecastWeatherTileDto,
			updateDto: UpdateForecastWeatherTileDto,
		});

		// Data source
		this.dataSourceMapper.registerMapping<
			DeviceChannelDataSourceEntity,
			CreateDeviceChannelDataSourceDto,
			UpdateDeviceChannelDataSourceDto
		>({
			type: 'device-channel',
			class: DeviceChannelDataSourceEntity,
			createDto: CreateDeviceChannelDataSourceDto,
			updateDto: UpdateDeviceChannelDataSourceDto,
		});

		this.seedService.registerSeeder(this.moduleSeeder, 200);
	}
}
