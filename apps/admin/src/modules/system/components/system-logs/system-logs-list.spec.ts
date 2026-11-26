import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import { StateView } from '../../../../common';
import { SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../../openapi.constants';
import type { ILogEntry } from '../../store/logs-entries.store.types';

import type { ISystemLogsListProps } from './system-logs-list.types';
import SystemLogsList from './system-logs-list.vue';

enableAutoUnmount(afterEach);

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }),
}));

const entry = (id: string, overrides: Partial<ILogEntry> = {}): ILogEntry =>
	({
		id,
		ts: '2026-11-26T10:00:00.000Z',
		source: SystemModuleLogEntrySource.backend,
		level: 3,
		type: SystemModuleLogEntryType.error,
		message: `Message ${id}`,
		user: {},
		context: {},
		...overrides,
	}) as ILogEntry;

const mountList = (props: Partial<ISystemLogsListProps> = {}) =>
	mount(SystemLogsList, {
		props: {
			items: [],
			loading: false,
			hasMore: false,
			filtersActive: false,
			...props,
		},
	});

describe('SystemLogsList', () => {
	it('shows each entry with its level, source, tag and message, and opens it', async () => {
		const wrapper = mountList({ items: [entry('a', { tag: 'devices' }), entry('b', { message: undefined })] });

		const rows = wrapper.findAll('[data-test-id="system-logs-row"]');

		expect(rows).toHaveLength(2);
		expect(rows[0].text()).toContain('systemModule.levels.error');
		expect(rows[0].text()).toContain('systemModule.sources.backend');
		expect(rows[0].text()).toContain('[devices]');
		expect(rows[0].text()).toContain('Message a');
		expect(rows[1].text()).toContain('systemModule.texts.systemLogs.noMessage');

		await rows[1].trigger('click');

		expect(wrapper.emitted('open')).toEqual([['b']]);
	});

	it('marks the entry open beside the list', () => {
		const wrapper = mountList({ items: [entry('a'), entry('b')], activeId: 'b' });

		const rows = wrapper.findAll('[data-test-id="system-logs-row"]');

		expect(rows[0].attributes('aria-current')).toBeUndefined();
		expect(rows[1].attributes('aria-current')).toBe('true');
	});

	it('loads more while there is more, and says when there is not', async () => {
		const wrapper = mountList({ items: [entry('a')], hasMore: true });

		await wrapper.get('[data-test-id="system-logs-load-more"]').trigger('click');

		expect(wrapper.emitted('load-more')).toHaveLength(1);

		await wrapper.setProps({ hasMore: false });

		expect(wrapper.find('[data-test-id="system-logs-load-more"]').exists()).toBe(false);
		expect(wrapper.text()).toContain('systemModule.texts.systemLogs.noMoreEntries');
	});

	it('tells loading, no entries, no matches and a failed read apart', async () => {
		const wrapper = mountList({ loading: true });

		expect(wrapper.findComponent(StateView).props('kind')).toBe('loading');

		await wrapper.setProps({ loading: false });

		expect(wrapper.find('[data-test-id="system-logs-empty"]').exists()).toBe(true);

		await wrapper.setProps({ filtersActive: true });
		await wrapper.get('[data-test-id="system-logs-no-matches"] button').trigger('click');

		expect(wrapper.emitted('reset-filters')).toHaveLength(1);

		await wrapper.setProps({ failed: true });
		await wrapper.get('[data-test-id="system-logs-error"] button').trigger('click');

		expect(wrapper.emitted('retry')).toHaveLength(1);
	});
});
