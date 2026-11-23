import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import type { IProviderCardProps } from './provider-card.types';
import ProviderCard from './provider-card.vue';

enableAutoUnmount(afterEach);

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
	}),
}));

const render = (props: Partial<IProviderCardProps> = {}) =>
	mount(ProviderCard, {
		props: {
			icon: 'mdi:lan-connect',
			title: 'Tailscale',
			status: 'ok',
			statusLabel: 'Connected',
			line: { text: 'Private access over your tailnet.' },
			...props,
		},
		global: {
			stubs: {
				CopyField: { name: 'CopyField', props: ['value'], template: '<div>{{ value }}</div>' },
				// The dropdown teleports its menu: a stub that renders both slots keeps the items in the wrapper
				ElDropdown: { name: 'ElDropdown', emits: ['command'], template: '<div><slot /><slot name="dropdown" /></div>' },
				ElDropdownMenu: { template: '<ul><slot /></ul>' },
				ElDropdownItem: { name: 'ElDropdownItem', props: ['command', 'disabled', 'divided'], template: '<li><slot /></li>' },
			},
		},
	});

describe('ProviderCard', () => {
	it('shows the name, the status and the one line', () => {
		const wrapper = render();

		expect(wrapper.find('h3').text()).toBe('Tailscale');
		expect(wrapper.findComponent({ name: 'StatusTag' }).props()).toMatchObject({ status: 'ok', label: 'Connected' });
		expect(wrapper.find('[data-test-id="provider-card-line"]').text()).toBe('Private access over your tailnet.');
		expect(wrapper.find('[data-test-id="provider-card-line"]').attributes('data-status')).toBeUndefined();
	});

	it('marks a line that needs attention', () => {
		const wrapper = render({ line: { text: 'Cannot be used yet', status: 'warn' } });

		expect(wrapper.find('[data-test-id="provider-card-line"]').attributes('data-status')).toBe('warn');
		expect(wrapper.find('[data-test-id="provider-card-line"]').classes()).toContain('text-warning');
	});

	it('leaves the line out when it has no text', () => {
		expect(render({ line: { text: '' } }).find('[data-test-id="provider-card-line"]').exists()).toBe(false);
	});

	it('shows at most two endpoints, each once', () => {
		const wrapper = render({ endpoints: ['https://a.example', 'https://a.example', 'https://b.example', 'https://c.example'] });

		expect(wrapper.findAllComponents({ name: 'CopyField' }).map((field) => field.props('value'))).toEqual(['https://a.example', 'https://b.example']);
	});

	it('has no action row when there is nothing to do', () => {
		const wrapper = render();

		expect(wrapper.find('[data-test-id="provider-card-action"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="provider-card-menu"]').exists()).toBe(false);
	});

	it('emits its one action by key', async () => {
		const wrapper = render({ action: { key: 'setup', label: 'Set up', primary: true } });

		const button = wrapper.find('[data-test-id="provider-card-action"]');

		expect(button.text()).toBe('Set up');
		expect(button.classes()).toContain('el-button--primary');

		await button.trigger('click');

		expect(wrapper.emitted('action')).toEqual([['setup']]);
	});

	it('lists the other actions in its menu with the destructive ones last, after a divider', async () => {
		const wrapper = render({
			action: { key: 'disconnect', label: 'Disconnect' },
			menu: [
				{ key: 'remove', label: 'Remove tunnel', danger: true },
				{ key: 'reconnect', label: 'Reconnect' },
				{ key: 'documentation', label: 'Documentation' },
			],
		});

		expect(wrapper.find('[data-test-id="provider-card-menu"]').attributes('aria-label')).toBe(
			'remoteAccessModule.buttons.more.title:{"provider":"Tailscale"}'
		);

		const items = wrapper.findAllComponents({ name: 'ElDropdownItem' });

		expect(items.map((item) => item.props('command'))).toEqual(['reconnect', 'documentation', 'remove']);
		expect(items.map((item) => item.props('divided'))).toEqual([false, false, true]);

		wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'reconnect');

		expect(wrapper.emitted('action')).toEqual([['reconnect']]);
	});
});
