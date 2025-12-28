import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import {
	Z2mExpose,
	Z2mExposeComposite,
	Z2mExposeNumeric,
	Z2mExposeSpecific,
} from '../../interfaces/zigbee2mqtt.interface';
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
 * Light Converter
 *
 * Handles Z2M 'light' specific exposes with features like:
 * - state (on/off)
 * - brightness (0-254/255 -> normalized to 0-100%)
 * - color_temp (mired -> Kelvin)
 * - color (composite with hue/saturation or x/y)
 *
 * Inspired by homebridge-z2m's LightCreator/LightHandler.
 */
export class LightConverter extends BaseConverter implements IDeviceConverter {
	readonly type = 'light';
	readonly exposeType = 'light' as const;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (expose.type === 'light') {
			return this.canHandleWith(ConverterPriority.DEVICE);
		}
		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, _context: ConversionContext): MappedChannel[] {
		const lightExpose = expose as Z2mExposeSpecific;
		const features = lightExpose.features || [];
		const endpoint = lightExpose.endpoint;

		const properties: MappedProperty[] = [];

		// Process each feature
		for (const feature of features) {
			const propertyName = this.getPropertyName(feature);

			// Handle color composites separately - they produce multiple properties
			if (propertyName === 'color' && feature.type === 'composite') {
				const colorProps = this.convertColorComposite(feature as Z2mExposeComposite);
				properties.push(...colorProps);
				continue;
			}

			// Handle other composites (like nested color_hs)
			if (feature.type === 'composite') {
				const compositeProps = this.convertColorComposite(feature as Z2mExposeComposite);
				properties.push(...compositeProps);
				continue;
			}

			const property = this.convertFeature(feature);
			if (property) {
				properties.push(property);
			}
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('light', endpoint),
				name: this.formatChannelName('Light', endpoint),
				category: ChannelCategory.LIGHT,
				endpoint,
				properties,
			}),
		];
	}

	private convertFeature(feature: Z2mExpose): MappedProperty | null {
		const propertyName = this.getPropertyName(feature);
		if (!propertyName) return null;

		switch (propertyName) {
			case 'state':
				return this.convertState(feature);
			case 'brightness':
				return this.convertBrightness(feature as Z2mExposeNumeric);
			case 'color_temp':
				return this.convertColorTemp(feature as Z2mExposeNumeric);
			default:
				// Color composites and other unhandled features are skipped here
				// (color composites are handled in convert() method)
				return null;
		}
	}

	private convertState(feature: Z2mExpose): MappedProperty {
		return this.createProperty({
			identifier: 'on',
			name: 'State',
			category: PropertyCategory.ON,
			channelCategory: ChannelCategory.LIGHT,
			dataType: DataTypeType.BOOL,
			z2mProperty: 'state',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
		});
	}

	private convertBrightness(feature: Z2mExposeNumeric): MappedProperty {
		// Z2M uses 0-254 or 0-255, we normalize to 0-100%
		return this.createProperty({
			identifier: 'brightness',
			name: 'Brightness',
			category: PropertyCategory.BRIGHTNESS,
			channelCategory: ChannelCategory.LIGHT,
			dataType: DataTypeType.UCHAR,
			z2mProperty: 'brightness',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			unit: '%',
			min: 0,
			max: 100,
			format: [0, 100],
			step: feature.value_step,
		});
	}

	private convertColorTemp(feature: Z2mExposeNumeric): MappedProperty {
		// Z2M uses mired (153-500 typical), we convert to Kelvin
		const minMired = feature.value_min ?? 153;
		const maxMired = feature.value_max ?? 500;

		// Mired to Kelvin is inverted: min mired = max Kelvin
		const minKelvin = this.miredToKelvin(maxMired);
		const maxKelvin = this.miredToKelvin(minMired);

		return this.createProperty({
			identifier: 'color_temperature',
			name: 'Color Temperature',
			category: PropertyCategory.COLOR_TEMPERATURE,
			channelCategory: ChannelCategory.LIGHT,
			dataType: DataTypeType.USHORT,
			z2mProperty: 'color_temp',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			unit: 'K',
			min: minKelvin,
			max: maxKelvin,
			format: [minKelvin, maxKelvin],
		});
	}

	/**
	 * Convert color composite to hue and saturation properties
	 *
	 * Z2M color composites can have:
	 * - color_hs: hue (0-360) and saturation (0-100)
	 * - color_xy: x (0-1) and y (0-1) - we skip these in favor of HS
	 *
	 * We use composite.name to distinguish between them since both
	 * have property="color".
	 */
	convertColorComposite(composite: Z2mExposeComposite): MappedProperty[] {
		const properties: MappedProperty[] = [];
		const compositeName = composite.name ?? '';

		// Skip color_xy - prefer color_hs for HSV support
		if (compositeName === 'color_xy') {
			return properties;
		}

		// Handle color_hs composite
		if (compositeName === 'color_hs' || compositeName === 'color') {
			for (const feature of composite.features || []) {
				const featureName = (feature.property ?? feature.name ?? '').toLowerCase();

				// Hue feature (0-360 degrees)
				if (featureName === 'hue' || featureName === 'h') {
					const numericFeature = feature as Z2mExposeNumeric;
					properties.push(
						this.createProperty({
							identifier: 'hue',
							name: 'Hue',
							category: PropertyCategory.HUE,
							channelCategory: ChannelCategory.LIGHT,
							dataType: DataTypeType.USHORT,
							z2mProperty: 'color',
							access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
							unit: 'deg',
							min: 0,
							max: 360,
							format: [0, 360],
							step: numericFeature.value_step,
						}),
					);
				}

				// Saturation feature (0-100%)
				if (featureName === 'saturation' || featureName === 's') {
					const numericFeature = feature as Z2mExposeNumeric;
					properties.push(
						this.createProperty({
							identifier: 'saturation',
							name: 'Saturation',
							category: PropertyCategory.SATURATION,
							channelCategory: ChannelCategory.LIGHT,
							dataType: DataTypeType.UCHAR,
							z2mProperty: 'color',
							access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
							unit: '%',
							min: 0,
							max: 100,
							format: [0, 100],
							step: numericFeature.value_step,
						}),
					);
				}

				// Handle nested color_hs inside color composite
				if (featureName === 'color_hs' && feature.type === 'composite') {
					const nestedProps = this.convertColorComposite(feature);
					properties.push(...nestedProps);
				}
			}
		}

		return properties;
	}
}
