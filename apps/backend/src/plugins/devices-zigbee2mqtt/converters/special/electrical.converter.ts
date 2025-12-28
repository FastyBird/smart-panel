import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import { BaseConverter } from '../base.converter';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

/**
 * Electrical property configuration
 */
interface ElectricalPropertyConfig {
	identifier: string;
	name: string;
	category: PropertyCategory;
	channelCategory: ChannelCategory;
	unit: string;
}

/**
 * Electrical Monitoring Converter
 *
 * Handles power monitoring properties:
 * - voltage (V)
 * - current (A)
 * - power (W)
 * - energy (kWh)
 *
 * Groups related properties into appropriate channels:
 * - electrical_power for instantaneous measurements (voltage, current, power)
 * - electrical_energy for cumulative measurements (energy)
 */
export class ElectricalConverter extends BaseConverter {
	readonly type = 'electrical';

	// Property configurations
	private readonly propertyConfigs: Record<string, ElectricalPropertyConfig> = {
		voltage: {
			identifier: 'voltage',
			name: 'Voltage',
			category: PropertyCategory.VOLTAGE,
			channelCategory: ChannelCategory.ELECTRICAL_POWER,
			unit: 'V',
		},
		current: {
			identifier: 'current',
			name: 'Current',
			category: PropertyCategory.CURRENT,
			channelCategory: ChannelCategory.ELECTRICAL_POWER,
			unit: 'A',
		},
		power: {
			identifier: 'power',
			name: 'Power',
			category: PropertyCategory.POWER,
			channelCategory: ChannelCategory.ELECTRICAL_POWER,
			unit: 'W',
		},
		energy: {
			identifier: 'consumption',
			name: 'Energy',
			category: PropertyCategory.CONSUMPTION,
			channelCategory: ChannelCategory.ELECTRICAL_ENERGY,
			unit: 'kWh',
		},
	};

	// Property names this converter handles
	private readonly propertyNames = Object.keys(this.propertyConfigs);

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (this.shouldSkipExpose(expose)) {
			return this.cannotHandle();
		}

		if (expose.type !== 'numeric') {
			return this.cannotHandle();
		}

		const propertyName = this.getPropertyName(expose);
		if (propertyName && this.propertyNames.includes(propertyName)) {
			return this.canHandleWith(ConverterPriority.ELECTRICAL);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, _context: ConversionContext): MappedChannel[] {
		const numericExpose = expose as Z2mExposeNumeric;
		const propertyName = this.getPropertyName(expose);

		if (!propertyName || !this.propertyConfigs[propertyName]) {
			return [];
		}

		const config = this.propertyConfigs[propertyName];
		const range = this.extractNumericRange(numericExpose);

		const property = this.createProperty({
			identifier: config.identifier,
			name: config.name,
			category: config.category,
			channelCategory: config.channelCategory,
			dataType: this.getDataType(config.channelCategory, config.category, expose),
			z2mProperty: propertyName,
			access: numericExpose.access ?? Z2M_ACCESS.STATE,
			unit: range.unit ?? config.unit,
			min: range.min,
			max: range.max,
			step: range.step,
		});

		// Determine channel based on property type
		// Include endpoint in channel identifier to support multi-endpoint devices
		// (e.g., 3-phase power meters with L1, L2, L3 endpoints)
		const baseChannelId =
			config.channelCategory === ChannelCategory.ELECTRICAL_ENERGY ? 'electrical_energy' : 'electrical_power';

		const channelId = this.createChannelIdentifier(baseChannelId, expose.endpoint);

		const baseChannelName =
			config.channelCategory === ChannelCategory.ELECTRICAL_ENERGY ? 'Electrical Energy' : 'Electrical Power';

		const channelName = this.formatChannelName(baseChannelName, expose.endpoint);

		return [
			this.createChannel({
				identifier: channelId,
				name: channelName,
				category: config.channelCategory,
				endpoint: expose.endpoint,
				properties: [property],
			}),
		];
	}
}
