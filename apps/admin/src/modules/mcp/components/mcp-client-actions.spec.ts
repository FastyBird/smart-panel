import { describe, expect, it, vi } from 'vitest';

import { Icon } from '@iconify/vue';
import { mount } from '@vue/test-utils';

import type { IMcpClient } from '../schemas/client.types';

import McpClientActions from './mcp-client-actions.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const client = {
	id: 'c1',
	name: 'Test agent',
	credentialRevoked: false,
} as unknown as IMcpClient;

const mountActions = () =>
	mount(McpClientActions, {
		props: { client },
		global: {
			stubs: {
				ElButton: { name: 'ElButton', template: '<button><slot name="icon" /><slot /></button>' },
			},
		},
	});

describe('McpClientActions', () => {
	// The admin renders row actions as icons, or icon plus label — the MCP rows
	// were text-only, which read as a different control set to every other table.
	it('renders an icon for every row action', () => {
		const wrapper = mountActions();

		const buttons = wrapper.findAll('button');

		expect(buttons.length).toBeGreaterThan(0);
		expect(wrapper.findAllComponents(Icon)).toHaveLength(buttons.length);
	});

	it('exposes a test id for every row action', () => {
		const wrapper = mountActions();

		for (const button of wrapper.findAll('button')) {
			expect(button.attributes('data-test-id')).toBeTruthy();
		}
	});
});
