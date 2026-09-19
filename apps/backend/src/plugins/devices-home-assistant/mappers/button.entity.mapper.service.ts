/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, HomeAssistantDomain } from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

/**
 * Entity mapper for Home Assistant button domain.
 *
 * Home Assistant buttons represent action triggers (service calls), not state sensors.
 * Invoking a button calls the 'press' service, while incoming state updates (timestamps of past presses)
 * do not update property toggles or generate false hardware input occurrences.
 */
@Injectable()
export class ButtonEntityMapperService extends EntityMapper {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'ButtonEntityMapperService',
	);

	constructor(channelsService: ChannelsService) {
		super(channelsService);
	}

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.BUTTON;
	}

	async mapFromHA(
		_properties: HomeAssistantChannelPropertyEntity[],
		_state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		// Home Assistant button state is an ISO timestamp of when it was pressed.
		// It is not a switch toggle and should not update state or impersonate hardware inputs.
		return new Map();
	}

	async mapToHA(
		_properties: HomeAssistantChannelPropertyEntity[],
		_values: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>,
	): Promise<{
		state: string;
		service: string;
		attributes?: Map<string, string | number | number[] | boolean | null>;
	} | null> {
		this.logger.debug('Mapping button command to Home Assistant press service');
		return {
			state: 'press',
			service: 'press',
		};
	}
}

/**
 * Entity mapper for Home Assistant input_button domain (helpers).
 */
@Injectable()
export class InputButtonEntityMapperService extends ButtonEntityMapperService {
	override get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.INPUT_BUTTON;
	}
}
