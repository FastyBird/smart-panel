import { instanceToPlain } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ChannelCategory, ConnectionState, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	DEVICES_HOME_ASSISTANT_TYPE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantDiscoveredDeviceDto } from '../dto/home-assistant-discovered-device.dto';
import { HomeAssistantDiscoveredHelperDto } from '../dto/home-assistant-discovered-helper.dto';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { HomeAssistantConfigModel } from '../models/config.model';
import {
	HomeAssistantDiscoveredDeviceModel,
	HomeAssistantDiscoveredHelperModel,
	HomeAssistantStateModel,
} from '../models/home-assistant.model';

import { VirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext } from './virtual-property.types';

// Exclude devices dominated by virtual_device_domains (climate/humidifier/water_heater + their sensors)
// These appear in helpers instead. A device is "virtual" if it has a virtual domain entity and only sensors/binary_sensors otherwise.
const DISCOVERED_DEVICES_TEMPLATE =
	"{% set virtual_device_domains = ['climate', 'humidifier', 'water_heater'] %}{% set auxiliary_domains = ['sensor', 'binary_sensor'] %}{% set devices = states | map(attribute='entity_id') | map('device_id') | unique | reject('eq', None) | list %}{% set ns = namespace(list=[]) %}{% for device in devices %}{% set entities = device_entities(device) | list %}{% if entities %}{% set domains = entities | map('regex_replace', '\\\\..*', '') | list %}{% set has_virtual = domains | select('in', virtual_device_domains) | list | length > 0 %}{% set non_aux_domains = domains | reject('in', virtual_device_domains) | reject('in', auxiliary_domains) | list %}{% set is_pure_virtual = has_virtual and non_aux_domains | length == 0 %}{% if not is_pure_virtual %}{% set ns.list = ns.list + [{'id': device, 'name': device_attr(device, 'name'), 'entities': entities}] %}{% endif %}{% endif %}{% endfor %}{{ ns.list | tojson }}";

const DISCOVERED_DEVICE_TEMPLATE =
	"{% set target_device = device_id %}{% set entities = device_entities(target_device) | list %}{% if entities %}{{ [{'id': target_device, 'name': device_attr(target_device, 'name'), 'entities': entities}] | tojson }}{% else %}{{ [] | tojson }}{% endif %}";

// Template to discover helper entities (entities without device_id or virtual device domains)
// Includes: input_boolean, input_number, input_select, input_text, input_datetime, input_button, timer
// Also includes climate entities without device (e.g., generic_thermostat) and standalone sensors
// Climate/humidifier/water_heater are always included as helpers (they are typically virtual/user-configured)
const DISCOVERED_HELPERS_TEMPLATE =
	"{% set helper_domains = ['input_boolean', 'input_number', 'input_select', 'input_text', 'input_datetime', 'input_button', 'timer', 'climate', 'sensor', 'binary_sensor', 'switch', 'light', 'fan', 'cover', 'lock', 'humidifier', 'water_heater', 'vacuum'] %}{% set virtual_device_domains = ['climate', 'humidifier', 'water_heater'] %}{% set ns = namespace(list=[]) %}{% for state in states %}{% set domain = state.entity_id.split('.')[0] %}{% if domain in helper_domains %}{% set dev_id = device_id(state.entity_id) %}{% if dev_id is none or dev_id == '' or domain in virtual_device_domains %}{% set ns.list = ns.list + [{'entity_id': state.entity_id, 'name': state.attributes.friendly_name | default(state.entity_id), 'domain': domain}] %}{% endif %}{% endif %}{% endfor %}{{ ns.list | tojson }}";

