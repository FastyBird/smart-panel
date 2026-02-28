import { Injectable, Logger } from '@nestjs/common';

import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DevicesService } from '../../devices/services/devices.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { SceneEntity } from '../../scenes/entities/scenes.entity';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { WeatherService } from '../../weather/services/weather.service';

import { ActionObserverService } from './action-observer.service';

export interface BuddyContext {
	timestamp: string;
	spaces: { id: string; name: string; category: string | null; deviceCount: number }[];
	devices: { id: string; name: string; space: string | null; category: string; state: Record<string, unknown> }[];
	scenes: { id: string; name: string; space: string | null; enabled: boolean }[];
	weather: { temperature: number; conditions: string; humidity: number } | null;
	energy: {
		solarProduction: number;
		gridConsumption: number;
		gridExport: number;
		batteryLevel?: number;
	} | null;
	recentIntents: { type: string; space: string | null; timestamp: string }[];
}

@Injectable()
export class BuddyContextService {
	private readonly logger = new Logger(BuddyContextService.name);

	constructor(
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly scenesService: ScenesService,
		private readonly weatherService: WeatherService,
		private readonly energyDataService: EnergyDataService,
		private readonly actionObserver: ActionObserverService,
	) {}

	async buildContext(spaceId?: string): Promise<BuddyContext> {
		const [spaces, devices, scenes, weather, energy] = await Promise.all([
			this.getSpaces(spaceId),
			this.getDevices(spaceId),
			this.getScenes(spaceId),
			this.getWeather(),
			this.getEnergy(),
		]);

		const recentActions = spaceId
			? this.actionObserver.getRecentActionsBySpace(spaceId, 20)
			: this.actionObserver.getRecentActions(20);

		const recentIntents = recentActions.map((a) => ({
			type: a.type,
			space: a.spaceId,
			timestamp: a.timestamp.toISOString(),
		}));

		return {
			timestamp: new Date().toISOString(),
			spaces,
			devices,
			scenes,
			weather,
			energy,
			recentIntents,
		};
	}

	private async getSpaces(
		spaceId?: string,
	): Promise<{ id: string; name: string; category: string | null; deviceCount: number }[]> {
		try {
			if (spaceId) {
				const space = await this.spacesService.findOne(spaceId);

				if (!space) {
					return [];
				}

				const spaceDevices = await this.spacesService.findDevicesBySpace(spaceId);

				return [
					{
						id: space.id,
						name: space.name,
						category: space.category,
						deviceCount: spaceDevices.length,
					},
				];
			}

			const allSpaces = await this.spacesService.findAll();

			const result: { id: string; name: string; category: string | null; deviceCount: number }[] = [];

			for (const space of allSpaces) {
				const spaceDevices = await this.spacesService.findDevicesBySpace(space.id);

				result.push({
					id: space.id,
					name: space.name,
					category: space.category,
					deviceCount: spaceDevices.length,
				});
			}

			return result;
		} catch (error) {
			this.logger.warn(`Failed to get spaces: ${error}`);

			return [];
		}
	}

	private async getDevices(
		spaceId?: string,
	): Promise<{ id: string; name: string; space: string | null; category: string; state: Record<string, unknown> }[]> {
		try {
			let devices: DeviceEntity[];

			if (spaceId) {
				devices = await this.spacesService.findDevicesBySpace(spaceId);
			} else {
				devices = await this.devicesService.findAll();
			}

			return devices.map((device) => {
				const state: Record<string, unknown> = {};

				if (device.channels) {
					for (const channel of device.channels) {
						if (channel.properties) {
							const channelKey = channel.identifier ?? channel.name ?? channel.id;

							for (const property of channel.properties) {
								const key = `${channelKey}.${property.category}`;
								state[key] = property.value?.value ?? null;
							}
						}
					}
				}

				return {
					id: device.id,
					name: device.name,
					space: spaceId ?? device.roomId ?? null,
					category: device.category,
					state,
				};
			});
		} catch (error) {
			this.logger.warn(`Failed to get devices: ${error}`);

			return [];
		}
	}

	private async getScenes(
		spaceId?: string,
	): Promise<{ id: string; name: string; space: string | null; enabled: boolean }[]> {
		try {
			let scenes: SceneEntity[];

			if (spaceId) {
				scenes = await this.scenesService.findBySpace(spaceId);
			} else {
				scenes = await this.scenesService.findAll();
			}

			return scenes.map((scene) => ({
				id: scene.id,
				name: scene.name,
				space: scene.primarySpaceId ?? null,
				enabled: scene.enabled,
			}));
		} catch (error) {
			this.logger.warn(`Failed to get scenes: ${error}`);

			return [];
		}
	}

	private async getWeather(): Promise<{ temperature: number; conditions: string; humidity: number } | null> {
		try {
			const weather = await this.weatherService.getPrimaryWeather();

			if (!weather?.current) {
				return null;
			}

			return {
				temperature: weather.current.temperature ?? 0,
				conditions: weather.current.weather?.description ?? 'unknown',
				humidity: weather.current.humidity ?? 0,
			};
		} catch (error) {
			this.logger.debug(`Weather data unavailable: ${error}`);

			return null;
		}
	}

	private async getEnergy(): Promise<{
		solarProduction: number;
		gridConsumption: number;
		gridExport: number;
	} | null> {
		try {
			const now = new Date();
			const lookback = new Date(now.getTime() - 15 * 60 * 1000); // last 15 minutes
			const deltas = await this.energyDataService.getDeltas(lookback, now);

			if (deltas.length === 0) {
				return null;
			}

			// Use the most recent delta interval and convert kWh to approximate kW rate
			const latest = deltas[deltas.length - 1];
			const intervalMs = new Date(latest.intervalEnd).getTime() - new Date(latest.intervalStart).getTime();
			const intervalHours = intervalMs / (3600 * 1000);
			const kwhToKw = intervalHours > 0 ? 1 / intervalHours : 12; // fallback: 5-min → ×12

			return {
				solarProduction: (latest.productionDeltaKwh ?? 0) * kwhToKw,
				gridConsumption: (latest.gridImportDeltaKwh ?? 0) * kwhToKw,
				gridExport: (latest.gridExportDeltaKwh ?? 0) * kwhToKw,
			};
		} catch (error) {
			this.logger.debug(`Energy data unavailable: ${error}`);

			return null;
		}
	}
}
