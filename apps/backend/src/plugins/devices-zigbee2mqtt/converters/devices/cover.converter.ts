import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../../modules/devices/devices.constants';
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
 * Cover/Blind Converter
 *
 * Handles Z2M 'cover' specific exposes with features like:
 * - position (0-100%)
 * - tilt (0-100%)
 * - state (OPEN/CLOSE/STOP commands)
 * - moving (motor state: opening/closing/stopped)
 *
 * Inspired by homebridge-z2m's CoverHandler which tracks motor state
 * and implements position polling during movement.
 */
export class CoverConverter extends BaseConverter implements IDeviceConverter {
	readonly type = 'cover';
	readonly exposeType = 'cover' as const;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (expose.type === 'cover') {
			return this.canHandleWith(ConverterPriority.DEVICE);
		}
		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, _context: ConversionContext): MappedChannel[] {
		const coverExpose = expose as Z2mExposeSpecific;
		const features = coverExpose.features || [];
		const endpoint = coverExpose.endpoint;

		const properties: MappedProperty[] = [];

		// Process each feature
		for (const feature of features) {
			const propertyName = this.getPropertyName(feature);
			if (!propertyName) continue;

			switch (propertyName) {
				case 'position':
					properties.push(this.convertPosition(feature as Z2mExposeNumeric));
					break;
				case 'tilt':
					properties.push(this.convertTilt(feature as Z2mExposeNumeric));
					break;
				case 'state':
					// Cover state is an enum (OPEN/CLOSE/STOP) - map to status
					if (feature.type === 'enum') {
						const statusProp = this.convertState(feature);
						if (statusProp) {
							properties.push(statusProp);
						}
					}
					break;
				case 'moving':
					// Motor state (opening/closing/stopped)
					if (feature.type === 'enum') {
						properties.push(this.convertMotorState(feature));
					}
					break;
			}
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('window_covering', endpoint),
				name: this.formatChannelName('Cover', endpoint),
				category: ChannelCategory.WINDOW_COVERING,
				endpoint,
				properties,
			}),
		];
	}

	private convertPosition(feature: Z2mExposeNumeric): MappedProperty {
		// Z2M position is typically 0-100%
		const min = feature.value_min ?? 0;
		const max = feature.value_max ?? 100;

		return this.createProperty({
			identifier: 'position',
			name: 'Position',
			category: PropertyCategory.POSITION,
			channelCategory: ChannelCategory.WINDOW_COVERING,
			dataType: DataTypeType.UCHAR,
			z2mProperty: 'position',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			unit: '%',
			min,
			max,
			format: [min, max],
			step: feature.value_step,
		});
	}

	private convertTilt(feature: Z2mExposeNumeric): MappedProperty {
		// Z2M tilt is typically 0-100%
		const min = feature.value_min ?? 0;
		const max = feature.value_max ?? 100;

		return this.createProperty({
			identifier: 'tilt',
			name: 'Tilt',
			category: PropertyCategory.TILT,
			channelCategory: ChannelCategory.WINDOW_COVERING,
			dataType: DataTypeType.UCHAR,
			z2mProperty: 'tilt',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			unit: '%',
			min,
			max,
			format: [min, max],
			step: feature.value_step,
		});
	}

	/**
	 * Convert cover state enum to status property
	 *
	 * Z2M uses OPEN/CLOSE/STOP as commands. We keep the original Z2M values
	 * in the format to match the actual data received from the device.
	 * Value normalization (e.g., OPEN→opened) should be done at runtime
	 * in the data transformation layer if needed for UI display.
	 */
	private convertState(feature: Z2mExposeEnum): MappedProperty | null {
		const values = feature.values || [];

		// Check if this is a cover state enum
		if (!this.isCoverStateEnum(values)) {
			return null;
		}

		return {
			identifier: 'status',
			name: 'Status',
			category: PropertyCategory.STATUS,
			channelCategory: ChannelCategory.WINDOW_COVERING,
			dataType: DataTypeType.ENUM,
			permissions: [PermissionType.READ_ONLY],
			z2mProperty: feature.property ?? 'state',
			format: values, // Keep original Z2M values to match actual data
		};
	}

	/**
	 * Convert motor state (moving) to status property
	 *
	 * This tracks whether the cover is currently moving (opening/closing/stopped).
	 * We keep the original Z2M values to match the actual data received.
	 */
	private convertMotorState(feature: Z2mExposeEnum): MappedProperty {
		const values = feature.values || [];

		return {
			identifier: 'motor_state',
			name: 'Motor State',
			category: PropertyCategory.STATUS,
			channelCategory: ChannelCategory.WINDOW_COVERING,
			dataType: DataTypeType.ENUM,
			permissions: [PermissionType.READ_ONLY],
			z2mProperty: feature.property ?? 'moving',
			format: values, // Keep original Z2M values to match actual data
		};
	}

	/**
	 * Check if enum values indicate a cover state (OPEN/CLOSE/STOP)
	 */
	private isCoverStateEnum(values: string[]): boolean {
		if (!values || values.length === 0) {
			return false;
		}

		const lowerValues = values.map((v) => v.toLowerCase());
		const hasOpen = lowerValues.includes('open');
		const hasClose = lowerValues.includes('close');

		return hasOpen && hasClose;
	}
}
