import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { commonGroupCapabilities, groupField, reportGroup } from './virtual-group-profile';
import { typedGroupSourceMatchesOutput } from './virtual-typed-group.utils';

const native = (
	profile: VirtualLightGroupProfile,
	category: PropertyCategory,
	dataType: DataTypeType,
	format: readonly (string | number)[] | null = null,
	step: number | null = null,
	permissions = [PermissionType.READ_WRITE],
) =>
	Object.assign(new ChannelPropertyEntity(), {
		category,
		dataType,
		format: format === null ? null : ([...format] as string[] | number[]),
		step,
		permissions,
		channel: Object.assign(new ChannelEntity(), {
			category: profile === VirtualLightGroupProfile.FAN ? ChannelCategory.FAN : ChannelCategory.WINDOW_COVERING,
		}),
	});
const fan = VirtualLightGroupProfile.FAN;
const cover = VirtualLightGroupProfile.COVER;
const samples = (identity: string, values: Partial<Record<PropertyCategory, string | number | boolean>>) => ({
	identity,
	samples: new Map(
		Object.entries(values).map(([category, value]) => [
			category as PropertyCategory,
			{ value } as QualifiedPropertySample,
		]),
	),
});

describe('fan and cover native contracts', () => {
	for (const [profile, category, type, a, stepA, b, stepB, expected, step] of [
		[fan, PropertyCategory.SPEED, DataTypeType.UCHAR, [0, 100], 1, [20, 80], 2, [20, 80], 2],
		[cover, PropertyCategory.TILT, DataTypeType.FLOAT, [-90, 90], 0.5, [-60, 60], 0.3, [-60, 60], 1.5],
		[cover, PropertyCategory.POSITION, DataTypeType.UCHAR, [0, 100], 2, [1, 99], 2, null, null],
	] as const) {
		it(`intersects native ${profile}/${category} ranges and exact decimal grids`, () => {
			const result = commonGroupCapabilities(profile, [
				[native(profile, category, type, a, stepA)],
				[native(profile, category, type, b, stepB)],
			]);
			expect(result).toEqual(expected ? [expect.objectContaining({ category, format: expected, step })] : []);
		});
	}

	it('keeps percentage and discrete speed distinct and excludes specialty fields', () => {
		const percent = native(fan, PropertyCategory.SPEED, DataTypeType.UCHAR, [0, 100], 1);
		const discrete = native(fan, PropertyCategory.SPEED, DataTypeType.ENUM, ['low', 'high']);
		expect(commonGroupCapabilities(fan, [[percent], [discrete]])).toEqual([]);
		expect(
			commonGroupCapabilities(fan, [
				[discrete],
				[native(fan, PropertyCategory.SPEED, DataTypeType.ENUM, ['medium', 'high'])],
			])[0].format,
		).toEqual(['high']);
		const specialty = native(fan, PropertyCategory.NATURAL_BREEZE, DataTypeType.BOOL);
		expect(commonGroupCapabilities(fan, [[specialty], [specialty]])).toEqual([]);
	});
	it.each([
		[PropertyCategory.SPEED, DataTypeType.UCHAR, [0, 101]],
		[PropertyCategory.SPEED, DataTypeType.FLOAT, [0, 100]],
		[PropertyCategory.DIRECTION, DataTypeType.ENUM, ['forward']],
		[PropertyCategory.MODE, DataTypeType.ENUM, []],
		[PropertyCategory.SWING, DataTypeType.BOOL, ['true']],
	] as const)('rejects unsupported fan metadata %s/%s/%s', (category, type, format) => {
		const p = native(fan, category, type, [...format]);
		expect(commonGroupCapabilities(fan, [[p], [p]])).toEqual([]);
	});
	it('requires a singleton identical covering type and a compatible complete command set', () => {
		for (const [a, b, supported] of [
			[['blind'], ['blind'], true],
			[['blind'], ['curtain'], false],
			[['blind', 'curtain'], ['blind', 'curtain'], false],
		] as const) {
			const result = commonGroupCapabilities(cover, [
				[native(cover, PropertyCategory.TYPE, DataTypeType.ENUM, [...a], null, [PermissionType.READ_ONLY])],
				[native(cover, PropertyCategory.TYPE, DataTypeType.ENUM, [...b], null, [PermissionType.READ_ONLY])],
			]);
			expect(result.length > 0).toBe(supported);
		}
		const command = native(cover, PropertyCategory.COMMAND, DataTypeType.ENUM, ['open', 'close', 'stop'], null, [
			PermissionType.WRITE_ONLY,
		]);
		expect(commonGroupCapabilities(cover, [[command], [command]])[0].format).toEqual(['open', 'close', 'stop']);
		expect(
			commonGroupCapabilities(cover, [
				[command],
				[Object.assign(new ChannelPropertyEntity(), command, { format: ['open', 'stop'] })],
			]),
		).toEqual([]);
	});
	it.each([PermissionType.READ_ONLY, PermissionType.WRITE_ONLY])(
		'does not admit %s speed as a read/write control',
		(permission) => {
			const p = native(fan, PropertyCategory.SPEED, DataTypeType.UCHAR, [0, 100], 1, [permission]);
			expect(commonGroupCapabilities(fan, [[p], [p]])).toEqual([]);
		},
	);
	it('requires agreement for numeric/enum feedback including powered-off fans and never fabricates stopped', () => {
		for (const [profile, category, a, b] of [
			[fan, PropertyCategory.SPEED, 20, 80],
			[cover, PropertyCategory.POSITION, 20, 80],
			[cover, PropertyCategory.STATUS, 'opening', 'closing'],
		] as const) {
			const state = reportGroup(profile, [
				samples('a', { [category]: a, on: false }),
				samples('b', { [category]: b, on: false }),
			]);
			expect(state.properties.get(category)).toMatchObject({ value: null, mixed: true });
			expect(
				reportGroup(profile, [samples('a', { [category]: a }), samples('b', {})]).properties.get(category).value,
			).toBeNull();
			expect(
				reportGroup(profile, [samples('a', { [category]: a }), samples('b', { [category]: a })]).properties.get(
					category,
				).value,
			).toBe(a);
		}
		expect(
			reportGroup(cover, [samples('a', { command: 'stop' }), samples('b', { command: 'stop' })]).properties.get(
				PropertyCategory.COMMAND,
			).value,
		).toBeNull();
	});
	it('revalidates native domains and step origins after metadata edits', () => {
		const output = native(cover, PropertyCategory.TILT, DataTypeType.FLOAT, [-60, 60], 1.5);
		const source = native(cover, PropertyCategory.TILT, DataTypeType.FLOAT, [-90, 90], 0.5);
		expect(typedGroupSourceMatchesOutput(cover, groupField(cover, PropertyCategory.TILT), source, output)).toBe(true);
		source.format = [-59, 60];
		expect(typedGroupSourceMatchesOutput(cover, groupField(cover, PropertyCategory.TILT), source, output)).toBe(false);
	});
});
