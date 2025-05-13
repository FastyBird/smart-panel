import { Injectable, Logger } from '@nestjs/common';

import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DEVICES_HOME_ASSISTANT_TYPE, HomeAssistantDomain } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';

import { IEntityMapper } from './entity.mapper';
import { UniversalEntityMapperService } from './universal.entity.mapper.service';

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
	private readonly logger = new Logger(MapperService.name);

	private readonly mappers = new Map<HomeAssistantDomain, IEntityMapper>();

	constructor(
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly universalEntityMapperService: UniversalEntityMapperService,
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
				this.logger.warn(
					`[HOME ASSISTANT MAPPER] No properties found for received state for domain=${domain} entityId=${state.entity_id}`,
				);

				continue;
			}

			const mapper = this.mappers.get(domain);

			const primary = mapper ? await mapper.mapFromHA(properties, state) : new Map();

			const secondary = await this.universalEntityMapperService.mapFromHA(properties, state);

			const result = new Map(primary);

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
		const grouped = this.groupProperties(await this.getWritableProperties(await this.getChannels(device)));

		const updates: MappedToHa[] = [];

		for (const [entityId, properties] of grouped.entries()) {
			const domain = this.getDomain(entityId);

			const mapper = this.mappers.get(domain);

			if (!mapper) {
				this.logger.warn(`[HOME ASSISTANT MAPPER] No mapper found for domain=${domain}`);

				continue;
			}

			const mapped = await mapper.mapToHA(properties, values);

			if (mapped === null) {
				continue;
			}

			const result = { domain, entityId, ...mapped, properties };

			updates.push(result);
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
				property.permissions.includes(PermissionType.READ_WRITE) ||
				property.permissions.includes(PermissionType.READ_ONLY),
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
}
