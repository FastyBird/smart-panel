import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ChannelCategory, ConnectionState, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantDiscoveredDeviceDto } from '../dto/home-assistant-discovered-device.dto';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { HomeAssistantConfigModel } from '../models/config.model';
import { HomeAssistantDiscoveredDeviceModel, HomeAssistantStateModel } from '../models/home-assistant.model';

const DISCOVERED_DEVICES_TEMPLATE =
	"{% set devices = states | map(attribute='entity_id') | map('device_id') | unique | reject('eq', None) | list %}{% set ns = namespace(list=[]) %}{% for device in devices %}{% set entities = device_entities(device) | list %}{% if entities %}{% set ns.list = ns.list + [{'id': device, 'name': device_attr(device, 'name'), 'entities': entities}] %}{% endif %}{% endfor %}{{ ns.list | tojson }}";

const DISCOVERED_DEVICE_TEMPLATE =
	"{% set target_device = device_id %}{% set entities = device_entities(target_device) | list %}{% if entities %}{{ [{'id': target_device, 'name': device_attr(target_device, 'name'), 'entities': entities}] | tojson }}{% else %}{{ [] | tojson }}{% endif %}";

@Injectable()
export class HomeAssistantHttpService {
	private readonly logger = new Logger(HomeAssistantHttpService.name);

