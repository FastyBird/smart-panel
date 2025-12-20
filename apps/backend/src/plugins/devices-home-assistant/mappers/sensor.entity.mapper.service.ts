import { Injectable, Logger } from '@nestjs/common';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ENTITY_MAIN_STATE_ATTRIBUTE, HomeAssistantDomain } from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { EntityMapper } from './entity.mapper';

@Injectable()
export class SensorEntityMapperService extends EntityMapper {
	private readonly logger = new Logger(SensorEntityMapperService.name);

	get domain(): HomeAssistantDomain {
		return HomeAssistantDomain.SENSOR;
	}

	async mapFromHA(
		properties: HomeAssistantChannelPropertyEntity[],
		state: HomeAssistantStateDto,
	): Promise<Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null>> {
		const mapped: Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean | null> = new Map();

		if ('device_class' in state.attributes && typeof state.attributes.device_class === 'string') {
			switch (state.attributes.device_class) {
				case 'apparent_power':
					break;
				case 'aqi':
					break;
				case 'area':
					break;
				case 'atmospheric_pressure':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.MEASURED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.PRESSURE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'kpa':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'hpa':
							case 'mbar':
								mapped.set(sensorProp.id, rawValue / 10);
								break;
							case 'bar':
								mapped.set(sensorProp.id, rawValue * 100);
								break;
							case 'pa':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							case 'cbar':
								mapped.set(sensorProp.id, rawValue * 10);
								break;
							case 'mmhg':
								mapped.set(sensorProp.id, rawValue * 0.133322);
								break;
							case 'inhg':
								mapped.set(sensorProp.id, rawValue * 3.38639);
								break;
							case 'psi':
								mapped.set(sensorProp.id, rawValue * 6.89476);
								break;
							default:
								this.logger.warn(`Unsupported atmospheric pressure unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'battery':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.PERCENTAGE,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.BATTERY],
						);

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'blood_glucose_concentration':
					break;
				case 'co2':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DENSITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.CARBON_DIOXIDE],
						);

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'co':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DENSITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.CARBON_MONOXIDE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'conductivity':
					break;
				case 'current':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.CURRENT,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.ELECTRICAL_POWER],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'A':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'mA':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							default:
								this.logger.warn(`Unsupported current unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'data_rate':
					break;
				case 'data_size':
					break;
				case 'date':
					break;
				case 'distance':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DISTANCE,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.MOTION, ChannelCategory.OCCUPANCY],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'km':
								mapped.set(sensorProp.id, rawValue * 1_000);
								break;
							case 'm':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'cm':
								mapped.set(sensorProp.id, rawValue / 100);
								break;
							case 'mm':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							case 'mi':
								mapped.set(sensorProp.id, rawValue * 1_609.34);
								break;
							case 'nmi':
								mapped.set(sensorProp.id, rawValue * 1_852);
								break;
							case 'yd':
								mapped.set(sensorProp.id, rawValue * 0.9144);
								break;
							case 'in':
								mapped.set(sensorProp.id, rawValue * 0.0254);
								break;
							default:
								this.logger.warn(`Unsupported distance unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'duration':
					break;
				case 'energy':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.CONSUMPTION,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.ELECTRICAL_ENERGY],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'J':
								mapped.set(sensorProp.id, rawValue / 3_600_000);
								break;
							case 'kJ':
								mapped.set(sensorProp.id, rawValue / 3_600);
								break;
							case 'MJ':
								mapped.set(sensorProp.id, rawValue / 3.6);
								break;
							case 'GJ':
								mapped.set(sensorProp.id, rawValue * 277.778);
								break;
							case 'mWh':
								mapped.set(sensorProp.id, rawValue / 1_000_000);
								break;
							case 'Wh':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							case 'kWh':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'MWh':
								mapped.set(sensorProp.id, rawValue * 1_000);
								break;
							case 'GWh':
								mapped.set(sensorProp.id, rawValue * 1_000_000);
								break;
							default:
								this.logger.warn(`Unsupported energy unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'energy_distance':
					break;
				case 'energy_storage':
					break;
				case 'enum':
					break;
				case 'frequency':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.FREQUENCY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.ELECTRICAL_POWER],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'Hz':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'kHz':
								mapped.set(sensorProp.id, rawValue * 1_000);
								break;
							case 'MHz':
								mapped.set(sensorProp.id, rawValue * 1_000_000);
								break;
							case 'GHz':
								mapped.set(sensorProp.id, rawValue * 1_000_000_000);
								break;
							default:
								this.logger.warn(`Unsupported frequency unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'gas':
					break;
				case 'humidity':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.HUMIDITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.HUMIDITY],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'illuminance':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.LEVEL,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.ILLUMINANCE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'irradiance':
					break;
				case 'moisture':
					break;
				case 'monetary':
					break;
				case 'nitrogen_dioxide':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DENSITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.NITROGEN_DIOXIDE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'nitrogen_monoxide':
					break;
				case 'nitrous_oxide':
					break;
				case 'ozone':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DENSITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.OZONE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'ph':
					break;
				case 'pm1':
				case 'pm25':
				case 'pm10':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DENSITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.AIR_PARTICULATE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'power':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.POWER,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.ELECTRICAL_POWER],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'mW':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							case 'W':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'kW':
								mapped.set(sensorProp.id, rawValue * 1_000);
								break;
							case 'MW':
								mapped.set(sensorProp.id, rawValue * 1_000_000);
								break;
							case 'GW':
								mapped.set(sensorProp.id, rawValue * 1_000_000_000);
								break;
							case 'TW':
								mapped.set(sensorProp.id, rawValue * 1_000_000_000_000);
								break;
							default:
								this.logger.warn(`Unsupported power unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'power_factor':
					break;
				case 'precipitation':
					break;
				case 'precipitation_intensity':
					break;
				case 'pressure':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.MEASURED,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.PRESSURE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'kpa':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'hpa':
							case 'mbar':
								mapped.set(sensorProp.id, rawValue / 10);
								break;
							case 'bar':
								mapped.set(sensorProp.id, rawValue * 100);
								break;
							case 'pa':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							case 'cbar':
								mapped.set(sensorProp.id, rawValue * 10);
								break;
							case 'mmhg':
								mapped.set(sensorProp.id, rawValue * 0.133322);
								break;
							case 'inhg':
								mapped.set(sensorProp.id, rawValue * 3.38639);
								break;
							case 'psi':
								mapped.set(sensorProp.id, rawValue * 6.89476);
								break;
							default:
								this.logger.warn(`Unsupported pressure unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'reactive_power':
					break;
				case 'signal_strength':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.LINK_QUALITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.DEVICE_INFORMATION],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						let percent = Math.round(2 * (rawValue + 100));
						percent = Math.max(0, Math.min(100, percent)); // Clamp to 0-100

						mapped.set(sensorProp.id, percent);
					}
					break;
				case 'sound_pressure':
					break;
				case 'speed':
					break;
				case 'sulphur_dioxide':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DENSITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.SULPHUR_DIOXIDE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'temperature':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.TEMPERATURE,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.TEMPERATURE],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case '°C':
								mapped.set(sensorProp.id, rawValue);
								break;
							case '°F':
								mapped.set(sensorProp.id, ((rawValue - 32) * 5) / 9);
								break;
							case 'K':
								mapped.set(sensorProp.id, rawValue - 273.15);
								break;
							default:
								this.logger.warn(`Unsupported temperature unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'timestamp':
					break;
				case 'volatile_organic_compounds':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.DENSITY,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						mapped.set(sensorProp.id, rawValue);
					}
					break;
				case 'volatile_organic_compounds_parts':
					break;
				case 'voltage':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.VOLTAGE,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.ELECTRICAL_POWER],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'V':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'mV':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							case 'µV':
								mapped.set(sensorProp.id, rawValue / 1_000_000);
								break;
							case 'kV':
								mapped.set(sensorProp.id, rawValue * 1_000);
								break;
							case 'MV':
								mapped.set(sensorProp.id, rawValue * 1_000_000);
								break;
							default:
								this.logger.warn(`Unsupported voltage unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'volume':
					break;
				case 'volume_flow_rate':
					{
						const sensorProp = await this.getValidProperty(
							properties,
							PropertyCategory.VOLUME,
							ENTITY_MAIN_STATE_ATTRIBUTE,
							[ChannelCategory.FLOW],
						);

						if (!sensorProp) {
							break;
						}

						const rawValue = this.parseNumber(state, state.attributes.device_class);

						if (typeof rawValue !== 'number') {
							if (rawValue === null) {
								mapped.set(sensorProp.id, null);
							}

							break;
						}

						const unit = this.parseUnit(state, state.attributes.device_class);

						switch (unit) {
							case 'm³/h':
								mapped.set(sensorProp.id, rawValue);
								break;
							case 'm³/s':
								mapped.set(sensorProp.id, rawValue * 3_600);
								break;
							case 'ft³/min':
								mapped.set(sensorProp.id, rawValue * 1.699);
								break;
							case 'L/h':
								mapped.set(sensorProp.id, rawValue / 1_000);
								break;
							case 'L/min':
								mapped.set(sensorProp.id, (rawValue * 60) / 1_000);
								break;
							case 'L/s':
								mapped.set(sensorProp.id, (rawValue * 3_600) / 1_000);
								break;
							case 'gal/min':
								mapped.set(sensorProp.id, rawValue * 0.2271);
								break;
							case 'mL/s':
								mapped.set(sensorProp.id, (rawValue * 3_600) / 1_000_000);
								break;
							default:
								this.logger.warn(`Unsupported volume flow rate unit: ${unit} for value=${rawValue}`);
								break;
						}
					}
					break;
				case 'volume_storage':
					break;
				case 'water':
					break;
				case 'weight':
					break;
				case 'wind_direction':
					break;
				case 'wind_speed':
					break;
			}
		}

		return mapped;
	}

	private parseNumber(state: HomeAssistantStateDto, context: string): number | null | false {
		const raw = state.state;

		if (raw === null || raw === 'unknown' || raw === 'unavailable') {
			return null;
		}

		const parsed = parseFloat(raw);

		if (isNaN(parsed)) {
			this.logger.warn(`Invalid ${context} value: ${raw}`);

			return false;
		}

		return parsed;
	}

	private parseUnit(state: HomeAssistantStateDto, context: string): string | null {
		if (typeof state.attributes.unit_of_measurement !== 'string') {
			this.logger.warn(`Invalid ${context} unit: ${state.attributes.unit_of_measurement as string}`);

			return null;
		}

		return state.attributes.unit_of_measurement;
	}
}
