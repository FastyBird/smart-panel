import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';

import { commonLightCapabilities, reportLightGroup } from './virtual-light-group.utils';

const property = (category: PropertyCategory, overrides: Partial<ChannelPropertyEntity> = {}): ChannelPropertyEntity =>
	Object.assign(new ChannelPropertyEntity(), {
		category,
		dataType: category === PropertyCategory.ON ? DataTypeType.BOOL : DataTypeType.FLOAT,
		permissions: [PermissionType.READ_WRITE],
		format: null,
		step: null,
		...overrides,
	});
const sample = (value: boolean | number): QualifiedPropertySample => ({
	propertyId: 'source',
	value,
	sampledAt: new Date(),
	receivedAt: new Date(),
	provenance: 'live',
	quality: 'good',
	reasons: [],
});
const member = (identity: string, on?: boolean, brightness?: number) => ({
	identity,
	samples: new Map<PropertyCategory, QualifiedPropertySample>([
		...(on === undefined ? [] : [[PropertyCategory.ON, sample(on)] as const]),
		...(brightness === undefined ? [] : [[PropertyCategory.BRIGHTNESS, sample(brightness)] as const]),
	]),
});

describe('light group reported state', () => {
	it('keeps missing members intended and uses three-valued any-on/all-on', () => {
		expect(reportLightGroup([member('a', false), member('missing')])).toMatchObject({
			on: null,
			allOn: false,
			total: 2,
			unknownCount: 1,
		});
		expect(reportLightGroup([member('a', true), member('missing')])).toMatchObject({
			on: true,
			allOn: null,
			unknownCount: 1,
		});
		expect(reportLightGroup([member('a', false), member('b', false)])).toMatchObject({
			on: false,
			allOn: false,
			unknownCount: 0,
		});
		expect(reportLightGroup([member('a', true), member('b', false)])).toMatchObject({
			on: true,
			mixed: true,
			onCount: 1,
			offCount: 1,
		});
	});
	it('averages only valid on-member brightness and explicitly reports mixed/contributors', () => {
		const state = reportLightGroup([
			member('a', true, 20),
			member('b', true, 80),
			member('off', false, 100),
			member('unknown', undefined, 50),
		]);
		expect(state.properties.get(PropertyCategory.BRIGHTNESS)).toMatchObject({
			value: 50,
			mixed: true,
			contributors: ['a', 'b'],
		});
	});
	it('uses temperature consensus tolerance without averaging disagreeing members', () => {
		const a = member('a', true);
		const b = member('b', true);
		a.samples.set(PropertyCategory.COLOR_TEMPERATURE, sample(3000));
		b.samples.set(PropertyCategory.COLOR_TEMPERATURE, sample(3010));
		expect(reportLightGroup([a, b]).properties.get(PropertyCategory.COLOR_TEMPERATURE)).toMatchObject({
			value: 3000,
			mixed: false,
		});
		b.samples.set(PropertyCategory.COLOR_TEMPERATURE, sample(4000));
		expect(reportLightGroup([a, b]).properties.get(PropertyCategory.COLOR_TEMPERATURE)).toMatchObject({
			value: null,
			mixed: true,
		});
	});
});

describe('light group common capability contract', () => {
	it('omits optional dimming and incomplete color tuples across all intended members', () => {
		const on = property(PropertyCategory.ON);
		const red = property(PropertyCategory.COLOR_RED);
		expect(
			commonLightCapabilities([
				[on, property(PropertyCategory.BRIGHTNESS), red],
				[on, red],
			]).map((capability) => capability.category),
		).toEqual([PropertyCategory.ON]);
	});
	it('intersects range/step and refuses incompatible grids, types and permissions', () => {
		const a = property(PropertyCategory.BRIGHTNESS, { format: [0, 100], step: 1 });
		const b = property(PropertyCategory.BRIGHTNESS, { format: [10, 90], step: 5 });
		expect(commonLightCapabilities([[a], [b]])[0]).toMatchObject({ format: [10, 90], step: 5 });
		expect(
			commonLightCapabilities([[property(PropertyCategory.BRIGHTNESS, { format: [0, 100], step: 2 })], [b]]),
		).toHaveLength(0);
		expect(
			commonLightCapabilities([
				[a],
				[property(PropertyCategory.BRIGHTNESS, { permissions: [PermissionType.READ_ONLY] })],
			]),
		).toHaveLength(0);
		expect(
			commonLightCapabilities([[a], [property(PropertyCategory.BRIGHTNESS, { dataType: DataTypeType.UINT })]]),
		).toHaveLength(0);
	});
});
