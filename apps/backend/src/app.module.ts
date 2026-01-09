import path from 'path';

import { CacheModule } from '@nestjs/cache-manager';
import { DynamicModule, Module, type Type } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MODULES_PREFIX, PLUGINS_PREFIX } from './app.constants';
import { getEnvValue, resolveStaticPath } from './common/utils/config.utils';
import { ApiModule } from './modules/api/api.module';
import { AUTH_MODULE_PREFIX } from './modules/auth/auth.constants';
import { AuthModule } from './modules/auth/auth.module';
import { CONFIG_MODULE_PREFIX } from './modules/config/config.constants';
import { ConfigModule } from './modules/config/config.module';
import { DASHBOARD_MODULE_PREFIX } from './modules/dashboard/dashboard.constants';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DEVICES_MODULE_PREFIX } from './modules/devices/devices.constants';
import { DevicesModule } from './modules/devices/devices.module';
import { DISPLAYS_MODULE_PREFIX } from './modules/displays/displays.constants';
import { DisplaysModule } from './modules/displays/displays.module';
import { EXTENSIONS_MODULE_PREFIX } from './modules/extensions/extensions.constants';
import { ExtensionsModule } from './modules/extensions/extensions.module';
import { IntentsModule } from './modules/intents/intents.module';
import { MdnsModule } from './modules/mdns/mdns.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SCENES_MODULE_PREFIX } from './modules/scenes/scenes.constants';
import { ScenesModule } from './modules/scenes/scenes.module';
import { SeedModule } from './modules/seed/seeding.module';
import { SPACES_MODULE_PREFIX } from './modules/spaces/spaces.constants';
import { SpacesModule } from './modules/spaces/spaces.module';
import { STATS_MODULE_PREFIX } from './modules/stats/stats.constants';
import { StatsModule } from './modules/stats/stats.module';
import { SwaggerModule } from './modules/swagger/swagger.module';
import { SYSTEM_MODULE_PREFIX } from './modules/system/system.constants';
import { SystemModule } from './modules/system/system.module';
import { USERS_MODULE_PREFIX } from './modules/users/users.constants';
import { UsersModule } from './modules/users/users.module';
import { WEATHER_MODULE_PREFIX } from './modules/weather/weather.constants';
import { WeatherModule } from './modules/weather/weather.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { DataSourcesDeviceChannelPlugin } from './plugins/data-sources-device-channel/data-sources-device-channel.plugin';
import { DataSourcesWeatherPlugin } from './plugins/data-sources-weather/data-sources-weather.plugin';
import { DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from './plugins/devices-home-assistant/devices-home-assistant.constants';
import { DevicesHomeAssistantPlugin } from './plugins/devices-home-assistant/devices-home-assistant.plugin';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX } from './plugins/devices-shelly-ng/devices-shelly-ng.constants';
import { DevicesShellyNgPlugin } from './plugins/devices-shelly-ng/devices-shelly-ng.plugin';
import { DEVICES_SHELLY_V1_PLUGIN_PREFIX } from './plugins/devices-shelly-v1/devices-shelly-v1.constants';
import { DevicesShellyV1Plugin } from './plugins/devices-shelly-v1/devices-shelly-v1.plugin';
import { DEVICES_THIRD_PARTY_PLUGIN_PREFIX } from './plugins/devices-third-party/devices-third-party.constants';
import { DevicesThirdPartyPlugin } from './plugins/devices-third-party/devices-third-party.plugin';
import { DEVICES_WLED_PLUGIN_PREFIX } from './plugins/devices-wled/devices-wled.constants';
import { DevicesWledPlugin } from './plugins/devices-wled/devices-wled.plugin';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from './plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.constants';
import { DevicesZigbee2mqttPlugin } from './plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin';
import { DEVICES_SIMULATOR_PLUGIN_PREFIX } from './plugins/devices-simulator/devices-simulator.constants';
import { DevicesSimulatorPlugin } from './plugins/devices-simulator/devices-simulator.plugin';
import { LoggerRotatingFilePlugin } from './plugins/logger-rotating-file/logger-rotating-file.plugin';
import { PAGES_CARDS_PLUGIN_PREFIX } from './plugins/pages-cards/pages-cards.constants';
import { PagesCardsPlugin } from './plugins/pages-cards/pages-cards.plugin';
import { PagesDeviceDetailPlugin } from './plugins/pages-device-detail/pages-device-detail.plugin';
import { PagesTilesPlugin } from './plugins/pages-tiles/pages-tiles.plugin';
import { ScenesLocalPlugin } from './plugins/scenes-local/scenes-local.plugin';
import { TilesDevicePreviewPlugin } from './plugins/tiles-device-preview/tiles-device-preview.plugin';
import { TilesScenePlugin } from './plugins/tiles-scene/tiles-scene.plugin';
import { TilesTimePlugin } from './plugins/tiles-time/tiles-time.plugin';
import { TilesWeatherPlugin } from './plugins/tiles-weather/tiles-weather.plugin';
import { WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_PREFIX } from './plugins/weather-openweathermap-onecall/weather-openweathermap-onecall.constants';
import { WeatherOpenweathermapOnecallPlugin } from './plugins/weather-openweathermap-onecall/weather-openweathermap-onecall.plugin';
import { WEATHER_OPENWEATHERMAP_PLUGIN_PREFIX } from './plugins/weather-openweathermap/weather-openweathermap.constants';
import { WeatherOpenweathermapPlugin } from './plugins/weather-openweathermap/weather-openweathermap.plugin';

