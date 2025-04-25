import { CommandModule } from 'nestjs-command';
import path from 'path';

import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { getEnvValue } from './common/utils/config.utils';
import { AUTH_MODULE_PREFIX } from './modules/auth/auth.constants';
import { AuthModule } from './modules/auth/auth.module';
import { CONFIG_MODULE_PREFIX } from './modules/config/config.constants';
import { ConfigModule } from './modules/config/config.module';
import { DASHBOARD_MODULE_PREFIX } from './modules/dashboard/dashboard.constants';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DEVICES_MODULE_PREFIX } from './modules/devices/devices.constants';
import { DevicesModule } from './modules/devices/devices.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SeedModule } from './modules/seed/seeding.module';
import { SYSTEM_MODULE_PREFIX } from './modules/system/system.constants';
import { SystemModule } from './modules/system/system.module';
import { USERS_MODULE_PREFIX } from './modules/users/users.constants';
import { UsersModule } from './modules/users/users.module';
import { WEATHER_MODULE_PREFIX } from './modules/weather/weather.constants';
import { WeatherModule } from './modules/weather/weather.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { DataSourcesDeviceChannelPlugin } from './plugins/data-sources-device-channel/data-sources-device-channel.plugin';
import { DevicesThirdPartyPlugin } from './plugins/devices-third-party/devices-third-party.plugin';
import { PAGES_CARDS_PLUGIN_PREFIX } from './plugins/pages-cards/pages-cards.constants';
import { PagesCardsPlugin } from './plugins/pages-cards/pages-cards.plugin';
import { PagesDeviceDetailPlugin } from './plugins/pages-device-detail/pages-device-detail.plugin';
import { PagesTilesPlugin } from './plugins/pages-tiles/pages-tiles.plugin';
import { TilesDevicePreviewPlugin } from './plugins/tiles-device-preview/tiles-device-preview.plugin';
import { TilesTimePlugin } from './plugins/tiles-time/tiles-time.plugin';
import { TilesWeatherPlugin } from './plugins/tiles-weather/tiles-weather.plugin';

@Module({
	imports: [
		NestConfigModule.forRoot({
			envFilePath: [path.resolve(__dirname, '../../../.env.local'), path.resolve(__dirname, '../../../.env')],
		}),
		CacheModule.register({
			isGlobal: true,
			ttl: 30 * 1000,
			max: 1000,
		}),
		EventEmitterModule.forRoot(),
		TypeOrmModule.forRootAsync({
			imports: [NestConfigModule], // Ensure ConfigModule is available
			inject: [NestConfigService],
			useFactory: (configService: NestConfigService) => {
				const isTest = process.env.NODE_ENV === 'test';

				return {
					type: 'sqlite',
					database: isTest
						? ':memory:'
						: path.resolve(
								getEnvValue<string>(configService, 'FB_DB_PATH', path.resolve(__dirname, '../../../var/db')),
								'database.sqlite',
							),
					entities: [__dirname + '/**/*.entity{.ts,.js}'],
					subscribers: [__dirname + '/**/*.subscriber{.ts,.js}'],
					synchronize: getEnvValue<boolean>(configService, 'FB_DB_SYNC', false),
					logging: getEnvValue<boolean>(configService, 'FB_DB_LOGGING', false),
				};
			},
		}),
		ScheduleModule.forRoot(),
		RouterModule.register([
			{
				path: AUTH_MODULE_PREFIX,
				module: AuthModule,
			},
			{
				path: DEVICES_MODULE_PREFIX,
				module: DevicesModule,
			},
			{
				path: DASHBOARD_MODULE_PREFIX,
				module: DashboardModule,
			},
			{
				path: CONFIG_MODULE_PREFIX,
				module: ConfigModule,
			},
			{
				path: SYSTEM_MODULE_PREFIX,
				module: SystemModule,
			},
			{
				path: USERS_MODULE_PREFIX,
				module: UsersModule,
			},
			{
				path: WEATHER_MODULE_PREFIX,
				module: WeatherModule,
			},
			{
				path: PAGES_CARDS_PLUGIN_PREFIX,
				module: PagesCardsPlugin,
			},
		]),
		AuthModule,
		CommandModule,
		ConfigModule,
		DashboardModule,
		DevicesModule,
		PlatformModule,
		SeedModule,
		SystemModule,
		UsersModule,
		WeatherModule,
		WebsocketModule,
		DevicesThirdPartyPlugin,
		PagesCardsPlugin,
		PagesDeviceDetailPlugin,
		PagesTilesPlugin,
		TilesDevicePreviewPlugin,
		TilesTimePlugin,
		TilesWeatherPlugin,
		DataSourcesDeviceChannelPlugin,
	],
})
export class AppModule {}