@Injectable()
export class HomeAssistantHttpService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HomeAssistantHttpService',
	);

	private pluginConfig: HomeAssistantConfigModel | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly homeAssistantMapperService: MapperService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly virtualPropertyService: VirtualPropertyService,
	) {}

	async getDiscoveredDevice(id: string): Promise<HomeAssistantDiscoveredDeviceModel> {
		this.ensureApiKey();

		try {
			this.logger.debug('Fetching single Home Assistant discovered device');

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

			this.logger.error('Failed to fetch Home Assistant discovered device detail', {
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
			this.logger.debug('Fetching all Home Assistant discovered devices list');

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

			this.logger.error('Failed to fetch Home Assistant discovered devices list', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant discovered devices list could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant discovered devices list could not be loaded');
	}

	async getDiscoveredHelper(entityId: string): Promise<HomeAssistantDiscoveredHelperModel> {
		this.ensureApiKey();

		try {
			this.logger.debug(`Fetching Home Assistant discovered helper: ${entityId}`);

			const [helpers, states] = await Promise.all([this.fetchListHaHelpers(), this.fetchListHaStates()]);

			if (helpers && states) {
				const panelDevices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);

				const helper = helpers.find((h) => h.entity_id === entityId);
				if (!helper) {
					throw new DevicesHomeAssistantNotFoundException(`Home Assistant helper with entity_id ${entityId} not found`);
				}

				const helperModel = this.toDiscoveredHelperModel(helper);

				// Check if this helper is already adopted (entity_id is stored as ha_device_id)
				helperModel.adoptedDeviceId =
					panelDevices.find((panelDevice) => panelDevice.haDeviceId === entityId)?.id ?? null;

				// Attach state
				const state = states.find((s) => s.entity_id === entityId);
				if (state) {
					helperModel.state = this.toStateModel(state);
				}

				return helperModel;
			}
		} catch (error) {
			if (error instanceof DevicesHomeAssistantNotFoundException) {
				throw error;
			}

			const err = error as Error;

			this.logger.error('Failed to fetch Home Assistant discovered helper detail', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant discovered helper detail could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant discovered helper detail could not be loaded');
	}

	async getDiscoveredHelpers(): Promise<HomeAssistantDiscoveredHelperModel[]> {
		this.ensureApiKey();

		try {
			this.logger.debug('Fetching all Home Assistant discovered helpers list');

			const [helpers, states] = await Promise.all([this.fetchListHaHelpers(), this.fetchListHaStates()]);

			if (helpers && states) {
				const panelDevices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);

				return helpers.map((helper) => {
					const helperModel = this.toDiscoveredHelperModel(helper);

					// Check if this helper is already adopted (entity_id is stored as ha_device_id)
					helperModel.adoptedDeviceId =
						panelDevices.find((panelDevice) => panelDevice.haDeviceId === helper.entity_id)?.id ?? null;

					// Attach state
					const state = states.find((s) => s.entity_id === helper.entity_id);
					if (state) {
						helperModel.state = this.toStateModel(state);
					}

					return helperModel;
				});
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to fetch Home Assistant discovered helpers list', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant discovered helpers list could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException('Home Assistant discovered helpers list could not be loaded');
	}

	async getState(entityId: string): Promise<HomeAssistantStateModel> {
		this.ensureApiKey();

		try {
			this.logger.debug('Fetching all Home Assistant discovered devices list');

			const state = await this.fetchSingleHaState(entityId);

			if (state) {
				return this.toStateModel(state);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to get Home Assistant entity state', {
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
			this.logger.debug('Fetching all Home Assistant entities states list');

			const states = await this.fetchListHaStates();

			if (states) {
				return states.map((state) => this.toStateModel(state));
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to fetch Home Assistant entities states list', {
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
		if (this.apiKey === null || this.enabled !== true) {
			return;
		}

		try {
			this.logger.debug('Automatic fetch of all Home Assistant entities states list');

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
				this.logger.debug('Missing data, skipping automatic sync');

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

				for (const entries of resultMaps) {
					for (const { property, value } of entries) {
						await this.channelsPropertiesService.update(
							property.id,
							toInstance(UpdateHomeAssistantChannelPropertyDto, {
								...instanceToPlain(property),
								value,
							}),
						);
					}
				}

				// Update virtual property values for this device
				const deviceProperties = properties.filter(
					(p) =>
						p.channel instanceof HomeAssistantChannelEntity &&
						p.channel.device instanceof HomeAssistantDeviceEntity &&
						p.channel.device.id === device.id,
				);

				await this.updateVirtualPropertyValues(deviceProperties, haDeviceStates);

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

					await this.deviceConnectivityService.setConnectionState(device.id, {
						state: isOffline ? ConnectionState.DISCONNECTED : ConnectionState.CONNECTED,
					});

					this.logger.debug(
						`Device ${device.name} (${device.id}) marked as ${isOffline ? 'DISCONNECTED' : 'CONNECTED'}`,
						{ resource: device.id },
					);
				}
			}

			this.logger.debug('Automatic fetch of all Home Assistant entities states list completed');
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to automated fetch of Home Assistant entities states list', {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	/**
	 * Sync states for a specific device from Home Assistant
	 * This is called after device adoption to immediately populate property values
	 */
	async syncDeviceStates(deviceId: string): Promise<void> {
		if (this.apiKey === null || this.enabled !== true) {
			this.logger.debug(`[SYNC] Skipping sync for device ${deviceId} - HA not configured`, { resource: deviceId });
			return;
		}

		try {
			this.logger.debug(`[SYNC] Syncing states for device ${deviceId}`, { resource: deviceId });

			// Load the device
			const device = await this.devicesService.findOne<HomeAssistantDeviceEntity>(
				deviceId,
				DEVICES_HOME_ASSISTANT_TYPE,
			);

			if (!device) {
				this.logger.warn(`[SYNC] Device ${deviceId} not found`, { resource: deviceId });
				return;
			}

			// Fetch HA device info and states
			const [haDevices, states] = await Promise.all([this.fetchListHaDevices(), this.fetchListHaStates()]);

			if (!haDevices?.length || !states?.length) {
				this.logger.debug(`[SYNC] Missing HA data for device ${deviceId}`, { resource: deviceId });
				return;
			}

			// Find the HA device
			const haDevice = haDevices.find((d) => d.id === device.haDeviceId);
			if (!haDevice) {
				this.logger.warn(`[SYNC] HA device ${device.haDeviceId} not found in registry`, { resource: deviceId });
				return;
			}

			// Get states for this device's entities
			const deviceStates = states.filter((s) => haDevice.entities.includes(s.entity_id));

			if (!deviceStates.length) {
				this.logger.debug(`[SYNC] No states found for device ${deviceId}`, { resource: deviceId });
				return;
			}

			// Load device properties
			const properties = await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
				undefined,
				DEVICES_HOME_ASSISTANT_TYPE,
			);

			const deviceProperties = properties.filter(
				(p) =>
					p.channel instanceof HomeAssistantChannelEntity &&
					p.channel.device instanceof HomeAssistantDeviceEntity &&
					p.channel.device.id === deviceId,
			);

			if (!deviceProperties.length) {
				this.logger.debug(`[SYNC] No properties found for device ${deviceId}`, { resource: deviceId });
				return;
			}

			// Map HA states to property values
			const resultMaps = await this.homeAssistantMapperService.mapFromHA(device, deviceStates);

			for (const entries of resultMaps) {
				for (const { property, value } of entries) {
					await this.channelsPropertiesService.update(
						property.id,
						toInstance(UpdateHomeAssistantChannelPropertyDto, {
							...instanceToPlain(property),
							value,
						}),
					);
				}
			}

			// Update virtual property values
			await this.updateVirtualPropertyValues(deviceProperties, deviceStates);

			// Update device connection state
			const isOffline = deviceStates.every(
				(state) => typeof state.state === 'string' && state.state.toLowerCase() === 'unavailable',
			);

			await this.deviceConnectivityService.setConnectionState(deviceId, {
				state: isOffline ? ConnectionState.DISCONNECTED : ConnectionState.CONNECTED,
			});

			this.logger.debug(
				`[SYNC] Device ${device.name} (${deviceId}) sync completed, marked as ${isOffline ? 'DISCONNECTED' : 'CONNECTED'}`,
				{ resource: deviceId },
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[SYNC] Failed to sync states for device ${deviceId}`, {
				resource: deviceId,
				message: err.message,
				stack: err.stack,
			});
		}
	}

	/**
	 * Mark all Home Assistant devices as disconnected
	 * Called when the HA WebSocket connection is lost or service stops
	 */
	async markAllDevicesDisconnected(): Promise<void> {
		try {
			const devices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);

			this.logger.debug(`[CONNECTIVITY] Marking ${devices.length} HA devices as disconnected`);

			for (const device of devices) {
				try {
					await this.deviceConnectivityService.setConnectionState(device.id, {
						state: ConnectionState.DISCONNECTED,
					});
				} catch (error) {
					const err = error as Error;

					this.logger.warn(`[CONNECTIVITY] Failed to mark device ${device.id} as disconnected`, {
						resource: device.id,
						message: err.message,
					});
				}
			}

			this.logger.debug('[CONNECTIVITY] All HA devices marked as disconnected');
		} catch (error) {
			const err = error as Error;

			this.logger.error('[CONNECTIVITY] Failed to mark devices as disconnected', {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	/**
	 * Mark all Home Assistant devices as connected
	 * Called when the HA WebSocket connection is established
	 */
	async markAllDevicesConnected(): Promise<void> {
		try {
			const devices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);

			this.logger.debug(`[CONNECTIVITY] Marking ${devices.length} HA devices as connected`);

			for (const device of devices) {
				try {
					await this.deviceConnectivityService.setConnectionState(device.id, {
						state: ConnectionState.CONNECTED,
					});
				} catch (error) {
					const err = error as Error;

					this.logger.warn(`[CONNECTIVITY] Failed to mark device ${device.id} as connected`, {
						resource: device.id,
						message: err.message,
					});
				}
			}

			this.logger.debug('[CONNECTIVITY] All HA devices marked as connected');
		} catch (error) {
			const err = error as Error;

			this.logger.error('[CONNECTIVITY] Failed to mark devices as connected', {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	/**
	 * Update virtual property values based on source properties
	 * This recalculates derived values like battery status from percentage
	 */
	private async updateVirtualPropertyValues(
		properties: HomeAssistantChannelPropertyEntity[],
		states: HomeAssistantStateDto[],
	): Promise<void> {
		// Group properties by channel
		const channelProperties = new Map<string, HomeAssistantChannelPropertyEntity[]>();
		const channelEntities = new Map<string, HomeAssistantChannelEntity>();

		for (const property of properties) {
			if (!(property.channel instanceof HomeAssistantChannelEntity)) {
				continue;
			}

			const channelId = property.channel.id;

			if (!channelProperties.has(channelId)) {
				channelProperties.set(channelId, []);
				channelEntities.set(channelId, property.channel);
			}

			channelProperties.get(channelId).push(property);
		}

		// Process each channel's virtual properties
		for (const [channelId, props] of channelProperties) {
			const channel = channelEntities.get(channelId);
			const virtualDefs = this.virtualPropertyService.getVirtualPropertiesForChannel(channel.category);

			// Skip channels without virtual property definitions
			if (virtualDefs.length === 0) {
				continue;
			}

			// Find virtual properties (have fb.virtual. attribute prefix)
			const virtualProps = props.filter((p) => p.haAttribute?.startsWith('fb.virtual.'));

			if (virtualProps.length === 0) {
				continue;
			}

			// Find an entity state to use for context
			const entityIds = props.filter((p) => p.haEntityId).map((p) => p.haEntityId);
			const state = states.find((s) => entityIds.includes(s.entity_id));

			// Build context for virtual property resolution
			const context: VirtualPropertyContext = {
				entityId: entityIds[0] ?? '',
				domain: (entityIds[0]?.split('.')[0] ?? '') as HomeAssistantDomain,
				deviceClass: (state?.attributes?.device_class as string) ?? null,
				state: state
					? {
							entityId: state.entity_id,
							state: state.state,
							attributes: state.attributes,
							lastChanged: state.last_changed,
							lastReported: state.last_reported,
							lastUpdated: state.last_updated,
						}
					: undefined,
				allStates: states.map((s) => ({
					entityId: s.entity_id,
					state: s.state,
					attributes: s.attributes,
					lastChanged: s.last_changed,
					lastReported: s.last_reported,
					lastUpdated: s.last_updated,
				})),
			};

			// Update each virtual property
			for (const virtualProp of virtualProps) {
				const virtualDef = virtualDefs.find((vd) => vd.propertyCategory === virtualProp.category);

				if (!virtualDef) {
					continue;
				}

				// Skip command properties - they don't have readable values
				if (virtualDef.virtualType === 'command') {
					continue;
				}

				// Resolve the virtual property value
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
						`[SYNC] Updated virtual property ${virtualProp.category} = ${String(resolved.value)} for channel ${channel.category}`,
					);
				}
			}
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

	private get enabled(): boolean {
		return this.config.enabled === true;
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
			this.logger.warn('Missing API key for Home Assistant HTTP service');

			throw new DevicesHomeAssistantValidationException('Api key is required');
		}
	}

	private toDiscoveredDeviceModel(dto: HomeAssistantDiscoveredDeviceDto): HomeAssistantDiscoveredDeviceModel {
		return toInstance(
			HomeAssistantDiscoveredDeviceModel,
			{
				id: dto.id,
				name: dto.name,
				entities: dto.entities,
				states: [],
				adoptedDeviceId: null,
			},
			{
				excludeExtraneousValues: false,
			},
		);
	}

	private toStateModel(dto: HomeAssistantStateDto): HomeAssistantStateModel {
		return toInstance(
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
				excludeExtraneousValues: false,
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
				this.logger.error('Home Assistant API template request failed', { response: data });

				return null;
			}

			const devices = toInstance(HomeAssistantDiscoveredDeviceDto, data as object[], {
				excludeExtraneousValues: false,
			});

			const errors = await Promise.all(
				devices.map((device) => validate(device, { whitelist: true, forbidNonWhitelisted: true })),
			);

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`Home Assistant device response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			if (devices.length === 0) {
				return null;
			}

			return devices[0];
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to fetch devices list', {
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
				this.logger.error('Home Assistant API template request failed', { response: data });

				return null;
			}

			const devices = toInstance(HomeAssistantDiscoveredDeviceDto, data as object[], {
				excludeExtraneousValues: false,
			});

			const errors = await Promise.all(
				devices.map((device) => validate(device, { whitelist: true, forbidNonWhitelisted: true })),
			);

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`Home Assistant devices response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return devices;
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to fetch devices list', {
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
				this.logger.error('Home Assistant state API request failed', { response: data });

				return null;
			}

			const state = toInstance(HomeAssistantStateDto, data as object, {
				excludeExtraneousValues: false,
			});

			const errors = await validate(state);

			if (errors.length) {
				this.logger.error(`Home Assistant states response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return state;
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to fetch states list', {
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
				this.logger.error('Home Assistant states API request failed', { response: data });

				return null;
			}

			const states = toInstance(HomeAssistantStateDto, data as object[], {
				excludeExtraneousValues: false,
			});

			const errors = await Promise.all(
				states.map((state) => validate(state, { whitelist: true, forbidNonWhitelisted: true })),
			);

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`Home Assistant states response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return states;
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to fetch states list', {
				message: err.message,
				stack: err.stack,
			});

			return null;
		}
	}

	private async fetchListHaHelpers(): Promise<HomeAssistantDiscoveredHelperDto[] | null> {
		try {
			const url = new URL('/api/template', this.baseUrl);

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					template: DISCOVERED_HELPERS_TEMPLATE,
				}),
			});

			const data = (await response.json()) as unknown;

			if (!response.ok || response.status !== 200) {
				this.logger.error('Home Assistant API template request failed', { response: data });

				return null;
			}

			const helpers = toInstance(HomeAssistantDiscoveredHelperDto, data as object[], {
				excludeExtraneousValues: false,
			});

			const errors = await Promise.all(
				helpers.map((helper) => validate(helper, { whitelist: true, forbidNonWhitelisted: true })),
			);

			if (errors.some((e) => e.length > 0)) {
				this.logger.error(`Home Assistant helpers response validation failed error=${JSON.stringify(errors)}`);

				return null;
			}

			return helpers;
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to fetch helpers list', {
				message: err.message,
				stack: err.stack,
			});

			return null;
		}
	}

	private toDiscoveredHelperModel(dto: HomeAssistantDiscoveredHelperDto): HomeAssistantDiscoveredHelperModel {
		return toInstance(
			HomeAssistantDiscoveredHelperModel,
			{
				entityId: dto.entity_id,
				name: dto.name,
				domain: dto.domain,
				adoptedDeviceId: null,
				state: null,
			},
			{
				excludeExtraneousValues: false,
			},
		);
	}
}
