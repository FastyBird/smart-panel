import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { SystemModuleLogEntryType } from '../../../openapi.constants';

import ApplicationLogs from './application-logs.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const line = (type: SystemModuleLogEntryType, message: string) => ({ ts: '2026-11-25T10:00:00Z', type, tag: 'api', message });

const render = (props: Record<string, unknown> = {}) =>
	mount(ApplicationLogs, {
		props: { systemLogs: [], filters: { levels: [] }, filtersActive: false, loading: false, ...props } as never,
		global: {
			stubs: {
				ElTooltip: { template: '<div><slot /></div>' },
				ElSelect: { template: '<div />' },
				StateView: { name: 'StateView', props: ['kind', 'title'], template: '<div :data-kind="kind">{{ title }}<slot name="action" /></div>' },
				StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span :data-status="status" />' },
			},
		},
	});

describe('ApplicationLogs', () => {
	it('tags each line by its level: failures as danger, warnings as warn, the rest neutral', () => {
		const wrapper = render({
			systemLogs: [
				line(SystemModuleLogEntryType.error, 'Broken'),
				line(SystemModuleLogEntryType.warn, 'Careful'),
				line(SystemModuleLogEntryType.success, 'Done'),
				line(SystemModuleLogEntryType.info, 'Note'),
			],
		});

		expect(wrapper.findAll('[data-status]').map((tag) => tag.attributes('data-status'))).toEqual(['danger', 'warn', 'ok', 'info']);
		expect(wrapper.text()).toContain('[api]');
		expect(wrapper.text()).toContain('Broken');
	});

	it('says when there are no lines, and offers to reset an active filter', async () => {
		expect(render().get('[data-kind="empty"]').text()).toContain('statsModule.texts.noLogs');

		const filtered = render({ filtersActive: true });

		expect(filtered.get('[data-kind="empty"]').text()).toContain('statsModule.texts.noFilteredLogs');

		await filtered.get('[data-kind="empty"] button').trigger('click');

		expect(filtered.emitted('reset')).toHaveLength(1);
	});

	it('refreshes and opens the system logs from its buttons', async () => {
		const wrapper = render();

		await wrapper.get('[data-test-id="application-logs-refresh"]').trigger('click');
		await wrapper.get('[data-test-id="application-logs-open"]').trigger('click');

		expect(wrapper.emitted('refresh')).toHaveLength(1);
		expect(wrapper.emitted('detail')).toHaveLength(1);
	});
});
