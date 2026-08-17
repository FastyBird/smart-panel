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
				ElButton: {
					name: 'ElButton',
					props: ['type'],
					template: '<button :type="type"><slot name="icon" /><slot /></button>',
				},
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

	it('labels only the primary action so the row stays on one line', () => {
		const wrapper = mountActions();

		// Four labelled buttons wrapped onto a second row in the actions column.
		// Other tables label the primary action only and leave the rest as icons.
		const labelled = wrapper.findAll('button').filter((button) => button.text().trim() !== '');

		expect(labelled).toHaveLength(1);
		expect(labelled[0]?.attributes('data-test-id')).toBe('edit-mcp-client');
	});

	it('uses the warning colour for destructive actions', () => {
		const wrapper = mountActions();

		// Every other module colours destructive row actions `warning`; MCP used
		// `danger`, which appears nowhere else in a table row.
		for (const testId of ['revoke-mcp-client', 'delete-mcp-client']) {
			const button = wrapper.findAllComponents({ name: 'ElButton' }).find((candidate) => candidate.attributes('data-test-id') === testId);

			expect(button?.props('type')).toBe('warning');
		}
	});
});
