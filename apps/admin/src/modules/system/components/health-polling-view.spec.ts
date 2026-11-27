import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { StateView } from '../../../common';

import HealthPollingView from './health-polling-view.vue';

enableAutoUnmount(afterEach);

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const fetchMock = vi.fn();

const render = (onSuccess = vi.fn()) =>
	mount(HealthPollingView, {
		props: { waitingMessage: 'Waiting', timeoutMessage: 'Too long', timeoutMs: 5_000, onSuccess },
		global: { stubs: { Icon: true } },
	});

describe('HealthPollingView', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('shows the wait as a loading state', () => {
		fetchMock.mockRejectedValue(new Error('down'));

		const state = render().findComponent(StateView);

		expect(state.props()).toMatchObject({ kind: 'loading', title: 'Waiting' });
	});

	it('says it takes too long, and watches again on Try again', async () => {
		fetchMock.mockRejectedValue(new Error('down'));
		const onSuccess = vi.fn();
		const wrapper = render(onSuccess);

		await vi.advanceTimersByTimeAsync(9_000);

		expect(wrapper.find('[data-test-id="health-polling-timeout"]').text()).toContain('Too long');

		fetchMock.mockResolvedValue({ ok: true });
		await wrapper.find('[data-test-id="health-polling-retry"]').trigger('click');

		expect(wrapper.find('[data-test-id="health-polling-waiting"]').exists()).toBe(true);

		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();

		expect(onSuccess).toHaveBeenCalledTimes(1);
	});
});
