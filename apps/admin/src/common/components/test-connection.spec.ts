import { createI18n } from 'vue-i18n';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { TestConnectionProps, TestConnectionResult } from './test-connection.types';
import TestConnection from './test-connection.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const render = (props: TestConnectionProps) => mount(TestConnection, { props, global: { plugins: [i18n] } });

const button = (wrapper: ReturnType<typeof render>) => wrapper.find('[data-test-id="test-connection-button"]');
const result = (wrapper: ReturnType<typeof render>) => wrapper.find('[data-test-id="test-connection-result"]');

const deferred = () => {
	let resolve!: (value: TestConnectionResult) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<TestConnectionResult>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

describe('TestConnection.vue', () => {
	it('labels the button, or uses the given label', () => {
		expect(button(render({ run: vi.fn() })).text()).toBe('Test connection');
		expect(button(render({ run: vi.fn(), label: 'Test the token' })).text()).toBe('Test the token');
	});

	it('is disabled while the test runs and shows it is running', async () => {
		const pending = deferred();
		const run = vi.fn(() => pending.promise);
		const wrapper = render({ run });

		await button(wrapper).trigger('click');

		expect(button(wrapper).attributes('disabled')).toBeDefined();
		expect(button(wrapper).classes()).toContain('is-loading');
		expect(result(wrapper).text()).toBe('Testing…');

		await button(wrapper).trigger('click');

		expect(run).toHaveBeenCalledTimes(1);

		pending.resolve({ ok: true, message: 'Connected to InfluxDB 2.7' });
		await flushPromises();

		expect(button(wrapper).attributes('disabled')).toBeUndefined();
	});

	it('shows a passed test inline in the success colour', async () => {
		const wrapper = render({ run: () => Promise.resolve({ ok: true, message: 'Connected to InfluxDB 2.7' }) });

		await button(wrapper).trigger('click');
		await flushPromises();

		const shown = result(wrapper).find('[data-ok]');

		expect(result(wrapper).attributes('role')).toBe('status');
		expect(shown.text()).toBe('Connected to InfluxDB 2.7');
		expect(shown.classes()).toContain('text-success');
		expect(wrapper.emitted('result')).toEqual([[{ ok: true, message: 'Connected to InfluxDB 2.7' }]]);
	});

	it('shows a failed test inline in the danger colour', async () => {
		const wrapper = render({ run: () => Promise.resolve({ ok: false, message: '401 Unauthorized: the token was rejected.' }) });

		await button(wrapper).trigger('click');
		await flushPromises();

		const shown = result(wrapper).find('[data-ok]');

		expect(shown.attributes('data-ok')).toBe('false');
		expect(shown.text()).toBe('401 Unauthorized: the token was rejected.');
		expect(shown.classes()).toContain('text-danger');
	});

	it('shows an error from the test as a failed result with its message', async () => {
		const wrapper = render({ run: () => Promise.reject(new Error('getaddrinfo ENOTFOUND influx.local')) });

		await button(wrapper).trigger('click');
		await flushPromises();

		expect(result(wrapper).find('[data-ok]').attributes('data-ok')).toBe('false');
		expect(result(wrapper).text()).toBe('getaddrinfo ENOTFOUND influx.local');
		expect(button(wrapper).attributes('disabled')).toBeUndefined();
	});

	it('falls back to a generic message for an error without one, or a test that throws at once', async () => {
		const rejecting = render({ run: () => Promise.reject('nope') });
		const throwing = render({
			run: () => {
				throw new Error('');
			},
		});

		await button(rejecting).trigger('click');
		await button(throwing).trigger('click');
		await flushPromises();

		expect(result(rejecting).text()).toBe('The connection test failed.');
		expect(result(throwing).text()).toBe('The connection test failed.');
	});

	it('clears the previous result when it runs again', async () => {
		const pending = deferred();
		const run = vi.fn().mockResolvedValueOnce({ ok: false, message: 'Refused' }).mockReturnValueOnce(pending.promise);
		const wrapper = render({ run });

		await button(wrapper).trigger('click');
		await flushPromises();
		await button(wrapper).trigger('click');

		expect(result(wrapper).text()).toBe('Testing…');

		pending.resolve({ ok: true, message: 'Connected' });
		await flushPromises();

		expect(result(wrapper).text()).toBe('Connected');
	});

	it('does not run while disabled', async () => {
		const run = vi.fn();
		const wrapper = render({ run, disabled: true });

		expect(button(wrapper).attributes('disabled')).toBeDefined();

		(wrapper.vm as unknown as { $el: HTMLElement }).$el.querySelector('button')!.click();
		await flushPromises();

		expect(run).not.toHaveBeenCalled();
	});

	it('drops a result that arrives after it was unmounted', async () => {
		const pending = deferred();
		const wrapper = render({ run: () => pending.promise });

		await button(wrapper).trigger('click');

		wrapper.unmount();

		pending.resolve({ ok: true, message: 'Connected' });
		await flushPromises();

		expect(wrapper.emitted('result')).toBeUndefined();
	});
});
