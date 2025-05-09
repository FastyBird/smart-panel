import { Injectable, Logger } from '@nestjs/common';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ENTITY_MAIN_STATE_ATTRIBUTE, HomeAssistantDomain } from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class BinarySensorEntityMapperService extends EntityMapper {
	private readonly logger = new Logger(BinarySensorEntityMapperService.name);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.BINARY_SENSOR;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();

		if ('device_class' in state.attributes && typeof state.attributes.device_class === 'string') {
			switch (state.attributes.device_class) {
				case 'battery':
				case 'battery_charging':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.STATUS,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.BATTERY],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						if (rawValue === null) {
							mapped.set(sensorProp.id, null);

							break;
						}

						if (state.attributes.device_class === 'battery_charging' && rawValue) {
							mapped.set(sensorProp.id, 'charging');
						} else if (state.attributes.device_class === 'battery') {
							mapped.set(sensorProp.id, rawValue ? 'ok' : 'low');
						}
					}
					break;
				case 'co':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DETECTED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.CARBON_MONOXIDE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'cold':
					break;
				case 'connectivity':
					break;
				case 'door':
				case 'garage_door':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.STATUS,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.DOOR],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue ? 'opened' : 'closed');
					}
					break;
				case 'gas':
					break;
				case 'heat':
					break;
				case 'light':
					break;
				case 'lock':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.STATUS,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.LOCK],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue ? 'unlocked' : 'locked');
					}
					break;
				case 'moisture':
					break;
				case 'motion':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DETECTED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.MOTION],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'moving':
					break;
				case 'occupancy':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DETECTED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.OCCUPANCY],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'opening':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.STATUS,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.WINDOW_COVERING],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue ? 'opened' : 'closed');
					}
					break;
				case 'plug':
					break;
				case 'power':
					break;
				case 'presence':
					break;
				case 'problem':
					break;
				case 'running':
					break;
				case 'safety':
					break;
				case 'smoke':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DETECTED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.SMOKE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'sound':
					break;
				case 'tamper':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.TAMPERED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[
								ChannelCategory.AIR_PARTICULATE,
								ChannelCategory.CARBON_DIOXIDE,
								ChannelCategory.CARBON_MONOXIDE,
								ChannelCategory.CONTACT,
								ChannelCategory.DOORBELL,
								ChannelCategory.LEAK,
								ChannelCategory.LOCK,
								ChannelCategory.MOTION,
								ChannelCategory.NITROGEN_DIOXIDE,
								ChannelCategory.OCCUPANCY,
								ChannelCategory.OZONE,
								ChannelCategory.SMOKE,
								ChannelCategory.SULPHUR_DIOXIDE,
								ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS,
							],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'update':
					break;
				case 'vibration':
					break;
				case 'window':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DETECTED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.CONTACT],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseBool(state, state.attributes.device_class);

						mapped.set(sensorProp.id, rawValue);
					}
					break;
			}
		}

		return mapped;
	}

	private parseBool(state: HomeAssistantStateDto, context: string): boolean | null {
		const raw = state.state;

		if (typeof raw === 'string') {
			if (raw.toLowerCase() === 'on' || raw.toLowerCase() === 'true') {
				return true;
			} else if (raw.toLowerCase() === 'off' || raw.toLowerCase() === 'false') {
				return true;
			}
		}

		this.logger.warn(`[BINARY SENSOR ENTITY MAPPER] Invalid ${context} value: ${raw}`);

		return null;
	}
}
