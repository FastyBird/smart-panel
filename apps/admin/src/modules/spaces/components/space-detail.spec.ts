import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { SpaceType } from '../spaces.constants';

import SpaceDetail from './space-detail.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('./spaces-table-column-plugin.vue', async () => {
	const { defineComponent } = await import('vue');

	return {
		default: defineComponent({
			name: 'SpacesTableColumnPlugin',
			template: '<span />',
		}),
	};
});

describe('SpaceDetail', () => {
	it('renders plugin-provided detail rows inside the details list', () => {
		const wrapper = mount(SpaceDetail, {
			props: {
				space: {
					id: '7a1bafdc-8c7d-4d5a-9e2a-4dfdc3c8253d',
					name: 'Living room',
					category: null,
					description: null,
					type: SpaceType.ROOM,
					icon: null,
					displayOrder: 0,
					parentId: null,
					suggestionsEnabled: false,
					statusWidgets: null,
					createdAt: new Date(),
					updatedAt: null,
					draft: false,
				},
			},
			slots: {
				default: '<dt data-test-id="plugin-row-label">Floor</dt><dd data-test-id="plugin-row-value">Ground floor</dd>',
			},
			global: {
				stubs: {
					Icon: true,
				},
			},
		});

		const list = wrapper.find('dl');

		expect(list.find('[data-test-id="plugin-row-label"]').exists()).toBe(true);
		expect(list.find('[data-test-id="plugin-row-value"]').exists()).toBe(true);
	});
});
