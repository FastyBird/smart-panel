import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import VirtualWizardSummary from './virtual-wizard-summary.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe('virtual wizard summary values', () => {
	it('distinguishes numeric zero from missing and empty values', () => {
		const wrapper = mount(VirtualWizardSummary, {
			props: {
				items: [
					{ label: 'Zero', value: 0 },
					{ label: 'Absent', value: null },
					{ label: 'Undefined', value: undefined },
					{ label: 'Empty', value: '' },
				],
			},
		});
		expect(wrapper.findAll('dd').map((cell) => cell.text())).toEqual(['0', '—', '—', '—']);
		wrapper.unmount();
	});
});
