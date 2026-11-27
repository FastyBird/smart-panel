import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
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
import { HomeAssistantStateChangedEventDto, HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { isHaEntityId, normalizeHaEventType } from '../utils/ha-event.utils';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { HomeAssistantEventIngress, HomeAssistantRegistryChange, WsEventService } from './home-assistant.ws.service';
import { VirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext } from './virtual-property.types';

const DISCOVERY_RETRY_MS = 5_000;

/** Normalized main-state value of the physical entities supported by this reporter. */
function physicalMainValue(state?: HomeAssistantStateDto | null): number | boolean | null {
	if (typeof state?.entity_id !== 'string' || typeof state.state !== 'string') return null;
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

type LocalBinding = {
	id?: string;
	type?: string;
	haDeviceId?: string;
	haEntityId?: string | null;
	device?: { id: string } | string;
	channel?: { id: string; device?: { id: string } | string } | string;
};

interface EntityStateWork {
	generation: number;
	timer?: NodeJS.Timeout;
	tail?: Promise<void>;
}

@Injectable()
export class StateChangedEventService implements WsEventService, OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'StateChangedEventService',
	);

	private mappingLoad: Promise<Map<string, HomeAssistantDeviceEntity> | null> | null = null;
	private discoveryRequest?: AbortController;
	private nextDiscoveryAt = 0;
	private wakeDiscovery?: () => void;
	private readonly changedEntityIds = new Set<string>();
	private missingDevices = new Set<string>();
	private mappingsReady = false;
	private mappingRevision = 0;
	private bindingGeneration = 0;
	private reportSession: string | null = null;
	private readonly sourceEpochs = new Map<string, { readonly value: number | boolean; readonly changedAt: number }>();
	private entityDevices = new Map<string, HomeAssistantDeviceEntity>();
	private readonly propertyEntities = new Map<string, string>();
	// A device change can arrive while discovery is still resolving a pending entity's owner.
	private readonly deviceRevisions = new Map<string, number>();

	private readonly entityWork = new Map<string, EntityStateWork>();
	private destroyed = false;

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

	// Structural changes invalidate mappings and work received against them.
	// Value-only updates emit CHANNEL_PROPERTY_VALUE_SET and keep the current mapping.
	@OnEvent(DevicesModuleEventType.DEVICE_CREATED)
	@OnEvent(DevicesModuleEventType.DEVICE_UPDATED)
	@OnEvent(DevicesModuleEventType.DEVICE_DELETED)
	@OnEvent(DevicesModuleEventType.CHANNEL_CREATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_UPDATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_DELETED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(DevicesModuleEventType.CHANNEL_PROPERTY_DELETED)
	handleDevicesUpdatedEvent(entity?: LocalBinding): void {
		if (entity?.type && entity.type !== DEVICES_HOME_ASSISTANT_TYPE) return;
		const current = entity?.haEntityId;
		const previous = this.propertyEntities.get(entity?.id);
		const channel = typeof entity?.channel === 'object' ? entity.channel : null;
		const parent = entity?.device ?? channel?.device;
		let panelDeviceId = typeof parent === 'string' ? parent : parent?.id;
		if (!panelDeviceId && entity?.channel) {
			const channelId = typeof entity.channel === 'string' ? entity.channel : entity.channel.id;
			for (const [id, channels] of this.channelsByDeviceId) {
				if (channels.some((item) => item.id === channelId)) {
					panelDeviceId = id;
					break;
				}
			}
		}
		const entityIds = [previous, current].filter(isHaEntityId);
		if (entity?.haDeviceId) this.invalidateBindings({ deviceId: entity.haDeviceId }, entity.id);
		else if (entityIds.length) this.invalidateBindings({ entityIds }, previous ? undefined : panelDeviceId);
		else if (panelDeviceId) this.invalidateBindings({}, panelDeviceId);
		else this.invalidateBindings(null);
	}

	handleRegistryChange(change: HomeAssistantRegistryChange | null): void {
		this.invalidateBindings(change);
	}

	private invalidateBindings(change: HomeAssistantRegistryChange | null, panelDeviceId?: string): void {
		this.mappingRevision++;
		this.mappingsReady = false;
		this.discoveryRequest?.abort();
		this.mappingLoad = null;
		if (change?.deviceId) this.deviceRevisions.set(change.deviceId, this.mappingRevision);
		if (panelDeviceId) this.deviceRevisions.set(panelDeviceId, this.mappingRevision);
		const affected = new Set(change?.entityIds);
		if (isHaEntityId(change?.deviceId)) affected.add(change.deviceId);
		for (const [id, device] of this.entityDevices) {
			if (device.id === panelDeviceId || device.haDeviceId === change?.deviceId) affected.add(id);
		}
		if (!change || panelDeviceId || (change.deviceId && this.missingDevices.has(change.deviceId))) {
			this.allowDiscoveryNow();
		} else if (performance.now() < this.nextDiscoveryAt) {
			// A named registry change can expedite its own next state event without lifting
			// the retry limit for unrelated entities on the socket.
			for (const id of affected) this.changedEntityIds.add(id);
		}
		if (!change) {
			this.bindingGeneration++;
			this.missingDevices.clear();
			this.deviceRevisions.clear();
		}
		this.retireBindings(change ? affected : undefined);
		// A request already reading unchanged metadata can finish for its original entity.
		// Replacing these maps keeps an old read from filling the refreshed cache.
		this.channelsByDeviceId = new Map();
		this.propertiesByChannelId = new Map();
	}

	private retireBindings(affected?: Set<string>): void {
		if (affected) {
			for (const id of affected) {
				this.sourceEpochs.delete(id);
				this.entityDevices.delete(id);
			}
			for (const [propertyId, id] of this.propertyEntities) {
				if (affected.has(id)) this.propertyEntities.delete(propertyId);
			}
		} else {
			this.entityDevices.clear();
			this.sourceEpochs.clear();
			this.propertyEntities.clear();
		}
		for (const [id, work] of this.entityWork) {
			if (affected && !affected.has(id)) continue;
			work.generation++;
			clearTimeout(work.timer);
			work.timer = undefined;
			if (work.tail === undefined) this.entityWork.delete(id);
		}
	}

	async onModuleDestroy(): Promise<void> {
		this.destroyed = true;
		this.handleDevicesUpdatedEvent();
		await Promise.all(Array.from(this.entityWork.values(), (work) => work.tail));
	}

	get event(): string {
		return 'state_changed';
	}

	async handle(event: HomeAssistantStateChangedEventDto, ingress?: HomeAssistantEventIngress): Promise<void> {
		if (this.destroyed || (ingress && !ingress.isCurrent())) return;
		if (ingress && this.reportSession !== ingress.session) {
			this.handleDevicesUpdatedEvent();
			this.reportSession = ingress.session;
		}
		const state = event.data.new_state;
		const old = event.data.old_state;
		const entityId = state?.entity_id ?? old?.entity_id;
		if (!entityId) return;
		const physicalValue = physicalMainValue(state);
		const measured =
			physicalValue !== null &&
			!state.attributes?.assumed_state &&
			!state.attributes?.restored &&
			!state.attributes?.optimistic;
		const work: EntityStateWork = this.entityWork.get(entityId) ?? { generation: 0 };
		clearTimeout(work.timer);
		work.timer = undefined;
		if (!state) {
			this.sourceEpochs.delete(entityId);
			work.generation++;
			if (work.tail === undefined) this.entityWork.delete(entityId);
			return;
		}
		this.entityWork.set(entityId, work);

		const revision = this.mappingRevision;
		const generation = this.bindingGeneration;
		const changedAt = state.last_changed;
		// HA last_updated and last_reported can advance for attributes alone. Only a change of
		// the adopted entity's own main state carries a new measurement at last_changed.
		const prior = this.sourceEpochs.get(entityId);
		const oldValue = physicalMainValue(old);
		const priorKnown =
			old?.entity_id === entityId &&
			oldValue !== null &&
			!old.attributes?.restored &&
			!old.attributes?.assumed_state &&
			!old.attributes?.optimistic;
		const transition =
			measured &&
			priorKnown &&
			oldValue !== physicalValue &&
			independentContext(state.context) &&
			independentContext(event.context) &&
			ingress &&
			changedAt instanceof Date &&
			Number.isFinite(changedAt.getTime()) &&
			changedAt <= ingress.receivedAt &&
			old.last_changed instanceof Date &&
			changedAt > old.last_changed &&
			(!prior || changedAt.getTime() > prior.changedAt);
		if (transition) {
			// Revoke the previous observation at intake, even if mapping this transition later fails.
			this.sourceEpochs.set(entityId, { value: physicalValue, changedAt: changedAt.getTime() });
			work.generation++;
		} else if (!measured || !priorKnown || prior?.value !== physicalValue) {
			// Recovery and contradictory reports with unusable timing are still ordinary state.
			this.sourceEpochs.delete(entityId);
		}
		const epoch = this.sourceEpochs.get(entityId);
		const entityGeneration = work.generation;
		const isCurrent = (): boolean =>
			this.bindingGeneration === generation &&
			work.generation === entityGeneration &&
			(!ingress || ingress.isCurrent());

		const hardwareEvent = entityId.startsWith('event.');
		const process = async (): Promise<void> => {
			if (!isCurrent()) return;
			const device = await this.findAdoptedDevice(entityId, isCurrent);
			if (!isCurrent()) return;
			const panelId = device?.id;
			const remoteId = device?.haDeviceId;
			const ownerIsCurrent = (): boolean => {
				const current = this.entityDevices.get(entityId);
				return (
					!!device &&
					!!current &&
					current.id === panelId &&
					current.haDeviceId === remoteId &&
					(this.deviceRevisions.get(panelId) ?? 0) <= revision &&
					(this.deviceRevisions.get(remoteId) ?? 0) <= revision
				);
			};
			if (!ownerIsCurrent()) {
				if (this.sourceEpochs.get(entityId) === epoch) this.sourceEpochs.delete(entityId);
				return;
			}
			const sourceIsCurrent = (): boolean =>
				!!epoch &&
				!!ingress?.isCurrent() &&
				this.bindingGeneration === generation &&
				this.sourceEpochs.get(entityId) === epoch &&
				ownerIsCurrent();

			if (hardwareEvent) {
				await this.handleHardwareEventEntity(event, device, isCurrent);
				return;
			}

			const resultMaps = await this.homeAssistantMapperService.mapFromHA(device, [state]);
			for (const entries of resultMaps) {
				for (const { property, value } of entries) {
					if (!isCurrent()) return;
					if (property.haEntityId === entityId) this.propertyEntities.set(property.id, entityId);
					const update = toInstance(UpdateHomeAssistantChannelPropertyDto, {
						type: DEVICES_HOME_ASSISTANT_TYPE,
						value,
					});
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
			if (isCurrent()) await this.updateVirtualPropertiesForEntity(device.id, entityId, state, isCurrent);
		};
		// Claim the entity's place before any asynchronous lookup or mapping. A newer
		// transition can cancel a pending presentation, including one waiting in the queue.
		if (transition || hardwareEvent) {
			await this.enqueue(entityId, work, process);
			return;
		}
		const timer = setTimeout(() => {
			void this.enqueue(entityId, work, async () => {
				if (work.timer !== timer) return;
				work.timer = undefined;
				await process();
			});
		}, 500);
		work.timer = timer;
	}

	private enqueue(entityId: string, work: EntityStateWork, process: () => Promise<void>): Promise<void> {
		const result = (work.tail ?? Promise.resolve())
			.then(process)
			.catch((error: unknown) =>
				this.logger.warn('Failed to process Home Assistant state', {
					message: error instanceof Error ? error.message : 'unknown error',
				}),
			)
			.finally(() => {
				if (work.tail !== result) return;
				work.tail = undefined;
				if (!work.timer) this.entityWork.delete(entityId);
			});
		work.tail = result;
		return result;
	}

	/**
	 * Handles Home Assistant event.* entities, publishing hardware input occurrences
	 * independently of property state and without debounce delay.
	 */
	private async handleHardwareEventEntity(
		event: HomeAssistantStateChangedEventDto,
		device: HomeAssistantDeviceEntity,
		isCurrent: () => boolean,
	): Promise<void> {
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

		const channels = await this.getChannelsForDevice(device.id);
		if (!isCurrent()) return;
		const properties = await this.getPropertiesForChannels(channels);
		if (!isCurrent()) return;

		// Find property mapped to this entityId with EVENT category
		const eventProp = properties.find((p) => p.haEntityId === entityId && p.category === PropertyCategory.EVENT);

		if (!eventProp) {
			this.logger.debug(`[HARDWARE EVENT] No EVENT property mapped to ${entityId} on device ${device.id}`);
			return;
		}

		this.propertyEntities.set(eventProp.id, entityId);
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
		isCurrent: () => boolean,
	): Promise<void> {
		// Get channels from cache or load and cache them
		const channels = await this.getChannelsForDevice(deviceId);

		if (!isCurrent() || channels.length === 0) {
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
				if (!isCurrent()) return;
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

	private allowDiscoveryNow(): void {
		this.nextDiscoveryAt = 0;
		this.changedEntityIds.clear();
		this.wakeDiscovery?.();
	}

	private waitForDiscovery(signal: AbortSignal): Promise<void> {
		const remaining = Math.ceil(this.nextDiscoveryAt - performance.now());
		if (remaining <= 0 || signal.aborted) return Promise.resolve();
		return new Promise((resolve) => {
			const wake = () => {
				clearTimeout(timer);
				signal.removeEventListener('abort', wake);
				if (this.wakeDiscovery === wake) this.wakeDiscovery = undefined;
				resolve();
			};
			const timer = setTimeout(wake, remaining);
			this.wakeDiscovery = wake;
			signal.addEventListener('abort', wake, { once: true });
		});
	}

	private async findAdoptedDevice(
		entityId: string,
		isCurrent: () => boolean,
	): Promise<HomeAssistantDeviceEntity | undefined> {
		while (isCurrent()) {
			const cached = this.entityDevices.get(entityId);
			if (cached || this.mappingsReady) return cached;
			if (this.changedEntityIds.has(entityId)) this.allowDiscoveryNow();
			const revision = this.mappingRevision;
			if (this.mappingLoad === null) {
				const request = new AbortController();
				this.discoveryRequest = request;
				const load = this.loadMappings(revision, request.signal).finally(() => {
					if (this.mappingLoad === load) {
						this.mappingLoad = null;
						this.discoveryRequest = undefined;
					}
				});
				this.mappingLoad = load;
			}
			const routes = await this.mappingLoad;
			if (this.mappingRevision === revision) return routes?.get(entityId);
		}
	}

	private async loadMappings(
		revision: number,
		signal: AbortSignal,
	): Promise<Map<string, HomeAssistantDeviceEntity> | null> {
		const routes = new Map<string, HomeAssistantDeviceEntity>();
		const missingDevices = new Set<string>();
		try {
			await this.waitForDiscovery(signal);
			if (signal.aborted) return null;
			this.changedEntityIds.clear();
			if (this.nextDiscoveryAt > 0) this.nextDiscoveryAt = performance.now() + DISCOVERY_RETRY_MS;
			const panelDevices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);
			if (signal.aborted) return null;
			const bySource = new Map(panelDevices.map((device) => [device.haDeviceId, device]));
			for (const [id, device] of bySource) {
				if (isHaEntityId(id)) routes.set(id, device);
				else missingDevices.add(id);
			}
			if (missingDevices.size) {
				const devices = await this.homeAssistantHttpService.getDiscoveredDevices(signal);
				const reportedDevices = new Set(devices.map((device) => device.id));
				for (const remote of devices) {
					const adopted = bySource.get(remote.id);
					if (!adopted) continue;
					for (const id of remote.entities) {
						if (!isHaEntityId(id)) continue;
						routes.set(id, adopted);
						missingDevices.delete(remote.id);
					}
				}
				// One incomplete inventory can omit a device that an earlier inventory resolved.
				// Keep its known entities only while the original local adoption still owns them.
				for (const [id, cached] of this.entityDevices) {
					const adopted = bySource.get(cached.haDeviceId);
					if (adopted?.id === cached.id && !reportedDevices.has(cached.haDeviceId) && !routes.has(id))
						routes.set(id, adopted);
				}
			}
			if (revision !== this.mappingRevision) return null;
			this.installRoutes(routes);
			this.missingDevices = missingDevices;
			this.mappingsReady = missingDevices.size === 0;
			this.nextDiscoveryAt = this.mappingsReady ? 0 : performance.now() + DISCOVERY_RETRY_MS;
			return routes;
		} catch (error) {
			if (signal.aborted || revision !== this.mappingRevision) return null;
			this.logger.warn('Failed to initialize mappings, Home Assistant may be unavailable', {
				message: error instanceof Error ? error.message : 'unknown error',
			});
			// Local helper adoptions are already authoritative. Retry discovery for registry-backed devices.
			this.installRoutes(new Map([...this.entityDevices, ...routes]));
			this.missingDevices = missingDevices;
			this.nextDiscoveryAt = performance.now() + DISCOVERY_RETRY_MS;
			return routes;
		}
	}

	private installRoutes(routes: Map<string, HomeAssistantDeviceEntity>): void {
		const retired = new Set<string>();
		for (const [id, previous] of this.entityDevices) {
			const current = routes.get(id);
			if (
				!current ||
				current.id !== previous.id ||
				current.haDeviceId !== previous.haDeviceId ||
				current.enabled !== previous.enabled
			)
				retired.add(id);
		}
		// Retire the old lifetime permanently, including when the same IDs are later re-adopted.
		if (retired.size) this.retireBindings(retired);
		this.entityDevices = routes;
	}

	/**
	 * Get channels for a device, using cache if available
	 */
	private async getChannelsForDevice(deviceId: string): Promise<HomeAssistantChannelEntity[]> {
		let channels = this.channelsByDeviceId.get(deviceId);

		if (!channels) {
			const cache = this.channelsByDeviceId;
			channels = await this.channelsService.findAll<HomeAssistantChannelEntity>(deviceId, DEVICES_HOME_ASSISTANT_TYPE);
			cache.set(deviceId, channels);
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
			const cache = this.propertiesByChannelId;
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
				cache.set(channelId, channelProps);
				allProperties.push(...channelProps);
			}
		}

		return allProperties;
	}
}