export interface AppRegisterOptions {
	moduleExtensions?: Array<{ routePrefix: string; extensionClass: Type<unknown> }>;
	pluginExtensions?: Array<{ routePrefix: string; extensionClass: Type<unknown> }>;
}

@Module({})
export class AppModule {
	static register({ moduleExtensions, pluginExtensions }: AppRegisterOptions): DynamicModule {
		const seen = new Set<string>();

		const clean = (s: string) => s.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');

		const moduleRoutes = moduleExtensions
			.map((p) => ({ path: clean(p.routePrefix), module: p.extensionClass }))
			.filter((r) => !seen.has(`M:${r.path}`) && seen.add(`M:${r.path}`));

		const pluginRoutes = pluginExtensions
			.map((p) => ({ path: clean(p.routePrefix), module: p.extensionClass }))
			.filter((r) => !seen.has(`P:${r.path}`) && seen.add(`P:${r.path}`));

		return {
			module: AppModule,
			imports: [
				NestConfigModule.forRoot({
					envFilePath: [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '.env')],
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
							migrations: [__dirname + '/migrations/*{.ts,.js}'],
							synchronize: true,
							logging: getEnvValue<boolean>(configService, 'FB_DB_LOGGING', false),
						};
					},
				}),
				ScheduleModule.forRoot(),
				RouterModule.register([
					{
						path: MODULES_PREFIX,
						children: [
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
								path: DISPLAYS_MODULE_PREFIX,
								module: DisplaysModule,
							},
							{
								path: EXTENSIONS_MODULE_PREFIX,
								module: ExtensionsModule,
							},
							{
								path: SPACES_MODULE_PREFIX,
								module: SpacesModule,
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
								path: STATS_MODULE_PREFIX,
								module: StatsModule,
							},
							{
								path: SCENES_MODULE_PREFIX,
								module: ScenesModule,
							},
							{
								path: AUTH_MODULE_PREFIX,
								module: ApiModule,
							},
							...moduleRoutes,
						],
					},
					{
						path: PLUGINS_PREFIX,
						children: [
							{
								path: PAGES_CARDS_PLUGIN_PREFIX,
								module: PagesCardsPlugin,
							},
							{
								path: DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX,
								module: DevicesHomeAssistantPlugin,
							},
							{
								path: DEVICES_THIRD_PARTY_PLUGIN_PREFIX,
								module: DevicesThirdPartyPlugin,
							},
							{
								path: DEVICES_SHELLY_NG_PLUGIN_PREFIX,
								module: DevicesShellyNgPlugin,
							},
							{
								path: DEVICES_SHELLY_V1_PLUGIN_PREFIX,
								module: DevicesShellyV1Plugin,
							},
							{
								path: DEVICES_WLED_PLUGIN_PREFIX,
								module: DevicesWledPlugin,
							},
							{
								path: DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX,
								module: DevicesZigbee2mqttPlugin,
							},
							{
								path: DEVICES_SIMULATOR_PLUGIN_PREFIX,
								module: DevicesSimulatorPlugin,
							},
							{
								path: WEATHER_OPENWEATHERMAP_PLUGIN_PREFIX,
								module: WeatherOpenweathermapPlugin,
							},
							{
								path: WEATHER_OPENWEATHERMAP_ONECALL_PLUGIN_PREFIX,
								module: WeatherOpenweathermapOnecallPlugin,
							},
							...pluginRoutes,
						],
					},
				]),
				AuthModule,
				ApiModule,
				ConfigModule,
				DashboardModule,
				DevicesModule,
				DisplaysModule,
				ExtensionsModule,
				PlatformModule,
				ScenesModule,
				SpacesModule,
				SeedModule,
				StatsModule,
				SystemModule,
				UsersModule,
				WeatherModule,
				WebsocketModule,
				SwaggerModule,
				IntentsModule,
				MdnsModule,
				DevicesThirdPartyPlugin,
				DevicesHomeAssistantPlugin,
				DevicesShellyNgPlugin,
				DevicesShellyV1Plugin,
				DevicesWledPlugin,
				DevicesZigbee2mqttPlugin,
				DevicesSimulatorPlugin,
				PagesCardsPlugin,
				PagesDeviceDetailPlugin,
				PagesTilesPlugin,
				TilesDevicePreviewPlugin,
				TilesScenePlugin,
				TilesTimePlugin,
				TilesWeatherPlugin,
				DataSourcesDeviceChannelPlugin,
				DataSourcesWeatherPlugin,
				LoggerRotatingFilePlugin,
				WeatherOpenweathermapPlugin,
				WeatherOpenweathermapOnecallPlugin,
				ScenesLocalPlugin,
				ServeStaticModule.forRootAsync({
					imports: [NestConfigModule], // Ensure ConfigModule is available
					inject: [NestConfigService],
					useFactory: (configService: NestConfigService) => {
						const rootPath = resolveStaticPath(
							getEnvValue<string>(configService, 'FB_ADMIN_UI_PATH', path.resolve(__dirname, '../static')),
						);

						return [
							{
								rootPath,
								exclude: ['/api*', '/socket.io*', '/favicon.ico'],
								serveStaticOptions: {
									fallthrough: true,
								},
							},
						];
					},
				}),

				// Finally import discovered extension modules so DI can wire them
				...(moduleExtensions || []).map((p) => p.extensionClass),
				...(pluginExtensions || []).map((p) => p.extensionClass),
			],
		};
	}
}
