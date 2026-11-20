import { createI18n } from 'vue-i18n';

import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { StateViewProps } from './state-view.types';
import StateView from './state-view.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const render = (props: StateViewProps = {}, slots: Record<string, string> = {}) => mount(StateView, { props, slots, global: { plugins: [i18n] } });

describe('StateView.vue', () => {
	it('shows the default empty title', () => {
		const wrapper = render();

		expect(wrapper.find('h2').text()).toBe('Nothing here yet');
		expect(wrapper.attributes('role')).toBe('status');
	});

	it.each([
		['loading', 'Loading…'],
		['error', 'Something went wrong'],
		['not-found', 'Not found'],
	] as const)('shows the default title for %s', (kind, title) => {
		expect(render({ kind }).find('h2').text()).toBe(title);
	});

	it('announces errors as alerts and loading as busy', () => {
		expect(render({ kind: 'error' }).attributes('role')).toBe('alert');
		expect(render({ kind: 'loading' }).attributes('aria-busy')).toBe('true');
		expect(render({ kind: 'empty' }).attributes('aria-busy')).toBeUndefined();
	});

	it('spins the icon only while loading', () => {
		expect(render({ kind: 'loading' }).find('.el-icon').classes()).toContain('is-loading');
		expect(render({ kind: 'empty' }).find('.el-icon').classes()).not.toContain('is-loading');
	});

	it('renders a custom title, description and action', () => {
		const wrapper = render({ title: 'No devices', description: 'Add a device to get started.' }, { action: '<button>Add device</button>' });

		expect(wrapper.find('h2').text()).toBe('No devices');
		expect(wrapper.find('p').text()).toBe('Add a device to get started.');
		expect(wrapper.find('button').text()).toBe('Add device');
	});

	it('leaves out the description and action when not given', () => {
		const wrapper = render();

		expect(wrapper.find('p').exists()).toBe(false);
		expect(wrapper.find('button').exists()).toBe(false);
	});

	it('uses the danger tint only for errors', () => {
		expect(render({ kind: 'error' }).find('[aria-hidden="true"]').classes()).toContain('bg-danger-soft');
		expect(render({ kind: 'empty' }).find('[aria-hidden="true"]').classes()).toContain('bg-fill-light');
	});
});
