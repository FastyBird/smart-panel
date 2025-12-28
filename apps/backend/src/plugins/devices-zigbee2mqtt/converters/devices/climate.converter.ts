import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeEnum, Z2mExposeNumeric, Z2mExposeSpecific } from '../../interfaces/zigbee2mqtt.interface';
import { BaseConverter } from '../base.converter';
import {
	CanHandleResult,
	ConversionContext,
	ConverterPriority,
	IDeviceConverter,
	MappedChannel,
	MappedProperty,
} from '../converter.interface';

/**
 * Climate/Thermostat Converter
 *
 * Handles Z2M 'climate' specific exposes with features like:
 * - local_temperature (current temperature reading)
 * - current_heating_setpoint / occupied_heating_setpoint (target temperature)
 * - system_mode (off/heat/cool/auto)
 * - running_state (idle/heat/cool)
 * - fan_mode (for HVAC systems)
 *
 * Inspired by homebridge-z2m's ThermostatCreator/ThermostatHandler.
 */
export class ClimateConverter extends BaseConverter implements IDeviceConverter {
	readonly type = 'climate';
	readonly exposeType = 'climate' as const;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (expose.type === 'climate') {
			return this.canHandleWith(ConverterPriority.DEVICE);
		}
		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, _context: ConversionContext): MappedChannel[] {
		const climateExpose = expose as Z2mExposeSpecific;
		const features = climateExpose.features || [];
		const endpoint = climateExpose.endpoint;

		const properties: MappedProperty[] = [];

		// Process each feature
		for (const feature of features) {
			const propertyName = this.getPropertyName(feature);
			if (!propertyName) continue;

			switch (propertyName) {
				case 'local_temperature':
					properties.push(this.convertLocalTemperature(feature as Z2mExposeNumeric));
					break;
				case 'current_heating_setpoint':
				case 'occupied_heating_setpoint':
					properties.push(this.convertSetpoint(feature as Z2mExposeNumeric, propertyName));
					break;
				case 'current_cooling_setpoint':
				case 'occupied_cooling_setpoint':
					// Cooling setpoints - could be added if needed
					break;
				case 'system_mode':
					if (feature.type === 'enum') {
						properties.push(this.convertSystemMode(feature));
					}
					break;
				case 'running_state':
					if (feature.type === 'enum') {
						properties.push(this.convertRunningState(feature));
					}
					break;
				case 'preset':
					if (feature.type === 'enum') {
						properties.push(this.convertPreset(feature));
					}
					break;
				case 'fan_mode':
					if (feature.type === 'enum') {
						properties.push(this.convertFanMode(feature));
					}
					break;
			}
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('thermostat', endpoint),
				name: this.formatChannelName('Thermostat', endpoint),
				category: ChannelCategory.THERMOSTAT,
				endpoint,
				properties,
			}),
		];
	}

	private convertLocalTemperature(feature: Z2mExposeNumeric): MappedProperty {
		return this.createProperty({
			identifier: 'temperature',
			name: 'Current Temperature',
			category: PropertyCategory.TEMPERATURE,
			channelCategory: ChannelCategory.THERMOSTAT,
			dataType: DataTypeType.FLOAT,
			z2mProperty: 'local_temperature',
			access: feature.access ?? Z2M_ACCESS.STATE,
			unit: '°C',
			min: feature.value_min,
			max: feature.value_max,
			step: feature.value_step,
		});
	}

	private convertSetpoint(feature: Z2mExposeNumeric, z2mProperty: string): MappedProperty {
		return this.createProperty({
			identifier: 'target_temperature',
			name: 'Target Temperature',
			category: PropertyCategory.TEMPERATURE,
			channelCategory: ChannelCategory.THERMOSTAT,
			dataType: DataTypeType.FLOAT,
			z2mProperty,
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			unit: '°C',
			min: feature.value_min ?? 5,
			max: feature.value_max ?? 35,
			step: feature.value_step ?? 0.5,
			format: [feature.value_min ?? 5, feature.value_max ?? 35],
		});
	}

	private convertSystemMode(feature: Z2mExposeEnum): MappedProperty {
		const values = feature.values || [];

		return this.createProperty({
			identifier: 'mode',
			name: 'System Mode',
			category: PropertyCategory.MODE,
			channelCategory: ChannelCategory.THERMOSTAT,
			dataType: DataTypeType.STRING,
			z2mProperty: feature.property ?? 'system_mode',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			format: values,
		});
	}

	private convertRunningState(feature: Z2mExposeEnum): MappedProperty {
		const values = feature.values || [];

		return this.createProperty({
			identifier: 'status',
			name: 'Running State',
			category: PropertyCategory.STATUS,
			channelCategory: ChannelCategory.THERMOSTAT,
			dataType: DataTypeType.STRING,
			z2mProperty: feature.property ?? 'running_state',
			access: feature.access ?? Z2M_ACCESS.STATE,
			format: values,
		});
	}

	private convertPreset(feature: Z2mExposeEnum): MappedProperty {
		const values = feature.values || [];

		return this.createProperty({
			identifier: 'preset',
			name: 'Preset',
			category: PropertyCategory.MODE,
			channelCategory: ChannelCategory.THERMOSTAT,
			dataType: DataTypeType.STRING,
			z2mProperty: feature.property ?? 'preset',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			format: values,
		});
	}

	private convertFanMode(feature: Z2mExposeEnum): MappedProperty {
		const values = feature.values || [];

		return this.createProperty({
			identifier: 'fan_mode',
			name: 'Fan Mode',
			category: PropertyCategory.MODE,
			channelCategory: ChannelCategory.THERMOSTAT,
			dataType: DataTypeType.STRING,
			z2mProperty: feature.property ?? 'fan_mode',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			format: values,
		});
	}
}
