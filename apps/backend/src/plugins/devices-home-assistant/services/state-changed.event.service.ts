import { Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as DevicesModuleEventType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	DEVICES_HOME_ASSISTANT_TYPE,
	ENTITY_MAIN_STATE_ATTRIBUTE,
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
import { normalizeHaEventType } from '../utils/ha-event.utils';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { HomeAssistantEventIngress, WsEventService } from './home-assistant.ws.service';
import { VirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext } from './virtual-property.types';

/** Normalized main-state value of the physical entities supported by this reporter. */
function physicalMainValue(state?: HomeAssistantStateDto | null): number | boolean | null {
	if (!state) return null;
	if (state.entity_id.startsWith('switch.')) return state.state === 'on' ? true : state.state === 'off' ? false : null;
	if (
		!state.entity_id.startsWith('sensor.') ||
		state.attributes?.device_class !== 'temperature' ||
		!state.state?.trim()
	)
		return null;
	const value = Number(state.state);
	if (!Number.isFinite(value)) return null;
	switch (state.attributes.unit_of_measurement) {
		case '°C':
			return value;
		case '°F':
			return ((value - 32) * 5) / 9;
		case 'K':
			return value - 273.15;
		default:
			return null;
	}
}

function independentContext(context: HomeAssistantStateDto['context']): boolean {
	return !!context?.id && context.user_id === null && context.parent_id === null;
}

@Injectable()
export class StateChangedEventService implements WsEventService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'StateChangedEventService',
	);

	private mappingLoad: Promise<boolean> | null = null;
	private reportSession: string | null = null;
	private mappingGeneration = 0;
	private readonly sourceEpochs = new Map<string, object>();

	private entityIdToHaDevice: Map<string, HomeAssistantDiscoveredDeviceDto> | null = null;

	private devices: HomeAssistantDeviceEntity[] = [];

	private debounceTimers = new Map<string, NodeJS.Timeout>();

	// Cache for channels by device ID
	private channelsByDeviceId: Map<string, HomeAssistantChannelEntity[]> = new Map();

	// Cache for properties by channel ID
	private propertiesByChannelId: Map<string, HomeAssistantChannelPropertyEntity[]> = new Map();

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly homeAssistantMapperService: MapperService,
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly virtualPropertyService: VirtualPropertyService,
		@Optional()
		private readonly channelInputOccurrencesService?: ChannelInputOccurrencesService,
	) {}

	// Invalidate cache on structural changes (create/delete/update).
	// This ensures that when users modify property metadata like haEntityId or haAttribute
	// through the API, the cache is refreshed and new mappings take effect immediately.
	// Note: While value updates also trigger CHANNEL_PROPERTY_UPDATED, this is acceptable
	// because the cache reload fetches the latest metadata from the database, and HA state
	// values are always applied fresh from incoming WebSocket events.
	@OnEvent(DevicesModuleEventType.DEVICE_CREATED)
	@OnEvent(DevicesModuleEventType.DEVICE_UPDATED)
	@OnEvent(DevicesModuleEventType.DEVICE_DELETED)
	@OnEvent(DevicesModuleEventType.CHANNEL_CREATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_UPDATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_DELETED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_DELETED)
	handleDevicesUpdatedEvent(entity?: { type?: string }) {
		if (entity?.type && entity.type !== DEVICES_HOME_ASSISTANT_TYPE) return;
		this.mappingGeneration++;
		this.sourceEpochs.clear();
		this.mappingLoad = null;
		this.entityIdToHaDevice = null;
		this.channelsByDeviceId.clear();
		this.propertiesByChannelId.clear();
	}

	get event(): string {
		return 'state_changed';
	}

	async handle(event: HomeAssistantStateChangedEventDto, ingress?: HomeAssistantEventIngress): Promise<void> {
		if (ingress && !ingress.isCurrent()) return;
		if (ingress && this.reportSession !== ingress.session) {
			this.handleDevicesUpdatedEvent();
			this.reportSession = ingress.session;
		}
		const state = event.data.new_state;
		const old = event.data.old_state;
		const entityId = state?.entity_id ?? old?.entity_id;
		if (!entityId) return;
		const physicalValue = physicalMainValue(state);
		const trusted =
			physicalValue !== null &&
			!state.attributes?.assumed_state &&
			!state.attributes?.restored &&
			!state.attributes?.optimistic &&
			independentContext(state.context) &&
			independentContext(event.context);
		if (!old || !trusted) this.sourceEpochs.delete(entityId);
		if (!state) return;

		const generation = this.mappingGeneration;
		const changedAt = state.last_changed;
		// HA last_updated and last_reported can advance for attributes alone. Only a change of
		// the adopted entity's own main state carries a new measurement at last_changed.
		const transition =
			trusted &&
			ingress &&
			old?.entity_id === entityId &&
			old.state !== state.state &&
			!old.attributes?.restored &&
			!old.attributes?.assumed_state &&
			changedAt instanceof Date &&
			Number.isFinite(changedAt.getTime()) &&
			changedAt <= ingress.receivedAt &&
			old.last_changed instanceof Date &&
			changedAt > old.last_changed;
		if (transition && !this.sourceEpochs.has(entityId)) this.sourceEpochs.set(entityId, {});
		const epoch = this.sourceEpochs.get(entityId);
		const sourceIsCurrent = (): boolean =>
			!!epoch &&
			!!ingress?.isCurrent() &&
			this.mappingGeneration === generation &&
			this.sourceEpochs.get(entityId) === epoch;

		if (!(await this.initializeMappings()) || (ingress && !ingress.isCurrent())) return;
		if (entityId.startsWith('event.')) {
			await this.handleHardwareEventEntity(event);
			return;
		}
		const haDevice = this.entityIdToHaDevice?.get(entityId);
		const device = haDevice && this.devices.find((item) => item.haDeviceId === haDevice.id);
		if (!device) {
			if (this.sourceEpochs.get(entityId) === epoch) this.sourceEpochs.delete(entityId);
			return;
		}

		clearTimeout(this.debounceTimers.get(entityId));
		this.debounceTimers.delete(entityId);
		const process = async (): Promise<void> => {
			if (ingress && !ingress.isCurrent()) return;
			const resultMaps = await this.homeAssistantMapperService.mapFromHA(device, [state]);
			for (const entries of resultMaps) {
				for (const { property, value } of entries) {
					const update = toInstance(UpdateHomeAssistantChannelPropertyDto, {
						type: DEVICES_HOME_ASSISTANT_TYPE,
						value,
					});
					if (ingress && (!ingress.isCurrent() || this.mappingGeneration !== generation)) return;
					if (
						transition &&
						device.enabled &&
						property.haEntityId === entityId &&
						property.haAttribute === ENTITY_MAIN_STATE_ATTRIBUTE &&
						property.category ===
							(typeof physicalValue === 'boolean' ? PropertyCategory.ON : PropertyCategory.TEMPERATURE) &&
						value === physicalValue
					) {
						if (sourceIsCurrent())
							await this.channelsPropertiesService.reportSample(property.id, update, {
								sampledAt: changedAt,
								receivedAt: ingress.receivedAt,
								observedAt: ingress.receivedAt,
								ingressSequence: ingress.ingressSequence,
								provenance: 'live',
								sourceIsCurrent,
							});
					} else {
						await this.channelsPropertiesService.update(property.id, update);
					}
				}
			}
			await this.updateVirtualPropertiesForEntity(device.id, entityId, state);
		};
		const run = (): Promise<void> =>
			process().catch((error: unknown) =>
				this.logger.warn('Failed to process Home Assistant state', {
					message: error instanceof Error ? error.message : 'unknown error',
				}),
			);
		if (transition) {
			await run();
			return;
		}
		this.debounceTimers.set(
			entityId,
			setTimeout(() => {
				this.debounceTimers.delete(entityId);
				void run();
			}, 500),
		);
	}

	/**
	 * Handles Home Assistant event.* entities, publishing hardware input occurrences
	 * independently of property state and without debounce delay.
	 */
	private async handleHardwareEventEntity(event: HomeAssistantStateChangedEventDto): Promise<void> {
		if (event.data.new_state === null) {
			return;
		}

		const entityId = event.data.new_state.entity_id;

		// 1. Startup snapshot / reconnect / initial refresh: old_state is null -> skip!
		if (event.data.old_state === null) {
			this.logger.debug(`[HARDWARE EVENT] Skipping startup/initial state refresh for ${entityId}, no event occurred.`);
			return;
		}

		// 2. State timestamp didn't change (e.g. friendly_name or availability update) -> skip!
		if (event.data.new_state.state === event.data.old_state.state) {
			this.logger.debug(
				`[HARDWARE EVENT] Skipping state change for ${entityId}: timestamp ${event.data.new_state.state} unchanged.`,
			);
			return;
		}

		// 3. Unavailable / unknown states -> skip!
		if (event.data.new_state.state === 'unavailable' || event.data.new_state.state === 'unknown') {
			return;
		}

		// 4. Raw event_type attribute
		const rawEventType = event.data.new_state.attributes?.event_type;
		if (typeof rawEventType !== 'string' || !rawEventType.trim()) {
			this.logger.debug(`[HARDWARE EVENT] Event entity ${entityId} state changed without event_type attribute`);
			return;
		}

		// 5. Look up device and channel
		const haDevice = this.entityIdToHaDevice?.get(entityId);
		if (!haDevice) {
			this.logger.debug(`[HARDWARE EVENT] No HA device mapped for entity ${entityId}`);
			return;
		}

		const device = this.devices.find((d) => d.haDeviceId === haDevice.id);
		if (!device) {
			this.logger.debug(`[HARDWARE EVENT] No adopted Smart Panel device for HA device ${haDevice.id}`);
			return;
		}

		const channels = await this.getChannelsForDevice(device.id);
		const properties = await this.getPropertiesForChannels(channels);

		// Find property mapped to this entityId with EVENT category
		const eventProp = properties.find((p) => p.haEntityId === entityId && p.category === PropertyCategory.EVENT);

		if (!eventProp) {
			this.logger.debug(`[HARDWARE EVENT] No EVENT property mapped to ${entityId} on device ${device.id}`);
			return;
		}

		const channelId = typeof eventProp.channel === 'string' ? eventProp.channel : eventProp.channel?.id;
		if (!channelId) {
			return;
		}

		const normalizedEvent = normalizeHaEventType(rawEventType);
		const sourceTimestamp = event.data.new_state.state;
		const contextId = event.data.new_state.context?.id;
		const sourceOccurrenceId = contextId
			? `${entityId}:${event.data.new_state.state}:${contextId}`
			: `${entityId}:${event.data.new_state.state}`;

		this.logger.debug(
			`[HARDWARE EVENT] Publishing occurrence: device=${device.id}, channel=${channelId}, ` +
				`event=${normalizedEvent}, sourceOccurrenceId=${sourceOccurrenceId}`,
		);

		if (this.channelInputOccurrencesService) {
			await this.channelInputOccurrencesService.publishOccurrence({
				deviceId: device.id,
				channelId,
				propertyId: eventProp.id,
				event: normalizedEvent,
				nativeEventType: rawEventType,
				sourceTimestamp,
				sourceOccurrenceId,
				data: {
					entity_id: entityId,
					event_type: rawEventType,
					state: event.data.new_state.state,
					context: event.data.new_state.context,
				},
			});
		}
	}

	/**
	 * Update virtual properties for channels that have properties mapped to this entity
	 */
	private async updateVirtualPropertiesForEntity(
		deviceId: string,
		entityId: string,
		state: HomeAssistantStateDto,
	): Promise<void> {
		// Get channels from cache or load and cache them
		const channels = await this.getChannelsForDevice(deviceId);

		if (channels.length === 0) {
			return;
		}

		// Get properties from cache or load and cache them
		const allProperties = await this.getPropertiesForChannels(channels);

		// Find properties linked to this entity
		const entityProperties = allProperties.filter((p) => p.haEntityId === entityId);

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

		// Process each channel
		for (const channelId of channelIds) {
			const channel = channels.find((c) => c.id === channelId);

			if (!channel) {
				continue;
			}

			const virtualDefs = this.virtualPropertyService.getVirtualPropertiesForChannel(channel.category);

			if (virtualDefs.length === 0) {
				continue;
			}

			// Find virtual properties for this channel
			const channelProperties = allProperties.filter((p) => {
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
				const virtualDef = virtualDefs.find((vd) => vd.propertyCategory === virtualProp.category);

				if (!virtualDef || virtualDef.virtualType === 'command') {
					continue;
				}

				const resolved = this.virtualPropertyService.resolveVirtualPropertyValue(virtualDef, context);

				if (resolved.value !== null) {
					await this.channelsPropertiesService.update(
						virtualProp.id,
						toInstance(UpdateHomeAssistantChannelPropertyDto, {
							type: DEVICES_HOME_ASSISTANT_TYPE,
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

	private initializeMappings(): Promise<boolean> {
		if (this.entityIdToHaDevice !== null) return Promise.resolve(true);
		if (this.mappingLoad === null) {
			const load = this.loadMappings(this.mappingGeneration).finally(() => {
				if (this.mappingLoad === load) this.mappingLoad = null;
			});
			this.mappingLoad = load;
		}
		return this.mappingLoad;
	}

	private async loadMappings(generation: number): Promise<boolean> {
		try {
			const [haDevices, panelDevices] = await Promise.all([
				this.homeAssistantHttpService.getDiscoveredDevices(),
				this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE),
			]);

			if (this.mappingGeneration !== generation || !haDevices?.length || !panelDevices?.length) {
				return false;
			}

			this.entityIdToHaDevice = new Map();

			haDevices.forEach((device) =>
				device.entities.forEach((entityId) => this.entityIdToHaDevice.set(entityId, device)),
			);

			this.devices = panelDevices;

			return true;
		} catch (error) {
			const err = error as Error;

			this.logger.warn('Failed to initialize mappings, Home Assistant may be unavailable', {
				message: err.message,
			});

			return false;
		}
	}

	/**
	 * Get channels for a device, using cache if available
	 */
	private async getChannelsForDevice(deviceId: string): Promise<HomeAssistantChannelEntity[]> {
		let channels = this.channelsByDeviceId.get(deviceId);

		if (!channels) {
			channels = await this.channelsService.findAll<HomeAssistantChannelEntity>(deviceId, DEVICES_HOME_ASSISTANT_TYPE);
			this.channelsByDeviceId.set(deviceId, channels);
		}

		return channels;
	}

	/**
	 * Get properties for channels, using cache if available
	 */
	private async getPropertiesForChannels(
		channels: HomeAssistantChannelEntity[],
	): Promise<HomeAssistantChannelPropertyEntity[]> {
		const allProperties: HomeAssistantChannelPropertyEntity[] = [];
		const uncachedChannelIds: string[] = [];

		// Collect cached properties and identify uncached channels
		for (const channel of channels) {
			const cached = this.propertiesByChannelId.get(channel.id);
			if (cached) {
				allProperties.push(...cached);
			} else {
				uncachedChannelIds.push(channel.id);
			}
		}

		// Load uncached properties in batch
		if (uncachedChannelIds.length > 0) {
			const newProperties = await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
				uncachedChannelIds,
				DEVICES_HOME_ASSISTANT_TYPE,
			);

			// Group by channel and cache
			for (const channelId of uncachedChannelIds) {
				const channelProps = newProperties.filter((p) => {
					const propChannelId = typeof p.channel === 'string' ? p.channel : p.channel?.id;
					return propChannelId === channelId;
				});
				this.propertiesByChannelId.set(channelId, channelProps);
				allProperties.push(...channelProps);
			}
		}

		return allProperties;
	}
}