	private pluginConfig: HomeAssistantConfigModel | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly homeAssistantMapperService: MapperService,
	) {}

	async getDiscoveredDevice(id: string): Promise<HomeAssistantDiscoveredDeviceModel> {
		this.ensureApiKey();

		try {
			this.logger.debug('[HOME ASSISTANT][HTTP] Fetching single Home Assistant discovered device');

			const [device, states] = await Promise.all([this.fetchSingleHaDevice(id), this.fetchListHaStates()]);

			if (device && states) {
				const panelDevices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);

				const deviceModel = this.toDiscoveredDeviceModel(device);

				deviceModel.adoptedDeviceId =
					panelDevices.find((panelDevice) => panelDevice.haDeviceId === device.id)?.id ?? null;

				deviceModel.states = states
					.filter((state) => device.entities.includes(state.entity_id))
					.map((state) => this.toStateModel(state));

				return deviceModel;
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch Home Assistant discovered device detail', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant discovered device detail could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant discovered device detail could not be loaded');
	}

	async getDiscoveredDevices(): Promise<HomeAssistantDiscoveredDeviceModel[]> {
		this.ensureApiKey();

		try {
			this.logger.debug('[HOME ASSISTANT][HTTP] Fetching all Home Assistant discovered devices list');

			const [devices, states] = await Promise.all([this.fetchListHaDevices(), this.fetchListHaStates()]);

			if (devices && states) {
				const panelDevices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);

				return devices.map((device) => {
					const deviceModel = this.toDiscoveredDeviceModel(device);

					deviceModel.adoptedDeviceId =
						panelDevices.find((panelDevice) => panelDevice.haDeviceId === device.id)?.id ?? null;

					deviceModel.states = states
						.filter((state) => device.entities.includes(state.entity_id))
						.map((state) => this.toStateModel(state));

					return deviceModel;
				});
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch Home Assistant discovered devices list', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant discovered devices list could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant discovered devices list could not be loaded');
	}

	async getState(entityId: string): Promise<HomeAssistantStateModel> {
		this.ensureApiKey();

		try {
			this.logger.debug('[HOME ASSISTANT][HTTP] Fetching all Home Assistant discovered devices list');

			const state = await this.fetchSingleHaState(entityId);

			if (state) {
				return this.toStateModel(state);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to get Home Assistant entity state', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant entity state could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant entity state list could not be loaded');
	}

	async getStates(): Promise<HomeAssistantStateModel[]> {
		this.ensureApiKey();

		try {
			this.logger.debug('[HOME ASSISTANT][HTTP] Fetching all Home Assistant entities states list');

			const states = await this.fetchListHaStates();

			if (states) {
				return states.map((state) => this.toStateModel(state));
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch Home Assistant entities states list', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant entities states list could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant entities states list could not be loaded');
	}

	@Cron(CronExpression.EVERY_5_MINUTES)
	async loadStates() {
		if (this.apiKey === null) {
			return;
		}

		try {
			this.logger.debug('[HOME ASSISTANT][HTTP] Automatic fetch of all Home Assistant entities states list');

			const [states, haDevices, devices, properties] = await Promise.all([
				this.fetchListHaStates(),
				this.fetchListHaDevices(),
				this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE),
				this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
					undefined,
					DEVICES_HOME_ASSISTANT_TYPE,
				),
			]);

			if (!states?.length || !haDevices?.length || !devices?.length || !properties?.length) {
				this.logger.warn('[HOME ASSISTANT][HTTP] Missing data, skipping automatic sync');

				return;
			}

			const entityIdToHaDevice = new Map<string, HomeAssistantDiscoveredDeviceDto>();

			for (const haDevice of haDevices) {
				for (const entityId of haDevice.entities) {
					entityIdToHaDevice.set(entityId, haDevice);
				}
			}

			const deviceStatesMap = new Map<string, HomeAssistantStateDto[]>();

			for (const state of states) {
				const haDevice = entityIdToHaDevice.get(state.entity_id);

				if (!haDevice) {
					continue;
				}

				if (!deviceStatesMap.has(haDevice.id)) {
					deviceStatesMap.set(haDevice.id, []);
				}

				deviceStatesMap.get(haDevice.id).push(state);
			}

			for (const [haDeviceId, haDeviceStates] of deviceStatesMap) {
				const device = devices.find((device) => device.haDeviceId === haDeviceId);

				if (!device) {
					continue;
				}

				const resultMaps = await this.homeAssistantMapperService.mapFromHA(device, haDeviceStates);

				for (const map of resultMaps) {
					for (const [propertyId, value] of map) {
						const property = properties.find((property) => property.id === propertyId);

						if (!property) {
							continue;
						}

						await this.channelsPropertiesService.update(
							property.id,
							plainToInstance(UpdateHomeAssistantChannelPropertyDto, {
								...instanceToPlain(property),
								value,
							}),
						);
					}
				}

				const stateProperty = properties.find(
					(property) =>
						property.category === PropertyCategory.STATUS &&
						property.channel instanceof HomeAssistantChannelEntity &&
						property.channel.category === ChannelCategory.DEVICE_INFORMATION &&
						property.channel.device instanceof HomeAssistantDeviceEntity &&
						property.channel.device.id === device.id,
				);

				if (stateProperty) {
					const isOffline = haDeviceStates.every(
						(state) => typeof state.state === 'string' && state.state.toLowerCase() === 'unavailable',
					);

					await this.channelsPropertiesService.update(
						stateProperty.id,
						plainToInstance(UpdateHomeAssistantChannelPropertyDto, {
							...instanceToPlain(stateProperty),
							value: isOffline ? ConnectionState.DISCONNECTED : ConnectionState.CONNECTED,
						}),
					);

					this.logger.debug(
						`[HOME ASSISTANT][HTTP] Device ${device.name} (${device.id}) marked as ${isOffline ? 'DISCONNECTED' : 'CONNECTED'}`,
					);
				}
			}

			this.logger.debug('[HOME ASSISTANT][HTTP] Automatic fetch of all Home Assistant entities states list completed');
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to automated fetch of Home Assistant entities states list', {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		this.pluginConfig = null;
	}

	private get config(): HomeAssistantConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<HomeAssistantConfigModel>(
				DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			);
		}

		return this.pluginConfig;
	}

	private get apiKey(): string {
		return this.config.apiKey;
	}

	private get hostname(): string {
		return this.config.hostname;
	}

	private get baseUrl(): string {
		return `http://${this.hostname}`;
	}

	private ensureApiKey(): void {
		if (this.apiKey === null) {
			this.logger.warn('[HOME ASSISTANT][HTTP] Missing API key for Home Assistant HTTP service');

			throw new DevicesHomeAssistantValidationException('Api key is required');
		}
	}

	private toDiscoveredDeviceModel(dto: HomeAssistantDiscoveredDeviceDto): HomeAssistantDiscoveredDeviceModel {
		return plainToInstance(
			HomeAssistantDiscoveredDeviceModel,
			{
				id: dto.id,
				name: dto.name,
				entities: dto.entities,
				states: [],
				adoptedDeviceId: null,
			},
			{
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			},
		);
	}

	private toStateModel(dto: HomeAssistantStateDto): HomeAssistantStateModel {
		return plainToInstance(
			HomeAssistantStateModel,
			{
				entityId: dto.entity_id,
				state: dto.state,
				attributes: dto.attributes,
				lastChanged: dto.last_changed,
				lastReported: dto.last_reported,
				lastUpdated: dto.last_updated,
			},
			{
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			},
		);
	}

	private async fetchSingleHaDevice(id: string): Promise<HomeAssistantDiscoveredDeviceDto | null> {
		try {
			const url = new URL('/api/template', this.baseUrl);

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					template: DISCOVERED_DEVICE_TEMPLATE,
					variables: {
						device_id: id,
					},
				}),
			});

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error('[HOME ASSISTANT][HTTP] Home Assistant API template request failed', data);

				return null;
			}

			const devices = plainToInstance(HomeAssistantDiscoveredDeviceDto, data as object[], {
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			});

			const errors = await Promise.all(
				devices.map((device) => validate(device, { whitelist: true, forbidNonWhitelisted: true })),
			);

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(
					`[VALIDATION] Home Assistant device response validation failed error=${JSON.stringify(errors)}`,
				);

				return null;
			}

			if (devices.length === 0) {
				return null;
			}

			return devices[0];
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch devices list', {
				message: err.message,
				stack: err.stack,
			});

			return null;
		}
	}

	private async fetchListHaDevices(): Promise<HomeAssistantDiscoveredDeviceDto[] | null> {
		try {
			const url = new URL('/api/template', this.baseUrl);

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					template: DISCOVERED_DEVICES_TEMPLATE,
				}),
			});

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error('[HOME ASSISTANT][HTTP] Home Assistant API template request failed', data);

				return null;
			}

			const devices = plainToInstance(HomeAssistantDiscoveredDeviceDto, data as object[], {
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			});

			const errors = await Promise.all(
				devices.map((device) => validate(device, { whitelist: true, forbidNonWhitelisted: true })),
			);

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(
					`[VALIDATION] Home Assistant devices response validation failed error=${JSON.stringify(errors)}`,
				);

				return null;
			}

			return devices;
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch devices list', {
				message: err.message,
				stack: err.stack,
			});

			return null;
		}
	}

	private async fetchSingleHaState(entityId: string): Promise<HomeAssistantStateDto | null> {
		try {
			const url = new URL(`/api/states/${entityId}`, this.baseUrl);

			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
			});

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error('[HOME ASSISTANT][HTTP] Home Assistant state API request failed', data);

				return null;
			}

			const state = plainToInstance(HomeAssistantStateDto, data as object, {
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			});

			const errors = await validate(state);

			if (errors.length) {
				this.logger.error(
					`[VALIDATION] Home Assistant states response validation failed error=${JSON.stringify(errors)}`,
				);

				return null;
			}

			return state;
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch states list', {
				message: err.message,
				stack: err.stack,
			});

			return null;
		}
	}

	private async fetchListHaStates(): Promise<HomeAssistantStateDto[] | null> {
		try {
			const url = new URL('/api/states', this.baseUrl);

			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
			});

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error('[HOME ASSISTANT][HTTP] Home Assistant states API request failed', data);

				return null;
			}

			const states = plainToInstance(HomeAssistantStateDto, data as object[], {
				enableImplicitConversion: true,
				exposeUnsetFields: false,
			});

			const errors = await Promise.all(
				states.map((state) => validate(state, { whitelist: true, forbidNonWhitelisted: true })),
			);

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(
					`[VALIDATION] Home Assistant states response validation failed error=${JSON.stringify(errors)}`,
				);

				return null;
			}

			return states;
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch states list', {
				message: err.message,
				stack: err.stack,
			});

			return null;
		}
	}
}
