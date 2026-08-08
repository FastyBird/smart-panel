import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import McpTokenDialog from './mcp-token-dialog.vue';

const writeText = vi.fn().mockResolvedValue(undefined);

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ error: vi.fn() }),
}));

describe('McpTokenDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
	});

	it('renders the raw token only in the one-time dialog and clears through its close event', async () => {
		const wrapper = shallowMount(McpTokenDialog, {
			props: { modelValue: true, token: 'one-time-secret', clientName: 'Test agent' },
			global: {
				stubs: {
					ElDialog: {
						name: 'ElDialog',
						emits: ['close'],
						template: '<div><slot /><slot name="footer" /></div>',
					},
				},
			},
		});

		expect(wrapper.findComponent({ name: 'ElInput' }).props('modelValue')).toBe('one-time-secret');
		expect(wrapper.findComponent({ name: 'ElAlert' }).props('title')).toBe('mcpModule.token.warningTitle');

		wrapper.findComponent({ name: 'ElDialog' }).vm.$emit('close');
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:model-value')).toEqual([[false]]);
		expect(wrapper.emitted('closed')).toHaveLength(1);
	});
});
