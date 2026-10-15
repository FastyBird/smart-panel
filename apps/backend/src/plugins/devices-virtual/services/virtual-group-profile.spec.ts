import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import {
	commonGroupCapabilities,
	groupBooleanContractIsSupported,
	groupField,
	groupSourceSupports,
	reportGroup,
} from './virtual-group-profile';
import { commonLightCapabilities, reportLightGroup } from './virtual-light-group.utils';

const property = (category: PropertyCategory, permissions = [PermissionType.READ_WRITE], extra = {}) =>
	Object.assign(new ChannelPropertyEntity(), {
		category,
		dataType: DataTypeType.BOOL,
		permissions,
		format: null,
		step: null,
		...extra,
	});
const member = (identity: string, on: boolean | null, inUse: boolean | null = null) => ({
	identity,
	samples: new Map<PropertyCategory, QualifiedPropertySample>([
		...(on === null ? [] : [[PropertyCategory.ON, { value: on } as QualifiedPropertySample] as const]),
		...(inUse === null ? [] : [[PropertyCategory.IN_USE, { value: inUse } as QualifiedPropertySample] as const]),
	]),
});
describe('typed group profile contracts', () => {
	it('keeps the full light numeric/grid/color contract and reported representatives identical', () => {
		const properties = [
			property(PropertyCategory.ON),
			...[
				PropertyCategory.BRIGHTNESS,
				PropertyCategory.HUE,
				PropertyCategory.SATURATION,
				PropertyCategory.COLOR_RED,
				PropertyCategory.COLOR_GREEN,
				PropertyCategory.COLOR_BLUE,
				PropertyCategory.COLOR_TEMPERATURE,
			].map((category) =>
				property(category, [PermissionType.READ_WRITE], { dataType: DataTypeType.FLOAT, format: [0, 100], step: 1 }),
			),
		];
		expect(commonGroupCapabilities(VirtualLightGroupProfile.LIGHT, [properties, properties])).toEqual(
			commonLightCapabilities([properties, properties]),
		);
		const members = [member('a', true), member('b', false), member('missing', null)];
		expect(reportGroup(VirtualLightGroupProfile.LIGHT, members)).toEqual(reportLightGroup(members));
	});
	it.each([VirtualLightGroupProfile.SWITCH, VirtualLightGroupProfile.OUTLET])(
		'restricts %s to boolean profile fields and requires complete ON access',
		(profile) => {
			const on = property(PropertyCategory.ON);
			const inUse = property(PropertyCategory.IN_USE, [PermissionType.READ_ONLY]);
			const members = [
				[on, inUse, property(PropertyCategory.POWER)],
				[on, inUse],
			];
			expect(commonGroupCapabilities(profile, members).map((capability) => capability.category)).toEqual(
				profile === VirtualLightGroupProfile.SWITCH
					? [PropertyCategory.ON]
					: [PropertyCategory.ON, PropertyCategory.IN_USE],
			);
			for (const extra of [
				{ dataType: DataTypeType.INT },
				{ permissions: [PermissionType.WRITE_ONLY] },
				{ permissions: [PermissionType.READ_ONLY] },
				{ format: [0, 1] },
			]) {
				expect(commonGroupCapabilities(profile, [[on], [property(PropertyCategory.ON, undefined, extra)]])).toEqual([]);
			}
			expect(commonGroupCapabilities(profile, [[on], [on, on]])).toEqual([]);
		},
	);

	it.each([VirtualLightGroupProfile.SWITCH, VirtualLightGroupProfile.OUTLET])(
		'requires a complete boolean domain for %s instead of advertising an unenforced enum',
		(profile) => {
			for (const format of [null, [], ['true', 'false'], ['FALSE', 'True']]) {
				const on = property(PropertyCategory.ON, undefined, { format });
				expect(groupBooleanContractIsSupported(profile, on)).toBe(true);
				expect(commonGroupCapabilities(profile, [[on], [on]])[0]).toMatchObject({
					category: PropertyCategory.ON,
					format: null,
				});
			}
			for (const format of [
				['true'],
				['false'],
				['true', 'true'],
				['true', 'garbage'],
				[' true', 'false'],
				[0, 1],
				[true, false],
				'true,false',
			]) {
				const on = property(PropertyCategory.ON, undefined, { format });
				expect(groupBooleanContractIsSupported(profile, on)).toBe(false);
				expect(commonGroupCapabilities(profile, [[on], [on]])).toEqual([]);
				expect(commonGroupCapabilities(profile, [[property(PropertyCategory.ON)], [on]])).toEqual([]);
				const inUse = property(PropertyCategory.IN_USE, [PermissionType.READ_ONLY], { format });
				expect(commonGroupCapabilities(profile, [[inUse], [inUse]])).toEqual([]);
			}
		},
	);
	it('preserves legacy light admission even for constrained boolean metadata', () => {
		const on = property(PropertyCategory.ON, undefined, { format: ['true'] });
		expect(groupBooleanContractIsSupported(VirtualLightGroupProfile.LIGHT, on)).toBe(true);
		expect(commonGroupCapabilities(VirtualLightGroupProfile.LIGHT, [[on], [on]])).toEqual(
			commonLightCapabilities([[on], [on]]),
		);
	});
	it('distinguishes RO, RW and WO source contracts without making observations commandable', () => {
		const read = property(PropertyCategory.IN_USE, [PermissionType.READ_ONLY]);
		const write = property(PropertyCategory.IN_USE, [PermissionType.WRITE_ONLY]);
		expect(groupSourceSupports(read, groupField(VirtualLightGroupProfile.OUTLET, PropertyCategory.IN_USE))).toBe(true);
		expect(groupSourceSupports(write, groupField(VirtualLightGroupProfile.OUTLET, PropertyCategory.IN_USE))).toBe(
			false,
		);
		expect(groupSourceSupports(write, { category: PropertyCategory.IN_USE, access: 'wo' })).toBe(true);
		expect(groupSourceSupports(read, { category: PropertyCategory.IN_USE, access: 'wo' })).toBe(false);
	});
	it.each([VirtualLightGroupProfile.SWITCH, VirtualLightGroupProfile.OUTLET])(
		'retains %s mixed/unknown ON counts and optional in-use agreement',
		(profile) => {
			const state = reportGroup(profile, [member('a', true, true), member('b', false, false), member('missing', null)]);
			expect(state).toMatchObject({ on: true, allOn: false, mixed: true, unknownCount: 1, total: 3 });
			expect([...state.properties.keys()]).toEqual(
				profile === VirtualLightGroupProfile.OUTLET
					? [PropertyCategory.ON, PropertyCategory.IN_USE]
					: [PropertyCategory.ON],
			);
			if (profile === VirtualLightGroupProfile.OUTLET) {
				expect(state.properties.get(PropertyCategory.IN_USE)).toMatchObject({ value: null, mixed: true });
				expect(
					reportGroup(profile, [member('a', false, true), member('b', false, true)]).properties.get(
						PropertyCategory.IN_USE,
					).value,
				).toBe(true);
				expect(
					reportGroup(profile, [member('a', false, true), member('b', false)]).properties.get(PropertyCategory.IN_USE)
						.value,
				).toBeNull();
			}
		},
	);
});
