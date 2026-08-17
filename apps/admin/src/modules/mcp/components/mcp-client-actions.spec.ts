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

	it('labels only the actions a glyph cannot carry on its own', () => {
		const wrapper = mountActions();

		// Labelling all four wrapped the actions column onto a second row. Pencil
		// and trash read on their own; rotate and revoke are close enough in
		// meaning that dropping their labels would leave them ambiguous.
		const labelled = wrapper
			.findAll('button')
			.filter((button) => button.text().trim() !== '')
			.map((button) => button.attributes('data-test-id'));

		expect(labelled).toEqual(['rotate-mcp-client', 'revoke-mcp-client']);
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
