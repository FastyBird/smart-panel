import { instanceToPlain } from 'class-transformer';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as DevicesModuleEventType } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	DEVICES_HOME_ASSISTANT_TYPE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { HomeAssistantDiscoveredDeviceDto } from '../dto/home-assistant-discovered-device.dto';
import { HomeAssistantStateChangedEventDto, HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { WsEventService } from './home-assistant.ws.service';
import { VirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext, VirtualPropertyType, getVirtualPropertiesForChannel } from './virtual-property.types';

@Injectable()
export class StateChangedEventService implements WsEventService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'StateChangedEventService',
	);

	private isMappingLoading = false;

	private entityIdToHaDevice: Map<string, HomeAssistantDiscoveredDeviceDto> | null = null;

	private devices: HomeAssistantDeviceEntity[] = [];

	private properties: HomeAssistantChannelPropertyEntity[] = [];

	private debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly homeAssistantMapperService: MapperService,
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly virtualPropertyService: VirtualPropertyService,
	) {}

	// Invalidate cache on structural changes (create/delete/metadata updates).
	// This ensures that when users modify property metadata like haEntityId or haAttribute
	// through the API, the cache is refreshed and new mappings take effect immediately.
	// Note: Value-only updates emit CHANNEL_PROPERTY_VALUE_SET (not CHANNEL_PROPERTY_UPDATED),
	// so they won't trigger cache invalidation. This prevents unnecessary cache rebuilds
	// when HA state changes are written to the database.
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
					this.logger.debug(
						`[STATE CHANGED] Processing state for ${entityId}, ` +
							`state=${event.data.new_state.state}, ` +
							`brightness=${JSON.stringify(event.data.new_state.attributes?.brightness ?? 'N/A')}`,
					);

					const resultMaps = await this.homeAssistantMapperService.mapFromHA(device, [event.data.new_state]);

					this.logger.debug(`[STATE CHANGED] Received ${resultMaps.length} result maps from mapper`);

					for (const map of resultMaps) {
						this.logger.debug(`[STATE CHANGED] Processing map with ${map.size} entries`);

						for (const [propertyId, value] of map) {
							const property = this.properties.find((property) => property.id === propertyId);

							if (!property) {
								this.logger.warn(
									`[STATE CHANGED] Property ${propertyId} not found in cache, ` +
										`cache has ${this.properties.length} properties`,
								);
								continue;
							}

							this.logger.debug(
								`[STATE CHANGED] Updating property ${property.category} (${property.id}) ` +
									`with value=${String(value)}`,
							);

							await this.channelsPropertiesService.update(
								property.id,
								toInstance(UpdateHomeAssistantChannelPropertyDto, {
									...instanceToPlain(property),
									value,
								}),
							);
						}
					}

					// Update related virtual properties
					await this.updateVirtualPropertiesForEntity(device.id, entityId, event.data.new_state);
				})();
			}, 500),
		);
	}

	/**
	 * Update virtual properties for channels that have properties mapped to this entity
	 */
	private async updateVirtualPropertiesForEntity(
		deviceId: string,
		entityId: string,
		state: HomeAssistantStateDto,
	): Promise<void> {
		// Find properties linked to this entity
		const entityProperties = this.properties.filter((p) => p.haEntityId === entityId);

		if (entityProperties.length === 0) {
			return;
		}

		// Group by channel
		const channelIds = new Set<string>();
		for (const prop of entityProperties) {
			const channelId = typeof prop.channel === 'string' ? prop.channel : prop.channel?.id;
			if (channelId) {
				channelIds.add(channelId);
			}
		}

		// Load channels to get their categories
		for (const channelId of channelIds) {
			const channel = await this.channelsService.findOne<HomeAssistantChannelEntity>(
				channelId,
				undefined,
				DEVICES_HOME_ASSISTANT_TYPE,
			);

			if (!channel) {
				continue;
			}

			const virtualDefs = getVirtualPropertiesForChannel(channel.category);

			if (virtualDefs.length === 0) {
				continue;
			}

			// Find virtual properties for this channel
			const channelProperties = this.properties.filter((p) => {
				const propChannelId = typeof p.channel === 'string' ? p.channel : p.channel?.id;
				return propChannelId === channelId;
			});

			const virtualProps = channelProperties.filter((p) => p.haAttribute?.startsWith('fb.virtual.'));

			if (virtualProps.length === 0) {
				continue;
			}

			// Build context for virtual property resolution
			const context: VirtualPropertyContext = {
				entityId,
				domain: entityId.split('.')[0] as HomeAssistantDomain,
				deviceClass: (state.attributes?.device_class as string) ?? null,
				state: {
					entityId: state.entity_id,
					state: state.state,
					attributes: state.attributes,
					lastChanged: state.last_changed,
					lastReported: state.last_reported,
					lastUpdated: state.last_updated,
				},
			};

			// Update each virtual property
			for (const virtualProp of virtualProps) {
				const virtualDef = virtualDefs.find((vd) => vd.property_category === virtualProp.category);

				if (!virtualDef || virtualDef.virtual_type === VirtualPropertyType.COMMAND) {
					continue;
				}

				const resolved = this.virtualPropertyService.resolveVirtualPropertyValue(virtualDef, context);

				if (resolved.value !== null) {
					await this.channelsPropertiesService.update(
						virtualProp.id,
						toInstance(UpdateHomeAssistantChannelPropertyDto, {
							...instanceToPlain(virtualProp),
							value: resolved.value,
						}),
					);

					this.logger.debug(
						`Updated virtual property ${virtualProp.category} = ${String(resolved.value)} for channel ${channel.category}`,
					);
				}
			}
		}
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
				return false;
			}

			this.entityIdToHaDevice = new Map();

			haDevices.forEach((device) =>
				device.entities.forEach((entityId) => this.entityIdToHaDevice.set(entityId, device)),
			);

			this.devices = panelDevices;
			this.properties = properties;

			return true;
		} catch (error) {
			const err = error as Error;

			this.logger.warn('Failed to initialize mappings, Home Assistant may be unavailable', {
				message: err.message,
			});

			return false;
		} finally {
			this.isMappingLoading = false;
		}
	}
}
