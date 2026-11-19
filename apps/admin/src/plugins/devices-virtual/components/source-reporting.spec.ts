import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import SourceReporting from './source-reporting.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: unknown) => `${key}${params ? JSON.stringify(params) : ''}`, locale: { value: 'en' } }),
}));
vi.mock('../../../common', () => ({
	useBackend: () => ({ client: mocks }),
}));

const profiles: Record<
	string,
	{ source_kind: 'physical' | 'derived'; reports: number; longest_interval_seconds?: number | null; recommended_maximum_age_seconds?: number | null }
> = {
	wired: { source_kind: 'physical', reports: 400, longest_interval_seconds: 30, recommended_maximum_age_seconds: 60 },
	radio: { source_kind: 'physical', reports: 6, longest_interval_seconds: 3_600, recommended_maximum_age_seconds: 5_400 },
	fresh: { source_kind: 'physical', reports: 1 },
};

describe('SourceReporting', () => {
	beforeEach(() => {
		mocks.GET.mockReset();
		mocks.GET.mockImplementation((_path: string, { params }: { params: { path: { id: string } } }) =>
			Promise.resolve({ data: { data: { property: params.path.id, ...profiles[params.path.id] } } })
		);
	});

	it('loads each selected source once and offers the age that covers the slowest one', async () => {
		const wrapper = mount(SourceReporting, {
			props: { properties: ['wired', 'radio', null, 'radio'], maximumAgeSeconds: 60, consequence: 'aggregate' },
		});
		await flushPromises();
		expect(mocks.GET).toHaveBeenCalledTimes(2);
		const warning = wrapper.get('[data-test-id="source-reporting-too-short"]');
		expect(warning.text()).toContain('sourceReporting.tooShort.titleMany');
		expect(warning.text()).toContain('sourceReporting.consequence.aggregate');
		await wrapper.get('[data-test-id="source-reporting-apply"]').trigger('click');
		expect(wrapper.emitted('apply')).toEqual([[5_400]]);
	});

	it('confirms a fitting age and fetches only newly selected sources', async () => {
		const wrapper = mount(SourceReporting, { props: { properties: ['wired'], maximumAgeSeconds: 60, consequence: 'converter' } });
		await flushPromises();
		expect(wrapper.find('[data-test-id="source-reporting-fits"]').exists()).toBe(true);
		await wrapper.setProps({ properties: ['wired', 'fresh'] });
		await flushPromises();
		expect(mocks.GET).toHaveBeenCalledTimes(2);
		expect(wrapper.get('[data-test-id="source-reporting-unknown"]').text()).toContain('sourceReporting.unknown.messageMany');
	});

	it('keeps the response of the latest load when a source is deselected and selected again', async () => {
		const pending: ((value: unknown) => void)[] = [];
		mocks.GET.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
		const wrapper = mount(SourceReporting, { props: { properties: ['radio'], maximumAgeSeconds: 60, consequence: 'aggregate' } });
		await wrapper.setProps({ properties: ['wired'] });
		await wrapper.setProps({ properties: ['radio'] });
		expect(pending).toHaveLength(3);
		pending[2]({ data: { data: { property: 'radio', ...profiles.radio } } });
		await flushPromises();
		pending[0]({ data: { data: { property: 'radio', ...profiles.wired } } });
		await flushPromises();
		expect(wrapper.find('[data-test-id="source-reporting-too-short"]').exists()).toBe(true);
	});

	it('does not confirm the age while another selected source failed to load', async () => {
		mocks.GET.mockImplementation((_path: string, { params }: { params: { path: { id: string } } }) =>
			params.path.id === 'radio'
				? Promise.reject(new Error('offline'))
				: Promise.resolve({ data: { data: { property: 'wired', ...profiles.wired } } })
		);
		const wrapper = mount(SourceReporting, { props: { properties: ['wired', 'radio'], maximumAgeSeconds: 60, consequence: 'aggregate' } });
		await flushPromises();
		expect(wrapper.text()).toBe('');
	});

	it('stays silent when the guidance cannot be loaded', async () => {
		mocks.GET.mockRejectedValue(new Error('offline'));
		const wrapper = mount(SourceReporting, { props: { properties: ['radio'], maximumAgeSeconds: 60, consequence: 'ambient' } });
		await flushPromises();
		expect(wrapper.text()).toBe('');
	});
});
