import { instanceToPlain } from 'class-transformer';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as DevicesModuleEventType } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { HomeAssistantDiscoveredDeviceDto } from '../dto/home-assistant-discovered-device.dto';
import { HomeAssistantStateChangedEventDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { WsEventService } from './home-assistant.ws.service';

@Injectable()
export class StateChangedEventService implements WsEventService {
	private readonly logger = new Logger(StateChangedEventService.name);

	private isMappingLoading = false;

	private entityIdToHaDevice: Map<string, HomeAssistantDiscoveredDeviceDto> | null = null;

	private devices: HomeAssistantDeviceEntity[] = [];

	private properties: HomeAssistantChannelPropertyEntity[] = [];

	private debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly homeAssistantMapperService: MapperService,
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
	) {}

	@OnEvent(DevicesModuleEventType.DEVICE_CREATED)
	@OnEvent(DevicesModuleEventType.DEVICE_UPDATED)
	@OnEvent(DevicesModuleEventType.DEVICE_DELETED)
	@OnEvent(DevicesModuleEventType.CHANNEL_CREATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_UPDATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_DELETED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_DELETED)
	handleDevicesUpdatedEvent() {
		this.entityIdToHaDevice = null;
	}

	get event(): string {
		return 'state_changed';
	}

	async handle(event: HomeAssistantStateChangedEventDto): Promise<void> {
		if (!(await this.initializeMappings())) {
			return;
		}

		if (event.data.new_state === null) {
			return;
		}

		const entityId = event.data.new_state.entity_id;

		if (this.debounceTimers.has(entityId)) {
			clearTimeout(this.debounceTimers.get(entityId));
		}

		const haDevice = this.entityIdToHaDevice.get(entityId);

		if (!haDevice) {
			return;
		}

		const device = this.devices.find((device) => device.haDeviceId === haDevice.id);

		if (!device) {
			return;
		}

		this.debounceTimers.set(
			entityId,
			setTimeout(() => {
				void (async () => {
					this.logger.debug(`[HOME ASSISTANT][STATE CHANGED EVENT] Processing state for ${entityId}`);

					const resultMaps = await this.homeAssistantMapperService.mapFromHA(device, [event.data.new_state]);

					for (const map of resultMaps) {
						for (const [propertyId, value] of map) {
							const property = this.properties.find((property) => property.id === propertyId);

							if (!property) {
								continue;
							}

							await this.channelsPropertiesService.update(
								property.id,
								toInstance(UpdateHomeAssistantChannelPropertyDto, {
									...instanceToPlain(property),
									value,
								}),
							);
						}
					}
				})();
			}, 500),
		);
	}

	private async initializeMappings(): Promise<boolean> {
		if (this.entityIdToHaDevice !== null) {
			return true;
		}

		if (this.isMappingLoading) {
			return false;
		}

		this.isMappingLoading = true;

		try {
			const [haDevices, panelDevices, properties] = await Promise.all([
				this.homeAssistantHttpService.getDiscoveredDevices(),
				this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE),
				this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
					undefined,
					DEVICES_HOME_ASSISTANT_TYPE,
				),
			]);

			if (!haDevices?.length || !panelDevices?.length || !properties?.length) {
				this.logger.warn('[HOME ASSISTANT][STATE CHANGED EVENT] Missing data, skipping automatic sync');

				return false;
			}

			this.entityIdToHaDevice = new Map();

			haDevices.forEach((device) =>
				device.entities.forEach((entityId) => this.entityIdToHaDevice.set(entityId, device)),
			);

			this.devices = panelDevices;
			this.properties = properties;

			return true;
		} finally {
			this.isMappingLoading = false;
		}
	}
}
