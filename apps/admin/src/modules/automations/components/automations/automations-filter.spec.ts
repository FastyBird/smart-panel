import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import AutomationsFilter from './automations-filter.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('AutomationsFilter', (): void => {
	it('names its buttons, which show an icon only', (): void => {
		const wrapper = mount(AutomationsFilter, {
			props: {
				filters: { search: undefined, spaceId: undefined, enabled: 'all', statuses: [] },
				filtersActive: true,
			},
		});

		expect(wrapper.find('[data-test-id="reset-filters"]').attributes('aria-label')).toBe('automations.buttons.resetFilters.title');
		expect(wrapper.find('[data-test-id="adjust-list"]').attributes('aria-label')).toBe('automations.headings.adjustFilters');

		wrapper.unmount();
	});

	it('keeps the page when Enter is pressed in the search', (): void => {
		const wrapper = mount(AutomationsFilter, {
			props: {
				filters: { search: undefined, spaceId: undefined, enabled: 'all', statuses: [] },
				filtersActive: false,
			},
		});

		const submit = new Event('submit', { cancelable: true });

		wrapper.find('form').element.dispatchEvent(submit);

		expect(submit.defaultPrevented).toBe(true);

		wrapper.unmount();
	});
});
