import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantDeviceDto } from '../dto/home-assistant-device.dto';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantConfigEntity } from '../entities/config-home-assistant.entity';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';
import { HomeAssistantDeviceModel } from '../models/home-assistant.model';

const DEVICE_DISCOVERY_TEMPLATE =
	"{% set devices = states | map(attribute='entity_id') | map('device_id') | unique | reject('eq', None) | list %}{% set ns = namespace(list=[]) %}{% for device in devices %}{% set entities = device_entities(device) | list %}{% if entities %}{% set ns.list = ns.list + [{'id': device, 'name': device_attr(device, 'name'), 'entities': entities}] %}{% endif %}{% endfor %}{{ ns.list | tojson }}";

@Injectable()
export class HomeAssistantHttpService {
	private readonly logger = new Logger(HomeAssistantHttpService.name);

	private pluginConfig: HomeAssistantConfigEntity | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly devicesService: DevicesService,
	) {}

	async getDevices(): Promise<HomeAssistantDeviceModel[]> {
		if (this.apiKey === null) {
			this.logger.warn('[HOME ASSISTANT][HTTP] Missing API key for Home Assistant service');

			throw new DevicesHomeAssistantValidationException('Api key is required');
		}

		try {
			this.logger.debug('[HOME ASSISTANT][HTTP] Fetching all devices list');

			const [devices, states] = await Promise.all([this.fetchHaDevices(), this.fetchHaStates()]);

			if (devices && states) {
				const panelDevices = await this.devicesService.findAll();

				return devices.map((device) =>
					plainToInstance(
						HomeAssistantDeviceModel,
						{
							id: device.id,
							name: device.name,
							entities: device.entities,
							states: states
								.filter((state) => device.entities.includes(state.entity_id))
								.map((state) => ({
									entityId: state.entity_id,
									state: state.state,
									attributes: state.attributes,
									lastChanged: state.last_changed,
									lastReported: state.last_reported,
									lastUpdated: state.last_updated,
								})),
							adoptedDeviceId:
								panelDevices.find(
									(panelDevice) =>
										panelDevice instanceof HomeAssistantDeviceEntity && panelDevice.haDeviceId === device.id,
								)?.id ?? null,
						},
						{
							enableImplicitConversion: true,
							exposeUnsetFields: false,
						},
					),
				);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][HTTP] Failed to fetch devices list', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException('An unhandled error occur. Devices list could not be loaded');
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant devices list could not be loaded');
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		this.pluginConfig = null;
	}

	private get config(): HomeAssistantConfigEntity {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<HomeAssistantConfigEntity>(
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
		return `http://${this.config.hostname}`;
	}

	private async fetchHaDevices(): Promise<HomeAssistantDeviceDto[] | null> {
		try {
			const url = new URL('/api/template', this.baseUrl);

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					template: DEVICE_DISCOVERY_TEMPLATE,
				}),
			});

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error('[HOME ASSISTANT][HTTP] Home Assistant API devices request failed', data);

				return null;
			}

			const devices = plainToInstance(HomeAssistantDeviceDto, data as object[], {
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

	private async fetchHaStates(): Promise<HomeAssistantStateDto[] | null> {
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
				this.logger.error('[HOME ASSISTANT][HTTP] Home Assistant state API request failed', data);

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
