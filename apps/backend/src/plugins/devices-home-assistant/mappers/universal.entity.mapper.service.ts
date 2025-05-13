import { Injectable, Logger } from '@nestjs/common';

import { HomeAssistantDomain } from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class UniversalEntityMapperService extends EntityMapper {
	private readonly logger = new Logger(UniversalEntityMapperService.name);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.SWITCH;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();

		const entityProperties = properties.filter((property) => property.haEntityId === state.entity_id);

		if (entityProperties.length) {
			for (const [key, value] of Object.entries(state.attributes)) {
				const property = entityProperties.find((property) => property.haAttribute === key);

				if (
					property &&
					(typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null)
				) {
					mapped.set(property.id, value as string | number | boolean | null);
				}
			}
		}

		this.logger.debug('[UNIVERSAL ENTITY MAPPER] Received entity state was mapped to system properties');

		return mapped;
	}
}
