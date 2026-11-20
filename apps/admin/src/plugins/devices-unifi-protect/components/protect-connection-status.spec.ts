import { reactive } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import {
	DevicesUnifiProtectPluginConnectionState,
	DevicesUnifiProtectPluginErrorCategory,
	DevicesUnifiProtectPluginRealtimeState,
	DevicesUnifiProtectPluginTlsMode,
} from '../../../openapi.constants';
import { protectStatusStoreKey } from '../store/keys';
import type { IProtectStatus } from '../store/protect.types';

import ProtectConnectionStatus from './protect-connection-status.vue';

const mocks = vi.hoisted(() => ({ statusStore: null as unknown }));

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			locale: 'en-US',
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === protectStatusStoreKey) return mocks.statusStore;

				throw new Error('Unexpected store');
			},
		}),
	};
});

interface IStatusStoreMock {
	status: IProtectStatus | null;
	stale: boolean;
	startPolling: ReturnType<typeof vi.fn>;
}

const FIELDS = [
	'connection-state',
	'service-state',
	'enabled',
	'configured',
	'healthy',
	'tls-mode',
	'application-version',
	'minimum-version',
	'nvr-id',
	'nvr-name',
	'last-connected-at',
	'last-error',
	'reconnect-attempt',
	'next-retry-at',
	'realtime-state',
	'ignored-event-count',
];

const statusOf = (overrides: Partial<IProtectStatus> = {}): IProtectStatus => ({
	serviceState: 'started',
	connectionState: DevicesUnifiProtectPluginConnectionState.connected,
	enabled: true,
	configured: true,
	healthy: true,
	tlsMode: DevicesUnifiProtectPluginTlsMode.pinned,
	applicationVersion: '7.3.1',
	minimumVersion: '7.2.105',
	nvrId: 'nvr-1',
	nvrName: 'Home NVR',
	lastConnectedAt: '2026-11-20T10:00:00.000Z',
	lastErrorCategory: DevicesUnifiProtectPluginErrorCategory.unreachable,
	lastError: 'Connection refused',
	reconnectAttempt: 2,
	nextRetryAt: '2026-11-20T10:05:00.000Z',
	realtimeState: DevicesUnifiProtectPluginRealtimeState.streaming,
	ignoredEventCount: 4,
	...overrides,
});

let statusStore: IStatusStoreMock;
let release: ReturnType<typeof vi.fn>;

const mountPanel = (props: { pollIntervalMs?: number } = {}) => mount(ProtectConnectionStatus, { props });

const field = (wrapper: ReturnType<typeof mountPanel>, name: string): string => wrapper.get(`[data-test-id="protect-status-${name}"]`).text();

describe('ProtectConnectionStatus', () => {
	beforeEach(() => {
		release = vi.fn();
		statusStore = reactive<IStatusStoreMock>({
			status: statusOf(),
			stale: false,
			startPolling: vi.fn(() => release),
		});
		mocks.statusStore = statusStore;
	});

	it('shows only the allowed fields', async () => {
		// A field the backend might add later must not be rendered.
		statusStore.status = { ...statusOf(), internalToken: 'secret-extra' } as IProtectStatus;

		const wrapper = mountPanel();

		await flushPromises();

		const rendered = wrapper
			.findAll('[data-test-id^="protect-status-"]')
			.map((node) => node.attributes('data-test-id')?.replace('protect-status-', ''))
			.filter((id) => FIELDS.includes(id ?? ''));

		expect(rendered).toEqual(FIELDS);
		expect(field(wrapper, 'nvr-name')).toBe('Home NVR');
		expect(field(wrapper, 'application-version')).toBe('7.3.1');
		expect(field(wrapper, 'minimum-version')).toBe('7.2.105');
		// The category is shown as its sentence, and the raw category, the extra field and the fixed minimum are not leaked.
		expect(field(wrapper, 'last-error')).toContain('devicesUnifiProtectPlugin.errorCategories.unreachable');
		expect(field(wrapper, 'last-error')).toContain('Connection refused');
		expect(wrapper.text()).not.toContain('secret-extra');
		expect(wrapper.find('[data-test-id="protect-status-last-error-category"]').exists()).toBe(false);
	});

	it('formats times with the app locale', async () => {
		const wrapper = mountPanel();

		await flushPromises();

		const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date('2026-11-20T10:00:00.000Z'));

		expect(field(wrapper, 'last-connected-at')).toBe(expected);
	});

	it('shows streaming without an interval', async () => {
		const wrapper = mountPanel({ pollIntervalMs: 45000 });

		await flushPromises();

		expect(field(wrapper, 'realtime-state')).toBe('devicesUnifiProtectPlugin.status.realtime.streaming');
	});

	it('reads polling every N s from the poll interval', async () => {
		statusStore.status = statusOf({ realtimeState: DevicesUnifiProtectPluginRealtimeState.polling });

		const wrapper = mountPanel({ pollIntervalMs: 45000 });

		await flushPromises();

		expect(field(wrapper, 'realtime-state')).toBe('devicesUnifiProtectPlugin.status.realtime.polling {"seconds":45}');

		const defaulted = mountPanel();

		await flushPromises();

		expect(field(defaulted, 'realtime-state')).toBe('devicesUnifiProtectPlugin.status.realtime.polling {"seconds":30}');
	});

	it('shows a stale warning and keeps the last values', async () => {
		statusStore.stale = true;

		const wrapper = mountPanel();

		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-status-stale"]').exists()).toBe(true);
		expect(field(wrapper, 'nvr-name')).toBe('Home NVR');
		expect(field(wrapper, 'ignored-event-count')).toBe('4');
	});

	it('shows no warning for a current status', async () => {
		const wrapper = mountPanel();

		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-status-stale"]').exists()).toBe(false);
	});

	it('shows the warning when the first read failed', async () => {
		statusStore.status = null;
		statusStore.stale = true;

		const wrapper = mountPanel();

		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-status-stale"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="protect-status-connection-state"]').exists()).toBe(false);
	});

	it('shows nothing but the title before the first read answers', async () => {
		statusStore.status = null;

		const wrapper = mountPanel();

		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-status-stale"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-status-connection-state"]').exists()).toBe(false);
	});

	it('shows not available for missing optional values', async () => {
		statusStore.status = statusOf({
			applicationVersion: null,
			nvrId: null,
			nvrName: null,
			lastConnectedAt: null,
			nextRetryAt: null,
			lastError: null,
			lastErrorCategory: null,
		});

		const wrapper = mountPanel();

		await flushPromises();

		expect(field(wrapper, 'nvr-name')).toBe('devicesUnifiProtectPlugin.status.notAvailable');
		expect(field(wrapper, 'last-connected-at')).toBe('devicesUnifiProtectPlugin.status.notAvailable');
		expect(field(wrapper, 'last-error')).toBe('devicesUnifiProtectPlugin.status.notAvailable');
	});

	it('releases polling on unmount', async () => {
		const wrapper = mountPanel();

		await flushPromises();

		expect(statusStore.startPolling).toHaveBeenCalledTimes(1);
		expect(release).not.toHaveBeenCalled();

		wrapper.unmount();

		expect(release).toHaveBeenCalledTimes(1);
	});
});
