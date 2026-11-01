import { validate } from 'class-validator';

import { Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { HttpDevicePlatform } from '../../../modules/devices/platforms/http-device.platform';
import { NativeClimateUnit } from '../../../modules/devices/platforms/native-climate.contract';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { HomeAssistantServiceRequestDto } from '../dto/home-assistant-service-request.dto';
import {
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { HomeAssistantConfigModel } from '../models/config.model';
import { HaSupervisorService } from '../services/ha-supervisor.service';
import { HomeAssistantNativeClimateService } from '../services/home-assistant-native-climate.service';

export type IHomeAssistantDevicePropertyData = IDevicePropertyData & {
	device: HomeAssistantDeviceEntity;
};

@Injectable()
export class HomeAssistantDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HomeAssistantDevicePlatform',
	);

	private pluginConfig: HomeAssistantConfigModel | null = null;
	private readonly legacyCommands = new Map<string, { pending: number; generation: number }>();

	constructor(
		private readonly configService: ConfigService,
		private readonly mapperService: MapperService,
		private readonly supervisorService: HaSupervisorService,
		@Optional() private readonly nativeClimateService?: HomeAssistantNativeClimateService,
	) {
		super();
	}

	async captureNativeClimateUnit(device: DeviceEntity): Promise<NativeClimateUnit | null> {
		let fence = this.legacyCommands.get(device.id);
		if (!fence) {
			fence = { pending: 0, generation: 0 };
			this.legacyCommands.set(device.id, fence);
		}
		if (fence.pending) return null;
		const generation = fence.generation;
		const unit = await this.nativeClimateService?.capture(device);
		const current = () =>
			this.legacyCommands.get(device.id) === fence &&
			fence.pending === 0 &&
			fence.generation === generation &&
			unit?.isCurrent() === true;
		if (!unit || !current()) return null;
		return {
			...unit,
			isCurrent: current,
			observe: () =>
				current()
					? unit.observe()
					: {
							available: false,
							temperature: null,
							mode: null,
							heatingSetpoint: null,
							coolingSetpoint: null,
							activity: null,
							observedAt: null,
							reasons: ['legacy_command_in_flight'],
						},
			prepare: (request) => {
				if (!current()) return null;
				const prepared = unit.prepare(request);
				if (!prepared) return null;
				return {
					isCurrent: () => current() && prepared.isCurrent(),
					dispatch: (isAdmitted) => prepared.dispatch(() => current() && isAdmitted()),
				};
			},
		};
	}

	@OnEvent('DevicesModule.Device.Deleted')
	retireNativeCommandFence(device: { id?: string }): void {
		if (device.id) this.legacyCommands.delete(device.id);
	}

	getType(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		this.pluginConfig = null;
	}

	async process({ device, channel, property, value }: IHomeAssistantDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IHomeAssistantDevicePropertyData>): Promise<boolean> {
		if (!updates.length) return true;
		const id = updates[0].device.id;
		let fence = this.legacyCommands.get(id);
		if (!fence) {
			fence = { pending: 0, generation: 0 };
			this.legacyCommands.set(id, fence);
		}
		fence.pending++;
		fence.generation++;
		try {
			return await this.processLegacyBatch(updates);
		} finally {
			fence.pending--;
		}
	}

	private async processLegacyBatch(updates: Array<IHomeAssistantDevicePropertyData>): Promise<boolean> {
		const device = updates[0].device;

		if (!(device instanceof HomeAssistantDeviceEntity)) {
			this.logger.error('Failed to update device property, invalid device provided');

			return false;
		}

		const values = new Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>();

		for (const { property, value } of updates) {
			values.set(property.id, value);
		}

		const setStates = await this.mapperService.mapToHA(device, values);

		if (setStates.length === 0) {
			this.logger.error('Failed to update device property, no payload to send', { resource: device.id });

			return false;
		}

		const result = new Map<ChannelPropertyEntity['id'], boolean>();

		for (const setState of setStates) {
			const propsToUpdate = setState.properties;

			try {
				const endpoint = `${this.baseUrl}/api/services/${setState.domain}/${setState.service}`;

				const payload = {
					entity_id: setState.entityId,
					...(setState.attributes ? Object.fromEntries(setState.attributes) : []),
				};

				if (!(await this.validateDto(HomeAssistantServiceRequestDto, payload))) {
					return false;
				}

				const response = await this.sendCommand(endpoint, payload, 'POST', 3, {
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						'Content-Type': 'application/json',
					},
				});

				propsToUpdate.forEach((prop) => {
					result.set(prop.id, response !== false);
				});

				if (response === false) {
					this.logger.error('Failed to update device property', { resource: device.id });
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error('Error processing property update', {
					resource: device.id,
					message: err.message,
					stack: err.stack,
				});

				propsToUpdate.forEach((prop) => {
					result.set(prop.id, false);
				});

				return false;
			}
		}

		const failed = Array.from(result.values()).filter((success) => !success);

		if (failed.length > 0) {
			this.logger.warn(`Some properties failed to update for device id=${device.id}: ${JSON.stringify(failed)}`, {
				resource: device.id,
			});

			return false;
		}

		this.logger.log(`Successfully processed all property updates for device id=${device.id}`, { resource: device.id });

		return true;
	}

	private async validateDto<T extends object>(dtoClass: new () => T, data: unknown): Promise<boolean> {
		const instance = toInstance(dtoClass, data, {
			excludeExtraneousValues: false,
		});

		// Don't use forbidNonWhitelisted since Home Assistant service calls have many dynamic
		// attributes (brightness, color_temp, rgb_color, hs_color, white, effect, etc.)
		// that cannot be enumerated in a DTO. Only validate that required fields are present.
		const errors = await validate(instance, {
			whitelist: false,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Request payload validation failed error=${JSON.stringify(errors)}`);

			return false;
		}

		return true;
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
		if (this.supervisorService.isInSupervisorMode()) {
			return this.supervisorService.getSupervisorToken();
		}

		return this.config.apiKey;
	}

	private get hostname(): string {
		return this.config.hostname;
	}

	private get baseUrl(): string {
		if (this.supervisorService.isInSupervisorMode()) {
			return this.supervisorService.getSupervisorApiUrl();
		}

		if (this.hostname.startsWith('http://') || this.hostname.startsWith('https://')) {
			return this.hostname.replace(/\/+$/, '');
		}

		return `http://${this.hostname}`;
	}
}
