import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	CoverEntityAttribute,
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

/**
 * HA cover states to Smart Panel STATUS mapping
 */
const HA_STATE_TO_STATUS: Record<string, string> = {
	open: 'opened',
	opened: 'opened',
	closed: 'closed',
	opening: 'opening',
	closing: 'closing',
	stopped: 'stopped',
};

@Injectable()
export class CoverEntityMapperService extends EntityMapper {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'CoverEntityMapperService',
	);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.COVER;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();
		this.logger.debug(
			`[COVER ENTITY MAPPER] Properties: ${properties.map((p) => `${p.category}:${p.haAttribute}`).join(', ')}`,
		);
		this.logger.debug(
			`[COVER ENTITY MAPPER] State: ${state.state}, Attributes: ${Object.keys(state.attributes).join(', ')}`,
		);

		// Map main state to STATUS property
		const statusProp = await this.getValidProperty(properties, PropertyCategory.STATUS, ENTITY_MAIN_STATE_ATTRIBUTE, [
			ChannelCategory.WINDOW_COVERING,
			ChannelCategory.DOOR,
		]);

		if (statusProp) {
			const statusValue = HA_STATE_TO_STATUS[state.state.toLowerCase()] ?? 'stopped';
			mapped.set(statusProp.id, statusValue);
		}

		// Map current_position to POSITION property
		const currentPosition = state.attributes[CoverEntityAttribute.CURRENT_POSITION];

		if (typeof currentPosition === 'number') {
			const positionProp = await this.getValidProperty(
				properties,
				PropertyCategory.POSITION,
				CoverEntityAttribute.CURRENT_POSITION,
				[ChannelCategory.WINDOW_COVERING, ChannelCategory.DOOR],
			);

			if (positionProp) {
				mapped.set(positionProp.id, currentPosition);
			}
		}

		// Map current_tilt_position to TILT property
		const currentTilt = state.attributes[CoverEntityAttribute.CURRENT_TILT_POSITION];

		if (typeof currentTilt === 'number') {
			const tiltProp = await this.getValidProperty(
				properties,
				PropertyCategory.TILT,
				CoverEntityAttribute.CURRENT_TILT_POSITION,
				[ChannelCategory.WINDOW_COVERING],
			);

			if (tiltProp) {
				mapped.set(tiltProp.id, currentTilt);
			}
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
		// Check for position change
		const positionProp = await this.getValidProperty(
			properties,
			PropertyCategory.POSITION,
			CoverEntityAttribute.CURRENT_POSITION,
			[ChannelCategory.WINDOW_COVERING, ChannelCategory.DOOR],
		);

		if (positionProp && values.has(positionProp.id)) {
			const position = this.toNumber(values.get(positionProp.id));

			if (position !== null) {
				const attributes = new Map<string, string | number | number[] | boolean | null>();
				attributes.set('position', position);

				return {
					state: position > 0 ? 'open' : 'closed',
					service: 'set_cover_position',
					attributes,
				};
			}
		}

		// Check for tilt change
		const tiltProp = await this.getValidProperty(
			properties,
			PropertyCategory.TILT,
			CoverEntityAttribute.CURRENT_TILT_POSITION,
			[ChannelCategory.WINDOW_COVERING],
		);

		if (tiltProp && values.has(tiltProp.id)) {
			const tilt = this.toNumber(values.get(tiltProp.id));

			if (tilt !== null) {
				const attributes = new Map<string, string | number | number[] | boolean | null>();
				attributes.set('tilt_position', tilt);

				return {
					state: 'open',
					service: 'set_cover_tilt_position',
					attributes,
				};
			}
		}

		this.logger.warn('[COVER ENTITY MAPPER] No mappable properties found');

		return null;
	}

	/**
	 * Convert a value to a number, handling strings stored in the database
	 */
	private toNumber(value: string | number | boolean | null | undefined): number | null {
		if (value === null || value === undefined) {
			return null;
		}

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);
			return isNaN(parsed) ? null : parsed;
		}

		if (typeof value === 'boolean') {
			return value ? 100 : 0;
		}

		return null;
	}
}
