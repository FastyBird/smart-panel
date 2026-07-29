import { describe, expect, it } from 'vitest';

import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';

import { locales } from './index';

type CategoryGroup = 'devices' | 'channels' | 'channelsProperties';

const CATEGORY_GROUPS: { group: CategoryGroup; values: string[] }[] = [
	{ group: 'devices', values: Object.values(DevicesModuleDeviceCategory) },
	{ group: 'channels', values: Object.values(DevicesModuleChannelCategory) },
	{ group: 'channelsProperties', values: Object.values(DevicesModuleChannelPropertyCategory) },
];

const readGroup = (messages: Record<string, unknown>, group: CategoryGroup): Record<string, unknown> => {
	const categories = messages.categories as Record<string, unknown> | undefined;

	return (categories?.[group] as Record<string, unknown> | undefined) ?? {};
};

describe('Devices module locales', () => {
	describe.each(Object.keys(locales))('%s', (locale: string): void => {
		it.each(CATEGORY_GROUPS)('translates every $group category', ({ group, values }): void => {
			const translations = readGroup(locales[locale], group);

			const missing = values.filter((value) => typeof translations[value] !== 'string' || translations[value] === '');

			expect(missing, `Missing "${group}" category translations in ${locale}: ${missing.join(', ')}`).toEqual([]);
		});
	});
});
