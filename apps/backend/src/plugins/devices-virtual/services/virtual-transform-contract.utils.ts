import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { hasQualifiedRawVoltageIdentity } from '../../devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { VirtualDeviceMode, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualNumericTransformOperator, validateVirtualNumericTransform } from './virtual-numeric-transform.utils';

/** Safe bounded metadata; never markup, control characters or executable configuration. */
export const isTransformQuantity = (quantity: unknown): quantity is string =>
	typeof quantity === 'string' && quantity.trim() === quantity && /^[a-z][a-z0-9_]{0,63}$/.test(quantity);
export const isTransformUnit = (unit: unknown): unit is string =>
	typeof unit === 'string' &&
	unit.length > 0 &&
	unit.length <= 32 &&
	unit.trim() === unit &&
	/^[\p{L}\p{N} %°µΩ·*/^()._-]+$/u.test(unit);

export function isTransformOutputSlot(property: ChannelPropertyEntity): boolean {
	const channel = property?.channel as ChannelEntity;
	const device = channel?.device as DeviceEntity & { mode?: VirtualDeviceMode };
	return (
		!!property &&
		device?.type === 'virtual' &&
		device.mode === VirtualDeviceMode.SENSOR_TRANSFORM &&
		device.category === DeviceCategory.SENSOR &&
		property.dataType === DataTypeType.FLOAT &&
		(property as ChannelPropertyEntity & { valueOrigin?: VirtualValueOrigin }).valueOrigin ===
			VirtualValueOrigin.DERIVED &&
		!(property as ChannelPropertyEntity & { sourcePropertyId?: string }).sourcePropertyId &&
		property.permissions?.includes(PermissionType.READ_ONLY) &&
		!property.permissions.some((permission) =>
			[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
		) &&
		((channel.category === ChannelCategory.ANALOG_INPUT && property.category === PropertyCategory.VALUE) ||
			resolvePropertyUnit(property) !== null)
	);
}

export function isTransformOutput(property: ChannelPropertyEntity, quantity: string, unit: string): boolean {
	if (!isTransformOutputSlot(property) || !isTransformQuantity(quantity) || !isTransformUnit(unit)) return false;
	const channel = property.channel as ChannelEntity;
	const generic = channel.category === ChannelCategory.ANALOG_INPUT && property.category === PropertyCategory.VALUE;
	if (generic) return quantity !== String(PropertyCategory.TEMPERATURE);
	return (
		String(property.category) === quantity &&
		resolvePropertyUnit(property) === unit &&
		(property.unit == null || property.unit === unit) &&
		(quantity !== String(PropertyCategory.TEMPERATURE) ||
			(channel.category === ChannelCategory.TEMPERATURE && unit === '°C'))
	);
}

/** Persistence and runtime share semantic validation in addition to the pure operator validator. */
export function transformContractErrors(
	config: Pick<VirtualTransformConfigEntity, 'schemaVersion' | 'policy' | 'maximumAgeSeconds' | 'quantity' | 'unit'>,
	output: ChannelPropertyEntity,
	source: ChannelPropertyEntity | null,
	binding?: Pick<VirtualTransformSourceEntity, 'quantity' | 'unit'>,
): string[] {
	const errors = validateVirtualNumericTransform(config.policy);
	if (
		config.schemaVersion !== 1 ||
		!Number.isInteger(config.maximumAgeSeconds) ||
		config.maximumAgeSeconds < 1 ||
		config.maximumAgeSeconds > 86400
	)
		errors.push('invalid_policy');
	if (!isTransformOutput(output, config.quantity, config.unit)) errors.push('incompatible_output');
	if (!source) return errors;
	const device = (source.channel as ChannelEntity)?.device as DeviceEntity;
	const unit = resolvePropertyUnit(source);
	if (
		!device ||
		device.type === 'virtual' ||
		![
			DataTypeType.FLOAT,
			DataTypeType.CHAR,
			DataTypeType.UCHAR,
			DataTypeType.SHORT,
			DataTypeType.USHORT,
			DataTypeType.INT,
			DataTypeType.UINT,
		].includes(source.dataType) ||
		!source.permissions?.some((permission) =>
			[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
		) ||
		typeof unit !== 'string' ||
		!unit.length ||
		(source.unit != null && source.unit !== unit) ||
		(binding && (binding.quantity !== String(source.category) || binding.unit !== unit))
	)
		errors.push('incompatible_source');
	if (
		[VirtualNumericTransformOperator.NTC_BETA, VirtualNumericTransformOperator.STEINHART_HART].includes(
			config.policy?.operator,
		) &&
		((source.category !== PropertyCategory.VOLTAGE &&
			!(
				source instanceof ShellyNgChannelPropertyEntity &&
				(source.channel as ChannelEntity)?.device instanceof ShellyNgDeviceEntity &&
				(source.channel as ChannelEntity).category === ChannelCategory.ANALOG_INPUT &&
				source.category === PropertyCategory.VALUE &&
				source.identifier === 'voltage' &&
				source.permissions?.includes(PermissionType.READ_ONLY) &&
				!source.permissions.some((permission) =>
					[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
				) &&
				hasQualifiedRawVoltageIdentity((source.channel as ChannelEntity).identifier)
			)) ||
			unit !== 'V' ||
			config.quantity !== String(PropertyCategory.TEMPERATURE) ||
			config.unit !== '°C')
	)
		errors.push('incompatible_ntc_semantics');
	return errors;
}
