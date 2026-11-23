import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import McpOAuthRowList from './mcp-oauth-row-list.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span />' },
	StateView: { name: 'StateView', props: ['kind', 'title', 'icon'], template: '<div />' },
}));

const caption = 'Read, Write, Trigger, Offline access · Feb 21, 2027, 11:00 AM';

const mountRows = () =>
	shallowMount(McpOAuthRowList, {
		props: {
			rows: [{ id: 'g1', title: 'Claude.ai connector', caption, status: { status: 'ok', label: 'Active' } }],
			icon: 'mdi:key-chain',
			loading: false,
			emptyLabel: 'empty',
		},
		slots: { actions: '<button data-test-id="row-action" />' },
	});

describe('McpOAuthRowList', () => {
	it('shows the whole caption, wrapping it rather than cutting it off', () => {
		const wrapper = mountRows();
		const shown = wrapper.find('[data-test-id="mcp-oauth-row-caption"]');

		expect(shown.text()).toBe(caption);
		expect(shown.classes()).not.toContain('truncate');
		expect(shown.classes()).toContain('break-words');
	});

	it('renders the row actions from the slot', () => {
		expect(mountRows().find('[data-test-id="row-action"]').exists()).toBe(true);
	});

	it('shows the empty state when there are no rows', () => {
		const wrapper = shallowMount(McpOAuthRowList, { props: { rows: [], icon: 'mdi:key-chain', loading: false, emptyLabel: 'empty' } });

		expect(wrapper.findComponent({ name: 'McpTableEmpty' }).props('emptyLabel')).toBe('empty');
	});
});
