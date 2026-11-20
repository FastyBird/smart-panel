import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import type { StatusTagStatus } from './status-tag.types';
import StatusTag from './status-tag.vue';

const STATUSES: StatusTagStatus[] = ['ok', 'warn', 'danger', 'info', 'critical', 'primary'];

describe('StatusTag.vue', () => {
	it.each(STATUSES)('renders a dot and the label for %s', (status) => {
		const wrapper = mount(StatusTag, { props: { status, label: 'Online' } });

		expect(wrapper.attributes('data-status')).toBe(status);
		expect(wrapper.text()).toBe('Online');
		expect(wrapper.find('span[aria-hidden="true"]').exists()).toBe(true);
	});

	it('colours soft tags with the readable status text shade', () => {
		const wrapper = mount(StatusTag, { props: { status: 'ok', label: 'Online' } });

		expect(wrapper.classes()).toContain('text-[var(--fb-status-ok-text)]');
		expect(wrapper.classes()).toContain('bg-[var(--fb-status-ok-soft)]');
	});

	it('fills only the critical tag', () => {
		const wrapper = mount(StatusTag, { props: { status: 'critical', label: 'Critical' } });

		expect(wrapper.classes()).toContain('bg-[var(--el-color-danger)]');
		expect(wrapper.classes()).toContain('text-white');
	});

	it('takes the label from the default slot', () => {
		const wrapper = mount(StatusTag, { props: { status: 'warn' }, slots: { default: 'Degraded' } });

		expect(wrapper.text()).toBe('Degraded');
	});
});
