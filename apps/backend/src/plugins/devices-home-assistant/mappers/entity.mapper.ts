import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantException } from '../devices-home-assistant.exceptions';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

export interface IEntityMapper {
	get domain(): HomeAssistantDomain;

	mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>>;

	mapToHA(
		properties: HomeAssistantChannelPropertyEntity[],
		values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
	): Promise<{
		state: string;
		service: string;
		attributes?: Map<string, string | number | number[] | boolean | null>;
	} | null>;
}

export abstract class EntityMapper implements IEntityMapper {
	constructor(private readonly channelsService: ChannelsService) {}

	abstract get domain(): HomeAssistantDomain;

	mapFromHA(
		_properties: HomeAssistantChannelPropertyEntity[],
		_state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		throw new DevicesHomeAssistantException('Method not implemented.');
	}

	mapToHA(
		_properties: HomeAssistantChannelPropertyEntity[],
		_values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
	): Promise<{
		state: string;
		service: string;
		attributes?: Map<string, string | number | number[] | boolean | null>;
	} | null> {
		return Promise.resolve(null);
	}

	protected async getValidProperty(
		properties: HomeAssistantChannelPropertyEntity[],
		expectedPropertyCategory: PropertyCategory,
		haAttribute: string,
		expectedChannelCategories: ChannelCategory[],
	): Promise<HomeAssistantChannelPropertyEntity | undefined> {
		const prop = properties.find(
			(property) => property.category === expectedPropertyCategory && property.haAttribute === haAttribute,
		);

		if (!prop) {
			return undefined;
		}

		const channel = typeof prop.channel === 'string' ? await this.channelsService.findOne(prop.channel) : prop.channel;

		const allowed = new Set(expectedChannelCategories);

		if (!channel || !allowed.has(channel.category)) {
			return undefined;
		}

		return prop;
	}
}
