import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { VirtualDeviceMode, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualAggregateOperator, VirtualAggregateProfile } from '../entities/virtual-producer.entity';

import {
	aggregateOperatorAllowed,
	aggregateProfile,
	aggregateProfiles,
	aggregateValueAllowed,
	isEligibleAggregateOutput,
	isEligibleAggregateSource,
} from './virtual-numeric-profile.utils';
import { isEligibleVirtualMeasurement } from './virtual-source-eligibility.utils';
import { isThermostatTemperature } from './virtual-thermostat-contract.utils';

const fixture = (id: VirtualAggregateProfile, virtual = false) => {
	const profile = aggregateProfiles.find((item) => item.id === id);
	const device = {
		type: virtual ? 'virtual' : 'physical',
		category: DeviceCategory.SENSOR,
		mode: VirtualDeviceMode.SENSOR_AGGREGATE,
	} as unknown as DeviceEntity;
	const channel = Object.assign(new ChannelEntity(), { category: profile.channel, device });
	const property = Object.assign(new ChannelPropertyEntity(), {
		category: profile.quantity,
		dataType: profile.dataTypes[0],
		measurementQuantity: undefined as string | undefined,
		permissions: [PermissionType.READ_ONLY],
		unit: profile.unit,
		channel,
		valueOrigin: VirtualValueOrigin.DERIVED,
	});
	return { profile, property, channel, device };
};

describe('closed aggregate capability policy', () => {
	it.each(aggregateProfiles.map((profile) => profile.id))(
		'admits only exact canonical %s metadata and operators',
		(id) => {
			const { profile, property, channel, device } = fixture(id);
			expect(aggregateProfile(property, channel)).toBe(profile);
			expect(isEligibleAggregateSource(property, channel, device)).toBe(true);
			for (const operator of Object.values(VirtualAggregateOperator))
				expect(aggregateOperatorAllowed(profile, operator)).toBe(
					profile.binary === [VirtualAggregateOperator.ANY, VirtualAggregateOperator.ALL].includes(operator),
				);
			property.unit = 'wrong';
			expect(aggregateProfile(property, channel)).toBeUndefined();
			property.unit = profile.unit;
			property.dataType = DataTypeType.STRING;
			expect(aggregateProfile(property, channel)).toBeUndefined();
		},
	);

	it('keeps CO2 exact, rejects alarm channels and cross-quantity/profile composition', () => {
		const { property, channel, device } = fixture(VirtualAggregateProfile.CARBON_DIOXIDE);
		channel.category = ChannelCategory.CARBON_MONOXIDE;
		expect(isEligibleAggregateSource(property, channel, device)).toBe(false);
		property.category = PropertyCategory.DETECTED;
		property.dataType = DataTypeType.BOOL;
		property.unit = null;
		expect(isEligibleAggregateSource(property, channel, device)).toBe(false);
		channel.category = ChannelCategory.SMOKE;
		expect(aggregateProfile(property, channel)).toBeUndefined();
	});

	it.each(aggregateProfiles.map((profile) => profile.id))(
		'prevents %s nesting while retaining temperature-only thermostat composition',
		(id) => {
			const { property, channel, device, profile } = fixture(id, true);
			expect(isEligibleAggregateOutput(property, channel, device)).toBe(true);
			expect(isEligibleAggregateSource(property, channel, device)).toBe(false);
			expect(isEligibleVirtualMeasurement(property, channel, device)).toBe(id === VirtualAggregateProfile.TEMPERATURE);
			expect(isThermostatTemperature(property, channel)).toBe(id === VirtualAggregateProfile.TEMPERATURE);
			Object.assign(device, { mode: VirtualDeviceMode.SENSOR_TRANSFORM });
			expect(isEligibleAggregateSource(property, channel, device)).toBe(id === VirtualAggregateProfile.TEMPERATURE);
			property.measurementQuantity = 'dew_point';
			expect(isEligibleAggregateSource(property, channel, device)).toBe(false);
			expect(isThermostatTemperature(property, channel)).toBe(false);
			if (!profile.binary && profile.outputStep != null) {
				Object.assign(device, { mode: VirtualDeviceMode.SENSOR_AGGREGATE });
				property.measurementQuantity = profile.quantity;
				property.step = profile.outputStep * 2;
				expect(isEligibleAggregateOutput(property, channel, device)).toBe(false);
			}
		},
	);

	it('declares numeric domains and precision and keeps qualitative lux optional', () => {
		const humidity = fixture(VirtualAggregateProfile.HUMIDITY).profile;
		expect(humidity.dataTypes).toEqual([DataTypeType.UCHAR]);
		for (const value of [0, 100]) expect(aggregateValueAllowed(humidity, value)).toBe(true);
		for (const value of [-1, 101, Infinity, '50']) expect(aggregateValueAllowed(humidity, value)).toBe(false);
		expect(humidity.outputStep).toBe(1);
		expect(fixture(VirtualAggregateProfile.CARBON_DIOXIDE).profile.outputStep).toBe(1);
		expect(fixture(VirtualAggregateProfile.ILLUMINANCE).profile.outputStep).toBe(0.1);
		expect(getRequiredProperties(ChannelCategory.ILLUMINANCE)).toEqual([PropertyCategory.ILLUMINANCE]);
	});
});
