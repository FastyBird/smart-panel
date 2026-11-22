import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { AutomationStatus } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

import AutomationsRowList from './automations-row-list.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key, locale: ref('en-US') }),
}));

const automation = (id: string, overrides: Partial<IAutomation> = {}): IAutomation =>
	({
		id,
		name: `Automation ${id}`,
		enabled: true,
		status: AutomationStatus.ok,
		lastTriggeredAt: null,
		icon: null,
		...overrides,
	}) as unknown as IAutomation;

const render = (props: Partial<InstanceType<typeof AutomationsRowList>['$props']> = {}) =>
	mount(AutomationsRowList, { props: { items: [], loading: false, filtersActive: false, updating: [], ...props } });

describe('AutomationsRowList', () => {
	it('lists every automation with its status and last run, and opens it', async () => {
		const wrapper = render({ items: [automation('a'), automation('b', { status: AutomationStatus.invalid })] });

		const rows = wrapper.findAll('[data-test-id="automations-row"]');

		expect(rows).toHaveLength(2);
		expect(rows[0].text()).toContain('Automation a');
		expect(rows[0].text()).toContain('automations.fields.neverRun');
		expect(rows[1].text()).toContain('automations.statuses.invalid.title');

		await rows[1].trigger('click');

		expect(wrapper.emitted('edit')).toEqual([['b']]);
	});

	it('switches an automation on or off without opening it', async () => {
		const wrapper = render({ items: [automation('a', { enabled: false })] });

		await wrapper.get('[data-test-id="toggle-automation"]').trigger('click');

		expect(wrapper.emitted('toggle-enabled')).toEqual([['a', true]]);
		expect(wrapper.emitted('edit')).toBeUndefined();
	});

	it('offers to load again when the list could not be read', async () => {
		const wrapper = render({ loadFailed: true });

		await wrapper.get('[data-test-id="retry-load"]').trigger('click');

		expect(wrapper.emitted('retry')).toHaveLength(1);
	});

	it('offers to reset the filters when they hide every automation', async () => {
		const wrapper = render({ filtersActive: true });

		expect(wrapper.text()).toContain('automations.texts.noFilteredAutomations');

		await wrapper.find('button').trigger('click');

		expect(wrapper.emitted('reset-filters')).toHaveLength(1);
	});
});
