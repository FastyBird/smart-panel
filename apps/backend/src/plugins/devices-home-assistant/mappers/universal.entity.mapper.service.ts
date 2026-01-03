import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DataTypeType } from '../../../modules/devices/devices.constants';
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
					let mappedValue: string | number | boolean | null = value as string | number | boolean | null;

					if (property.dataType === DataTypeType.BOOL) {
						if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
							mappedValue = ['on', 'true', '1'].includes(String(value).toLowerCase());
						} else {
							mappedValue = false;
						}
					}

					mapped.set(property.id, mappedValue);
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
				let mappedValue: string | number | boolean | null = state.state;

				if (mainProperty.dataType === DataTypeType.BOOL) {
					mappedValue = ['on', 'true', '1'].includes(String(state.state).toLowerCase());
				}

				mapped.set(mainProperty.id, mappedValue as string | number | boolean | null);
			}
		}

		return Promise.resolve(mapped);
	}
}
