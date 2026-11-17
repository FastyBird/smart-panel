import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import AddSources from './virtual-wizard-add-sources.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe('shared add-source list', () => {
	it('shows group compatibility effects and prevents adding an incompatible candidate', async () => {
		const view = mount(AddSources, {
			props: {
				selectedIds: [],
				sources: [
					{ id: 'ok', name: 'Dimmer', detail: 'Light', room: 'Bedroom', roomId: 'bedroom', badge: { label: 'Removes 3 controls', type: 'warning' } },
					{
						id: 'bad',
						name: 'Unsupported',
						detail: 'Channel',
						room: 'Hall',
						roomId: 'hall',
						disabled: true,
						disabledReason: 'Missing required control: On',
					},
				],
			},
		});
		expect(view.text()).toContain('Removes 3 controls');
		expect(view.text()).toContain('Missing required control: On');
		await view.get('[data-source-id="bad"]').trigger('click');
		expect(view.emitted('add')).toBeUndefined();
		await view.get('[data-source-id="ok"]').trigger('click');
		expect(view.emitted('add')).toEqual([['ok']]);
		view.unmount();
	});
});
