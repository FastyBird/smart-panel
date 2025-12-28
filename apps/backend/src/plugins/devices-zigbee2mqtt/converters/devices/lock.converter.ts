import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeSpecific } from '../../interfaces/zigbee2mqtt.interface';
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
 * Lock Converter
 *
 * Handles Z2M 'lock' specific exposes with features like:
 * - state (LOCK/UNLOCK)
 * - lock_state (locked/unlocked/not_fully_locked)
 */
export class LockConverter extends BaseConverter implements IDeviceConverter {
	readonly type = 'lock';
	readonly exposeType = 'lock' as const;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (expose.type === 'lock') {
			return this.canHandleWith(ConverterPriority.DEVICE);
		}
		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, _context: ConversionContext): MappedChannel[] {
		const lockExpose = expose as Z2mExposeSpecific;
		const features = lockExpose.features || [];
		const endpoint = lockExpose.endpoint;

		const properties: MappedProperty[] = [];

		// Find lock state feature
		const stateFeature = features.find(
			(f) => f.property === 'state' || f.name === 'state' || f.property === 'lock_state',
		);

		if (stateFeature) {
			properties.push(this.convertLockState(stateFeature));
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('lock', endpoint),
				name: this.formatChannelName('Lock', endpoint),
				category: ChannelCategory.LOCK,
				endpoint,
				properties,
			}),
		];
	}

	private convertLockState(feature: Z2mExpose): MappedProperty {
		return this.createProperty({
			identifier: 'locked',
			name: 'Lock State',
			category: PropertyCategory.LOCKED,
			channelCategory: ChannelCategory.LOCK,
			dataType: this.getDataType(ChannelCategory.LOCK, PropertyCategory.LOCKED, feature),
			z2mProperty: feature.property ?? 'state',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
		});
	}
}
