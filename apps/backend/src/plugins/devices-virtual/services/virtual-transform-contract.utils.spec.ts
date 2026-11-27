import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';

import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { transformContractErrors } from './virtual-transform-contract.utils';

it('accepts a provider-defined analog voltage input for a Celsius converter only with matching read-only metadata', () => {
	const device = Object.assign(new VirtualDeviceEntity(), {
		category: DeviceCategory.SENSOR,
		mode: VirtualDeviceMode.SENSOR_TRANSFORM,
	});
	const output = Object.assign(new VirtualChannelPropertyEntity(), {
		channel: Object.assign(new ChannelEntity(), { category: ChannelCategory.TEMPERATURE, device }),
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		valueOrigin: VirtualValueOrigin.DERIVED,
	});
	const source: ChannelPropertyEntity = Object.assign(new ChannelPropertyEntity(), {
		channel: Object.assign(new ChannelEntity(), { category: ChannelCategory.ANALOG_INPUT, device: new DeviceEntity() }),
		identifier: 'transducer',
		category: PropertyCategory.VALUE,
		dataType: DataTypeType.FLOAT,
		permissions: [PermissionType.READ_ONLY],
		measurementUnit: () => 'V',
	});
	const config = Object.assign(new VirtualTransformConfigEntity(), {
		schemaVersion: 1,
		quantity: 'temperature',
		unit: '°C',
		maximumAgeSeconds: 10,
		policy: {
			operator: VirtualNumericTransformOperator.NTC_BETA,
			inputRange: { minimum: 0.1, maximum: 3.2 },
			outputRange: { minimum: -100, maximum: 150 },
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			nominalResistance: 10000,
			nominalTemperatureCelsius: 25,
			beta: 3950,
			thermistorLeg: 'low',
		},
	});
	expect(transformContractErrors(config, output, source)).toEqual([]);
	source.measurementUnit = () => 'mV';
	expect(transformContractErrors(config, output, source)).toContain('incompatible_ntc_semantics');
	source.measurementUnit = () => 'V';
	source.permissions = [PermissionType.READ_WRITE];
	expect(transformContractErrors(config, output, source)).toContain('incompatible_ntc_semantics');
});
