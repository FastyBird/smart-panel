import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class UniversalEntityMapperService extends EntityMapper {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'UniversalEntityMapperService',
	);

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
					// Return raw value - transformation is applied by MapperService using TransformerRegistry
					// This includes boolean conversions which are now handled by transformers like 'state_on_off'
					mapped.set(property.id, value as string | number | boolean | null);
				}
			}

			const mainProperty = entityProperties.find((property) => property.haAttribute === ENTITY_MAIN_STATE_ATTRIBUTE);

			if (
				mainProperty &&
				(typeof state.state === 'number' ||
					typeof state.state === 'string' ||
					typeof state.state === 'boolean' ||
					state.state === null)
			) {
				// Return raw value - transformation is applied by MapperService using TransformerRegistry
				// Boolean conversions are now handled by transformers like 'state_on_off'
				mapped.set(mainProperty.id, state.state as string | number | boolean | null);
			}
		}

		this.logger.debug('Received entity state was mapped to system properties');

		return Promise.resolve(mapped);
	}
}
