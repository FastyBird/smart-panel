import { channelsSchema } from '../../../spec/channels';
import { ChannelCategory, PropertyCategory } from '../devices.constants';

import { getAllProperties, getChannelConstraints, getPropertyMetadata, getRequiredProperties } from './schema.utils';

/**
 * These utilities are the only route from the specification into the rest of the backend: the
 * virtual-device wizard offers what `getAllProperties` reports, `reportCompatibility` judges against
 * `getPropertyMetadata`, and `DeviceValidationService` reads both. A key they cannot translate does
 * not exist as far as any of that is concerned — which is what two hand-maintained tables did to a
 * third of the specification, silently.
 *
 * So what is asserted here is coverage against the specification itself rather than a list of keys
 * copied out of it: a test that named the properties it expected would be a third table to keep in
 * step with the other two.
 */
describe('schema utils against the specification', () => {
	const channels = Object.keys(channelsSchema) as ChannelCategory[];

	it('translates every property the specification declares, in every channel', () => {
		const untranslated: string[] = [];

		for (const channel of channels) {
			const spec = channelsSchema[channel] as { properties?: Record<string, { category?: string }> };
			const declared = Object.entries(spec.properties ?? {})
				// `generic` is a channel's untyped escape hatch, not a category anything is matched against.
				.filter(([, property]) => property.category !== PropertyCategory.GENERIC);
			const reported = getAllProperties(channel).map((property) => property.category);

			for (const [key, property] of declared) {
				if (!reported.includes(property.category as PropertyCategory)) {
					untranslated.push(`${channel}.${key}`);
				}
			}
		}

		expect(untranslated).toEqual([]);
	});

	// The reverse direction, which had its own table and its own omissions: metadata is what a
	// projection is judged against, so a property the wizard offers and the guard cannot describe is
	// refused with a message that reads like a specification error.
	it('describes every property it reports', () => {
		const undescribed: string[] = [];

		for (const channel of channels) {
			for (const property of getAllProperties(channel)) {
				if (getPropertyMetadata(channel, property.category) === null) {
					undescribed.push(`${channel}.${property.category}`);
				}
			}
		}

		expect(undescribed).toEqual([]);
	});

	// A key is a name within a channel; the category is what the entry declares. They are usually the
	// same and deliberately are not always, and translating the key gets that case wrong both ways —
	// the wizard would offer a slot the metadata lookup then cannot find.
	it('follows the declared category where it differs from the key', () => {
		const categories = getAllProperties(ChannelCategory.INDICATOR).map((property) => property.category);

		expect(categories).toContain(PropertyCategory.COLOR_RED);
		expect(getPropertyMetadata(ChannelCategory.INDICATOR, PropertyCategory.COLOR_RED)).toEqual(
			expect.objectContaining({ category: PropertyCategory.COLOR_RED, format: expect.any(Array) as string[] }),
		);
	});

	// Spot checks on what was invisible, named because these are the ones the energy work ran into:
	// the claim guard needs two energy slots to disagree and could only ever reach one.
	it('reports the energy slots a virtual device could not reach', () => {
		const categories = getAllProperties(ChannelCategory.ELECTRICAL_ENERGY).map((property) => property.category);

		expect(categories).toEqual(expect.arrayContaining([PropertyCategory.GRID_IMPORT, PropertyCategory.GRID_EXPORT]));
	});

	it('requires what the specification marks required', () => {
		expect(getRequiredProperties(ChannelCategory.ACCELEROMETER)).toEqual(
			expect.arrayContaining([
				PropertyCategory.ACCELERATION_X,
				PropertyCategory.ACCELERATION_Y,
				PropertyCategory.ACCELERATION_Z,
			]),
		);
	});

	// A constraint group names properties by key, and a key that could not be translated was dropped
	// from the group — which quietly turned "aqi or level" into "level", refusing an air-quality
	// channel that reports an index and no level.
	it('keeps every property of a constraint group', () => {
		expect(getChannelConstraints(ChannelCategory.AIR_QUALITY)?.oneOrMoreOf).toEqual([
			[PropertyCategory.AQI, PropertyCategory.LEVEL],
		]);
	});

	it('translates nothing for a channel the specification does not define', () => {
		expect(getAllProperties('not-a-channel' as ChannelCategory)).toEqual([]);
		expect(getRequiredProperties('not-a-channel' as ChannelCategory)).toEqual([]);
		expect(getChannelConstraints('not-a-channel' as ChannelCategory)).toBeNull();
	});
});
