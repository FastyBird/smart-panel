import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import { KvGrid } from '../../../../common';
import { SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../../openapi.constants';
import type { ILogEntry } from '../../store/logs-entries.store.types';

import SystemLogDetail from './system-log-detail.vue';

enableAutoUnmount(afterEach);

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const entry = (overrides: Partial<ILogEntry> = {}): ILogEntry =>
	({
		id: 'a',
		ts: '2026-11-26T10:00:00.000Z',
		source: SystemModuleLogEntrySource.admin,
		level: 1,
		type: SystemModuleLogEntryType.warn,
		message: 'Socket closed',
		user: {},
		context: {},
		...overrides,
	}) as ILogEntry;

const labels = (wrapper: ReturnType<typeof mount>): string[] =>
	(wrapper.findComponent(KvGrid).props('items') as { label: string }[]).map((item) => item.label);

describe('SystemLogDetail', () => {
	it('leads with the level and the message', () => {
		const wrapper = mount(SystemLogDetail, { props: { systemLog: entry({ tag: 'sockets' }) } });

		expect(wrapper.get('[data-test-id="system-log-detail-level"]').text()).toContain('systemModule.levels.warn');
		expect(wrapper.get('[data-test-id="system-log-detail-message"]').text()).toBe('Socket closed');
		expect(wrapper.text()).toContain('sockets');
	});

	it('lists only the details the entry carries', () => {
		const wrapper = mount(SystemLogDetail, { props: { systemLog: entry() } });

		expect(labels(wrapper)).toEqual(['systemModule.fields.systemLogs.timestamp.title']);

		const full = mount(SystemLogDetail, {
			props: { systemLog: entry({ context: { appVersion: '1.2.0', url: 'https://panel.local/devices', locale: 'en-US' } }) },
		});

		expect(labels(full)).toEqual([
			'systemModule.fields.systemLogs.timestamp.title',
			'systemModule.fields.systemLogs.appVersion.title',
			'systemModule.fields.systemLogs.url.title',
			'systemModule.fields.systemLogs.locale.title',
		]);
	});

	it('links the reported URL only when it is a web page', () => {
		const href = (url: string): string | undefined =>
			(
				mount(SystemLogDetail, { props: { systemLog: entry({ context: { url } }) } })
					.findComponent(KvGrid)
					.props('items') as { label: string; href?: string }[]
			).find((item) => item.label === 'systemModule.fields.systemLogs.url.title')?.href;

		expect(href('https://panel.local/devices')).toBe('https://panel.local/devices');
		expect(href('javascript:alert(1)')).toBeUndefined();
	});

	it('shows the arguments only when there are some', () => {
		expect(
			mount(SystemLogDetail, { props: { systemLog: entry() } })
				.find('[data-test-id="system-log-detail-args"]')
				.exists()
		).toBe(false);
		expect(
			mount(SystemLogDetail, { props: { systemLog: entry({ args: [] }) } })
				.find('[data-test-id="system-log-detail-args"]')
				.exists()
		).toBe(false);
		expect(
			mount(SystemLogDetail, { props: { systemLog: entry({ args: ['retry', 3] }) } })
				.get('[data-test-id="system-log-detail-args"]')
				.text()
		).toContain('"retry"');
	});
});
