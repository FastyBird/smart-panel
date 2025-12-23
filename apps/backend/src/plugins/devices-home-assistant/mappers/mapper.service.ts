import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	DEVICES_HOME_ASSISTANT_TYPE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { VirtualPropertyService } from '../services/virtual-property.service';

import { IEntityMapper } from './entity.mapper';
import { UniversalEntityMapperService } from './universal.entity.mapper.service';

const VIRTUAL_ATTRIBUTE_PREFIX = 'fb.virtual.';

type MappedToHa = {
	domain: string;
	state: string;
	service: string;
	entityId: string;
	attributes?: Map<string, string | number | number[] | boolean | null>;
	properties: HomeAssistantChannelPropertyEntity[];
};

type MappedFromHa = Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>;

@Injectable()
export class MapperService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'MapperService',
	);

	private readonly mappers = new Map<HomeAssistantDomain, IEntityMapper>();

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly universalEntityMapperService: UniversalEntityMapperService,
		private readonly virtualPropertyService: VirtualPropertyService,
	) {}

	registerMapper(mapper: IEntityMapper): void {
		this.mappers.set(mapper.domain, mapper);
	}

	async mapFromHA(device: HomeAssistantDeviceEntity, states: HomeAssistantStateDto[]): Promise<MappedFromHa[]> {
		const grouped = this.groupProperties(await this.getReadableProperties(await this.getChannels(device)));

		const updates: MappedFromHa[] = [];

		for (const state of states) {
			const domain = this.getDomain(state.entity_id);

			const properties = grouped.get(state.entity_id);

			if (!properties) {
				this.logger.debug(`No properties found for received state for domain=${domain} entityId=${state.entity_id}`);

				continue;
			}

			const mapper = this.mappers.get(domain);

			const primary = mapper ? await mapper.mapFromHA(properties, state) : new Map();

			const secondary = await this.universalEntityMapperService.mapFromHA(properties, state);

			const result = new Map<string, string | number | boolean | null>(primary);

			for (const [key, value] of secondary.entries()) {
				if (!result.has(key)) {
					result.set(key, value);
				}
			}

			if (result.size > 0) {
				updates.push(result);
			}
		}

		return updates;
	}

	async mapToHA(
		device: HomeAssistantDeviceEntity,
		values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
	): Promise<MappedToHa[]> {
		const channels = await this.getChannels(device);
		const allWritableProperties = await this.getWritableProperties(channels);

		// Separate virtual command properties from regular properties
		const virtualCommandProps: HomeAssistantChannelPropertyEntity[] = [];
		const regularProps: HomeAssistantChannelPropertyEntity[] = [];

		for (const prop of allWritableProperties) {
			if (this.isVirtualProperty(prop)) {
				virtualCommandProps.push(prop);
			} else {
				regularProps.push(prop);
			}
		}

		const updates: MappedToHa[] = [];

		// Handle regular properties through standard mappers
		const grouped = this.groupProperties(regularProps);

		for (const [entityId, properties] of grouped.entries()) {
			const domain = this.getDomain(entityId);

			const mapper = this.mappers.get(domain);

			if (!mapper) {
				this.logger.warn(`No mapper found for domain=${domain}`);

				continue;
			}

			const mapped = await mapper.mapToHA(properties, values);

			if (mapped === null) {
				continue;
			}

			const result = { domain, entityId, ...mapped, properties };

			updates.push(result);
		}

		// Handle virtual command properties
		const virtualUpdates = this.handleVirtualCommandProperties(virtualCommandProps, values, channels);
		updates.push(...virtualUpdates);

		return updates;
	}

	/**
	 * Handle virtual command properties by translating them to HA service calls
	 */
	private handleVirtualCommandProperties(
		properties: HomeAssistantChannelPropertyEntity[],
		values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
		channels: HomeAssistantChannelEntity[],
	): MappedToHa[] {
		const updates: MappedToHa[] = [];

		// Build a map from channel ID to channel for quick lookup
		// Properties have a channel field (either string ID or ChannelEntity) that we can use
		const channelMap = new Map<string, HomeAssistantChannelEntity>();
		for (const channel of channels) {
			channelMap.set(channel.id, channel);
		}

		for (const property of properties) {
			const value = values.get(property.id);
			if (value === undefined) {
				continue;
			}

			// Find the channel for this property using the property's channel reference
			// property.channel can be either a string (channel ID) or a ChannelEntity
			const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
			const channel = channelId ? channelMap.get(channelId) : undefined;
			if (!channel) {
				this.logger.warn(`Could not find channel for virtual property ${property.id} (channelId: ${channelId})`);
				continue;
			}

			// Virtual command properties need a valid entity ID to send commands to
			if (!property.haEntityId) {
				this.logger.warn(`Virtual command property ${property.id} has no haEntityId, cannot send command`);
				continue;
			}

			// Get the service call from VirtualPropertyService
			const serviceCall = this.virtualPropertyService.getServiceCallForCommand(
				channel.category,
				property.category,
				String(value),
				property.haEntityId,
			);

			if (!serviceCall) {
				this.logger.warn(
					`Could not get service call for virtual command property: ` +
						`channel=${channel.category}, property=${property.category}, value=${value}`,
				);
				continue;
			}

			this.logger.debug(
				`[VIRTUAL COMMAND] Translating command: channel=${channel.category}, ` +
					`property=${property.category}, value=${value} -> ` +
					`service=${serviceCall.domain}.${serviceCall.service}`,
			);

			updates.push({
				domain: serviceCall.domain,
				entityId: serviceCall.entityId,
				state: String(value),
				service: serviceCall.service,
				attributes: serviceCall.data
					? new Map(Object.entries(serviceCall.data) as [string, string | number | number[] | boolean | null][])
					: undefined,
				properties: [property],
			});
		}

		return updates;
	}

	private async getChannels(device: HomeAssistantDeviceEntity): Promise<HomeAssistantChannelEntity[]> {
		return await this.channelsService.findAll<HomeAssistantChannelEntity>(device.id, DEVICES_HOME_ASSISTANT_TYPE);
	}

	private async getProperties(channels: HomeAssistantChannelEntity[]): Promise<HomeAssistantChannelPropertyEntity[]> {
		return await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
			channels.map((channel) => channel.id),
			DEVICES_HOME_ASSISTANT_TYPE,
		);
	}

	private async getReadableProperties(
		channels: HomeAssistantChannelEntity[],
	): Promise<HomeAssistantChannelPropertyEntity[]> {
		return (await this.getProperties(channels)).filter(
			(property) =>
				// Must have readable permission
				(property.permissions.includes(PermissionType.READ_WRITE) ||
					property.permissions.includes(PermissionType.READ_ONLY)) &&
				// Virtual properties don't have real HA data to read
				!this.isVirtualProperty(property),
		);
	}

	private async getWritableProperties(
		channels: HomeAssistantChannelEntity[],
	): Promise<HomeAssistantChannelPropertyEntity[]> {
		return (await this.getProperties(channels)).filter(
			(property) =>
				property.permissions.includes(PermissionType.READ_WRITE) ||
				property.permissions.includes(PermissionType.WRITE_ONLY),
		);
	}

	private groupProperties(
		properties: HomeAssistantChannelPropertyEntity[],
	): Map<string, HomeAssistantChannelPropertyEntity[]> {
		const mapped = new Map<string, HomeAssistantChannelPropertyEntity[]>();

		for (const property of properties) {
			const list = mapped.get(property.haEntityId);

			if (list) {
				list.push(property);
			} else {
				mapped.set(property.haEntityId, [property]);
			}
		}

		return mapped;
	}

	private getDomain(entityId: string): HomeAssistantDomain {
		const domain = entityId.toLowerCase().split('.')[0] as HomeAssistantDomain;

		if (!Object.values(HomeAssistantDomain).includes(domain)) {
			throw new DevicesHomeAssistantValidationException(`Unknown or unsupported Home Assistant domain: ${domain}`);
		}

		return domain;
	}

	/**
	 * Check if a property is a virtual property based on its haAttribute
	 * Virtual properties have haAttribute starting with 'fb.virtual.'
	 */
	private isVirtualProperty(property: HomeAssistantChannelPropertyEntity): boolean {
		return property.haAttribute?.startsWith(VIRTUAL_ATTRIBUTE_PREFIX) ?? false;
	}
}
