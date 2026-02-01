import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class SwitchEntityMapperService extends EntityMapper {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'SwitchEntityMapperService',
	);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.SWITCH;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();

		const onProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.COOLER,
			ChannelCategory.FAN,
			ChannelCategory.HEATER,
			ChannelCategory.LIGHT,
			ChannelCategory.LOCK,
			ChannelCategory.OUTLET,
			ChannelCategory.ROBOT_VACUUM,
			ChannelCategory.SWITCHER,
			ChannelCategory.TELEVISION,
			ChannelCategory.PROJECTOR,
			ChannelCategory.VALVE,
		]);

		if (onProp) {
			mapped.set(onProp.id, state.state.toLowerCase() === 'on');
		} else {
			this.logger.warn('Missing main state property');
		}

		return mapped;
	}

	async mapToHA(
		properties: HomeAssistantChannelPropertyEntity[],
		values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
	): Promise<{
		state: string;
		service: string;
		attributes?: Map<string, string | number | number[] | boolean | null>;
	} | null> {
		const onProp = await this.getValidProperty(properties, PropertyCategory.ON, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.COOLER,
			ChannelCategory.FAN,
			ChannelCategory.HEATER,
			ChannelCategory.LIGHT,
			ChannelCategory.LOCK,
			ChannelCategory.OUTLET,
			ChannelCategory.ROBOT_VACUUM,
			ChannelCategory.SWITCHER,
			ChannelCategory.TELEVISION,
			ChannelCategory.PROJECTOR,
			ChannelCategory.VALVE,
		]);

		if (!onProp) {
			this.logger.warn('Missing main state property');
			return null;
		}

		const isOn = values.has(onProp.id) ? values.get(onProp.id) : onProp.value;

		const state = isOn === true ? 'on' : 'off';

		const service = isOn === true ? 'turn_on' : 'turn_off';

		return { state, service };
	}
}
