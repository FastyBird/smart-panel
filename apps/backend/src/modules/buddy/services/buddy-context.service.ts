import { Injectable, Logger } from '@nestjs/common';

import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService } from '../../devices/services/devices.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { WeatherService } from '../../weather/services/weather.service';

import { ActionObserverService } from './action-observer.service';

export interface BuddyContext {
	timestamp: string;
	spaces: { id: string; name: string; category: string; deviceCount: number }[];
	devices: { id: string; name: string; space: string | null; category: string; state: Record<string, unknown> }[];
	scenes: { id: string; name: string; space: string | null; enabled: boolean }[];
	weather: { temperature: number; conditions: string; humidity: number } | null;
	energy: { solarProduction: number; gridConsumption: number; batteryLevel: number } | null;
	recentIntents: { type: string; space: string | null; timestamp: string }[];
}

@Injectable()
export class BuddyContextService {
	private readonly logger = new Logger(BuddyContextService.name);

	constructor(
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly scenesService: ScenesService,
		private readonly weatherService: WeatherService,
		private readonly energyDataService: EnergyDataService,
		private readonly actionObserver: ActionObserverService,
	) {}

	async buildContext(spaceId?: string): Promise<BuddyContext> {
		const [spaces, devices, scenes, weather, energy] = await Promise.all([
			this.buildSpacesContext(spaceId),
			this.buildDevicesContext(spaceId),
			this.buildScenesContext(spaceId),
			this.buildWeatherContext(),
			this.buildEnergyContext(),
		]);

		const recentIntents = this.buildRecentIntentsContext(spaceId);

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

	private async buildSpacesContext(
		spaceId?: string,
	): Promise<{ id: string; name: string; category: string; deviceCount: number }[]> {
		try {
			const allSpaces = await this.spacesService.findAll();
			const devices = await this.devicesService.findAll();

			const spaces = spaceId ? allSpaces.filter((s) => s.id === spaceId) : allSpaces;

			return spaces.map((space) => ({
				id: space.id,
				name: space.name,
				category: space.category ?? 'unknown',
				deviceCount: devices.filter((d) => d.roomId === space.id).length,
			}));
		} catch (error) {
			this.logger.warn(`Failed to build spaces context: ${error}`);

			return [];
		}
	}

	private async buildDevicesContext(
		spaceId?: string,
	): Promise<{ id: string; name: string; space: string | null; category: string; state: Record<string, unknown> }[]> {
		try {
			const allDevices = await this.devicesService.findAll();
			const devices = spaceId ? allDevices.filter((d) => d.roomId === spaceId) : allDevices;

			const result: {
				id: string;
				name: string;
				space: string | null;
				category: string;
				state: Record<string, unknown>;
			}[] = [];

			for (const device of devices) {
				const state = await this.getDeviceState(device.id);

				result.push({
					id: device.id,
					name: device.name,
					space: device.roomId,
					category: device.category,
					state,
				});
			}

			return result;
		} catch (error) {
			this.logger.warn(`Failed to build devices context: ${error}`);

			return [];
		}
	}

	private async getDeviceState(deviceId: string): Promise<Record<string, unknown>> {
		try {
			const channels = await this.channelsService.findAll(deviceId);
			const state: Record<string, unknown> = {};

			for (const channel of channels) {
				const properties = await this.channelsPropertiesService.findAll(channel.id);

				for (const prop of properties) {
					const key = `${channel.category}.${prop.category}`;
					state[key] = prop.value?.value ?? null;
				}
			}

			return state;
		} catch (error) {
			this.logger.debug(`Failed to get device state for ${deviceId}: ${error}`);

			return {};
		}
	}

	private async buildScenesContext(
		spaceId?: string,
	): Promise<{ id: string; name: string; space: string | null; enabled: boolean }[]> {
		try {
			const scenes = spaceId ? await this.scenesService.findBySpace(spaceId) : await this.scenesService.findAll();

			return scenes.map((scene) => ({
				id: scene.id,
				name: scene.name,
				space: scene.primarySpaceId,
				enabled: scene.enabled,
			}));
		} catch (error) {
			this.logger.warn(`Failed to build scenes context: ${error}`);

			return [];
		}
	}

	private async buildWeatherContext(): Promise<{ temperature: number; conditions: string; humidity: number } | null> {
		try {
			const weather = await this.weatherService.getPrimaryWeather();

			if (!weather?.current) {
				return null;
			}

			return {
				temperature: weather.current.temperature,
				conditions: weather.current.weather?.description ?? 'unknown',
				humidity: weather.current.humidity ?? 0,
			};
		} catch (error) {
			this.logger.debug(`Weather data unavailable: ${error}`);

			return null;
		}
	}

	private async buildEnergyContext(): Promise<{
		solarProduction: number;
		gridConsumption: number;
		batteryLevel: number;
	} | null> {
		try {
			const now = new Date();
			const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const summary = await this.energyDataService.getSummary(dayStart, now);

			return {
				solarProduction: summary.totalProductionKwh ?? 0,
				gridConsumption: summary.totalGridImportKwh ?? 0,
				batteryLevel: 0,
			};
		} catch (error) {
			this.logger.debug(`Energy data unavailable: ${error}`);

			return null;
		}
	}

	private buildRecentIntentsContext(spaceId?: string): { type: string; space: string | null; timestamp: string }[] {
		const actions = spaceId
			? this.actionObserver.getRecentActionsForSpace(spaceId, 20)
			: this.actionObserver.getRecentActions(20);

		return actions.map((action) => ({
			type: action.type,
			space: action.spaceId,
			timestamp: action.timestamp.toISOString(),
		}));
	}
}
