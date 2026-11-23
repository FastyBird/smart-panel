import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import { McpCapability } from '../mcp.constants';
import type { IMcpClient } from '../schemas/client.types';

import McpClientsTable from './mcp-clients-table.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	useSizeClass: () => ({ isTabletPortrait: ref(false) }),
	StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span />' },
	StateView: { name: 'StateView', props: ['kind', 'title', 'icon'], template: '<div />' },
}));

const client = {
	id: '1',
	name: 'Test agent',
	description: null,
	enabled: true,
	capabilities: [McpCapability.read],
	credentialExpiresAt: null,
	credentialRevoked: false,
	lastUsedAt: null,
} as unknown as IMcpClient;

const mountTable = () =>
	shallowMount(McpClientsTable, {
		props: {
			items: [client],
			totalRows: 1,
			sortBy: 'name' as const,
			sortDir: 'asc' as const,
			loading: false,
			filtersActive: false,
		},
		global: {
			stubs: {
				ElTable: { name: 'ElTable', template: '<table><slot /></table>' },
				ElTableColumn: {
					name: 'ElTableColumn',
					template: '<td><slot :row="row" /></td>',
					data: () => ({ row: client }),
				},
			},
		},
	});

describe('McpClientsTable', () => {
	it('shows the client status as a status tag', () => {
		const wrapper = mountTable();
		const tag = wrapper.findComponent({ name: 'StatusTag' });

		expect(tag.props('status')).toBe('ok');
		expect(tag.props('label')).toBe('mcpModule.status.active');
	});

	it('lists the capabilities as text', () => {
		const wrapper = mountTable();

		expect(wrapper.text()).toContain('mcpModule.capabilities.read.title');
	});

	it('opens the client from a row click', () => {
		const wrapper = mountTable();

		wrapper.findComponent({ name: 'ElTable' }).vm.$emit('row-click', client);

		expect(wrapper.emitted('edit')).toEqual([[client]]);
	});
});
