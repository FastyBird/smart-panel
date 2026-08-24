import { describe, expect, it } from 'vitest';

import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IWizardRowStatus } from '../components/wizard/device-wizard.types';

import { locales } from './index';

type CategoryGroup = 'devices' | 'channels' | 'channelsProperties';

const CATEGORY_GROUPS: { group: CategoryGroup; values: string[] }[] = [
	{ group: 'devices', values: Object.values(DevicesModuleDeviceCategory) },
	{ group: 'channels', values: Object.values(DevicesModuleChannelCategory) },
	{ group: 'channelsProperties', values: Object.values(DevicesModuleChannelPropertyCategory) },
];

const WIZARD_STATUSES: IWizardRowStatus[] = ['checking', 'ready', 'needs_credentials', 'already_registered', 'unsupported', 'failed'];
const WIZARD_RESULT_STATUSES = ['created', 'updated', 'skipped', 'failed'] as const;

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

	describe.each(Object.keys(locales))('%s wizard', (locale: string): void => {
		it('translates every wizard row status', (): void => {
			const wizard = locales[locale].wizard as Record<string, unknown> | undefined;
			const statuses = (wizard?.statuses as Record<string, unknown> | undefined) ?? {};

			const missing = WIZARD_STATUSES.filter((status) => typeof statuses[status] !== 'string' || statuses[status] === '');

			expect(missing, `Missing wizard status translations in ${locale}: ${missing.join(', ')}`).toEqual([]);
		});

		it('translates every wizard result status', (): void => {
			const wizard = locales[locale].wizard as Record<string, unknown> | undefined;
			const statuses = (wizard?.statuses as Record<string, unknown> | undefined) ?? {};
			const missing = WIZARD_RESULT_STATUSES.filter((status) => typeof statuses[status] !== 'string' || statuses[status] === '');

			expect(missing, `Missing wizard result status translations in ${locale}: ${missing.join(', ')}`).toEqual([]);
		});
	});
});
