import { ref } from 'vue';

import { ElAvatar } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import { McpCapability } from '../mcp.constants';
import type { IMcpClient } from '../schemas/client.types';

import McpClientsTable from './mcp-clients-table.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	useBreakpoints: () => ({ isMDDevice: ref(true) }),
	IconWithChild: { name: 'IconWithChild', template: '<div><slot name="primary" /><slot name="secondary" /></div>' },
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
	it('renders the row icon in an avatar, as every other list does', () => {
		const wrapper = mountTable();

		// Eight modules render their row icon as `el-avatar :size="32"`; a bare
		// `el-icon` reads as a different control set at a glance.
		const avatar = wrapper.findComponent(ElAvatar);

		expect(avatar.exists()).toBe(true);
		expect(avatar.props('size')).toBe(32);
	});
});
