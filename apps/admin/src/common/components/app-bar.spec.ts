import { createI18n } from 'vue-i18n';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { AppBarProps } from './app-bar.types';
import AppBar from './app-bar.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const render = (props: AppBarProps = {}, slots: Record<string, string> = {}) => mount(AppBar, { props, slots, global: { plugins: [i18n] } });

const find = (wrapper: ReturnType<typeof render>, id: string) => wrapper.find(`[data-test-id="app-bar-${id}"]`);

describe('AppBar.vue', () => {
	it('is a 56 px bar in the sidebar colour', () => {
		const wrapper = render({ title: 'Devices' });

		expect(wrapper.classes()).toEqual(expect.arrayContaining(['h-14', 'bg-[var(--fb-sidebar-bg)]']));
	});

	it('shows the title and the subtitle as written, without upper-casing them', () => {
		const wrapper = render({ title: 'Edit device', subtitle: 'Living room lamp' });

		expect(wrapper.find('h1').text()).toBe('Edit device');
		expect(find(wrapper, 'title').text()).toContain('Living room lamp');
		expect(wrapper.html()).not.toContain('uppercase');
	});

	it.each([
		['menu', 'Open menu'],
		['back', 'Back'],
		['close', 'Close'],
	] as const)('labels the %s button', async (left, label) => {
		const wrapper = render({ title: 'Devices', left });

		expect(find(wrapper, 'left').attributes('aria-label')).toBe(label);

		await find(wrapper, 'left').trigger('click');

		expect(wrapper.emitted('left')).toHaveLength(1);
	});

	it('has no left button when none is asked for', () => {
		expect(find(render({ title: 'Filters' }), 'left').exists()).toBe(false);
	});

	it('disables the left button while it has to wait', () => {
		expect(find(render({ title: 'Edit', left: 'close', leftDisabled: true }), 'left').attributes('disabled')).toBeDefined();
	});

	it('shows at most two labelled icon actions', async () => {
		const handler = vi.fn();
		const wrapper = render({
			title: 'Devices',
			actions: [
				{ icon: 'mdi:magnify', label: 'Search', handler },
				{ icon: 'mdi:plus', label: 'Add device', handler },
				{ icon: 'mdi:import', label: 'Import', handler },
			],
		});

		const actions = wrapper.findAll('[data-test-id="app-bar-action"]');

		expect(actions.map((action) => action.attributes('aria-label'))).toEqual(['Search', 'Add device']);

		await actions[1].trigger('click');

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('shows one primary button in place of the actions', async () => {
		const handler = vi.fn();
		const wrapper = render({
			title: 'Edit device',
			actions: [{ icon: 'mdi:plus', label: 'Add', handler: vi.fn() }],
			primary: { label: 'Save', handler },
		});

		expect(wrapper.findAll('[data-test-id="app-bar-action"]')).toHaveLength(0);
		expect(find(wrapper, 'primary').text()).toBe('Save');

		await find(wrapper, 'primary').trigger('click');

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('passes the loading and disabled state of the primary button on', () => {
		const wrapper = render({ title: 'Edit', primary: { label: 'Save', handler: vi.fn(), loading: true, disabled: true } });

		expect(find(wrapper, 'primary').classes()).toContain('is-loading');
		expect(find(wrapper, 'primary').attributes('disabled')).toBeDefined();
	});

	it('takes a custom title and something at the end', () => {
		const wrapper = render({}, { title: '<span data-test-id="logo" />', end: '<span data-test-id="bell" />' });

		expect(wrapper.find('[data-test-id="logo"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="bell"]').exists()).toBe(true);
	});
});
