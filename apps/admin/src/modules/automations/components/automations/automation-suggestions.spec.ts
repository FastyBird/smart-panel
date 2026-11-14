import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { AutomationMode } from '../../automations.constants';
import type { IAutomationSuggestion } from '../../composables/types';

import AutomationSuggestions from './automation-suggestions.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const suggestion = (id: string): IAutomationSuggestion => ({
	id,
	title: 'Automate this routine?',
	reason: `You perform 2 actions in Living Room around 7 PM regularly (${id}).`,
	spaceId: 'space-1',
	draft: { name: `Living Room Evening ${id}`, mode: AutomationMode.single, graph: { version: 1, nodes: [], edges: [] } },
});

describe('AutomationSuggestions', () => {
	it('shows nothing without suggestions', () => {
		const wrapper = mount(AutomationSuggestions, { props: { suggestions: [] } });

		expect(wrapper.find('[data-test-id="automation-suggestions"]').exists()).toBe(false);
	});

	it('lists the suggested automations and hands on what is asked for them', async () => {
		const first = suggestion('a');
		const second = suggestion('b');

		const wrapper = mount(AutomationSuggestions, { props: { suggestions: [first, second], answering: ['b'] } });

		const items = wrapper.findAll('[data-test-suggestion]');

		expect(items).toHaveLength(2);
		expect(items[0].text()).toContain('Living Room Evening a');
		expect(items[0].text()).toContain(first.reason);

		await items[0].find('[data-test-id="automation-suggestion-open"]').trigger('click');
		await items[0].find('[data-test-id="automation-suggestion-dismiss"]').trigger('click');

		expect(wrapper.emitted('open')).toEqual([[first]]);
		expect(wrapper.emitted('dismiss')).toEqual([[first]]);

		// One whose answer is on its way can not be answered again
		expect(items[1].find('[data-test-id="automation-suggestion-open"]').attributes('disabled')).toBeDefined();
		expect(items[1].find('[data-test-id="automation-suggestion-dismiss"]').attributes('disabled')).toBeDefined();
	});
});
