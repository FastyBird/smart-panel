import { reactive } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesHomeyPluginConnectionState, DevicesHomeyPluginErrorCategory } from '../../../openapi.constants';
import type { IHomeyStatus, IHomeyTestConnection } from '../store/homey.types';

import HomeyConnectionPanel from './HomeyConnectionPanel.vue';

interface IStatusStoreMock {
	status: IHomeyStatus | null;
	lastTest: IHomeyTestConnection | null;
	fetching: boolean;
	testing: boolean;
	fetch: ReturnType<typeof vi.fn>;
	testConnection: ReturnType<typeof vi.fn>;
	clearLastTest: ReturnType<typeof vi.fn>;
}

let statusStore: IStatusStoreMock;

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string, params?: { identity?: string }) => (params?.identity ? `${key}: ${params.identity}` : key),
	}),
}));

vi.mock('../store/homey-status.store', () => ({
	useHomeyStatus: () => statusStore,
}));

const connectedStatus = (): IHomeyStatus => ({
	serviceState: 'started',
	connectionState: DevicesHomeyPluginConnectionState.connected,
	enabled: true,
	configured: true,
	healthy: true,
	degraded: false,
	homeyId: 'homey-test-id',
	homeyName: 'Test Homey',
	homeyVersion: '13.4.0',
	lastInventorySyncAt: '2026-08-24T12:00:00.000Z',
	lastEventAt: '2026-08-24T12:01:00.000Z',
	adoptedDeviceCount: 2,
	missingDeviceCount: 0,
	unsupportedDeviceCount: 0,
	unavailableDeviceCount: 0,
	reconnectCount: 0,
	reconciliationCount: 1,
	reconciliationFailureCount: 0,
});

const mountPanel = (props: { candidateUrl?: string | null; candidateApiKey?: string | null } = {}) =>
	mount(HomeyConnectionPanel, {
		props,
		global: {
			stubs: {
				transition: false,
				Transition: false,
			},
		},
	});

describe('HomeyConnectionPanel', () => {
	beforeEach(() => {
		statusStore = reactive<IStatusStoreMock>({
			status: connectedStatus(),
			lastTest: null,
			fetching: false,
			testing: false,
			fetch: vi.fn().mockResolvedValue(connectedStatus()),
			testConnection: vi.fn().mockResolvedValue({ mode: 'saved', success: true }),
			clearLastTest: vi.fn(() => {
				statusStore.lastTest = null;
			}),
		});
	});

	it('loads and renders connector identity, version, state, and timestamps', async () => {
		const wrapper = mountPanel();
		await flushPromises();

		expect(statusStore.fetch).toHaveBeenCalledOnce();
		expect(wrapper.text()).toContain('devicesHomeyPlugin.status.states.connected');
		expect(wrapper.text()).toContain('Test Homey');
		expect(wrapper.text()).toContain('homey-test-id');
		expect(wrapper.text()).toContain('13.4.0');
		expect(wrapper.text()).not.toContain('2026-08-24T12:00:00.000Z');
	});

	it('renders sanitized connector errors with category-specific guidance', async () => {
		statusStore.status = {
			...connectedStatus(),
			connectionState: DevicesHomeyPluginConnectionState.authentication_failed,
			lastErrorCategory: DevicesHomeyPluginErrorCategory.authentication,
			lastError: 'Homey authentication failed.',
		};
		const wrapper = mountPanel();
		await flushPromises();

		expect(wrapper.text()).toContain('Homey authentication failed.');
		expect(wrapper.text()).toContain('devicesHomeyPlugin.status.guidance.authentication');
	});

	it('shows a fixed status-load error without exposing the thrown detail', async () => {
		statusStore.status = null;
		statusStore.fetch.mockRejectedValueOnce(new Error('private status detail'));
		const wrapper = mountPanel();
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeyPlugin.status.loadFailed');
		expect(wrapper.text()).not.toContain('private status detail');
	});

	it('keeps candidate testing disabled until both a safe URL and a new key are present', async () => {
		const wrapper = mountPanel({ candidateUrl: 'http://homey.local:4859' });
		await flushPromises();
		const candidateButton = wrapper.get('[data-test-id="homey-test-candidate"]');

		expect(candidateButton.attributes('disabled')).toBeDefined();

		await wrapper.setProps({ candidateApiKey: 'new-candidate-key' });
		expect(wrapper.html()).not.toContain('new-candidate-key');
		await candidateButton.trigger('click');

		expect(statusStore.testConnection).toHaveBeenCalledWith({
			data: {
				mode: 'candidate',
				url: 'http://homey.local:4859',
				api_key: 'new-candidate-key',
			},
		});
	});

	it('tests the saved connector without sending candidate fields', async () => {
		const wrapper = mountPanel({
			candidateUrl: 'http://different-homey.local:4859',
			candidateApiKey: 'new-candidate-key',
		});
		await flushPromises();

		await wrapper.get('[data-test-id="homey-test-saved"]').trigger('click');

		expect(statusStore.testConnection).toHaveBeenCalledWith({ data: { mode: 'saved' } });
	});

	it('disables both actions while a test is running', async () => {
		statusStore.testing = true;
		const wrapper = mountPanel({ candidateUrl: 'http://homey.local:4859', candidateApiKey: 'new-candidate-key' });
		await flushPromises();

		expect(wrapper.get('[data-test-id="homey-test-saved"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('[data-test-id="homey-test-candidate"]').attributes('disabled')).toBeDefined();
	});

	it('renders successful identity and categorized failure guidance', async () => {
		const wrapper = mountPanel();
		await flushPromises();

		statusStore.lastTest = {
			mode: 'saved',
			success: true,
			homeyId: 'verified-homey-id',
			homeyName: 'Verified Homey',
			homeyVersion: '13.4.0',
		};
		await flushPromises();

		expect(wrapper.text()).toContain('Verified Homey · verified-homey-id · 13.4.0');

		statusStore.lastTest = {
			mode: 'candidate',
			success: false,
			errorCategory: DevicesHomeyPluginErrorCategory.authorization,
			error: 'The Homey API key does not have the required permissions.',
		};
		await flushPromises();

		expect(wrapper.text()).toContain('The Homey API key does not have the required permissions.');
		expect(wrapper.text()).toContain('devicesHomeyPlugin.status.guidance.authorization');
	});

	it('clears a completed candidate result when its inputs change', async () => {
		const wrapper = mountPanel({ candidateUrl: 'http://homey.local:4859', candidateApiKey: 'candidate-key' });
		await flushPromises();

		statusStore.lastTest = {
			mode: 'candidate',
			success: true,
			homeyId: 'verified-homey-id',
			homeyName: 'Verified Homey',
			homeyVersion: '13.4.0',
		};
		await flushPromises();

		expect(wrapper.text()).toContain('Verified Homey · verified-homey-id · 13.4.0');

		await wrapper.setProps({ candidateUrl: 'http://new-homey.local:4859' });
		await flushPromises();

		expect(statusStore.lastTest).toBeNull();
		expect(wrapper.text()).not.toContain('Verified Homey · verified-homey-id · 13.4.0');
	});

	it('clears a retained result when the panel is reopened', async () => {
		statusStore.lastTest = {
			mode: 'saved',
			success: true,
			homeyName: 'Previously Verified Homey',
		};

		const wrapper = mountPanel();
		await flushPromises();

		expect(statusStore.lastTest).toBeNull();
		expect(wrapper.text()).not.toContain('Previously Verified Homey');
	});

	it('discards a candidate result completed after its inputs change', async () => {
		let completeTest: (() => void) | undefined;
		statusStore.testConnection.mockImplementationOnce(
			() =>
				new Promise<IHomeyTestConnection>((resolve) => {
					completeTest = () => {
						const result: IHomeyTestConnection = {
							mode: 'candidate',
							success: true,
							homeyName: 'Stale Homey',
						};
						statusStore.lastTest = result;
						resolve(result);
					};
				})
		);
		const wrapper = mountPanel({ candidateUrl: 'http://homey.local:4859', candidateApiKey: 'candidate-key' });
		await flushPromises();

		await wrapper.get('[data-test-id="homey-test-candidate"]').trigger('click');
		await wrapper.setProps({ candidateApiKey: 'replacement-key' });
		completeTest?.();
		await flushPromises();

		expect(statusStore.lastTest).toBeNull();
		expect(wrapper.text()).not.toContain('Stale Homey');
	});

	it('discards a test result completed after its panel is unmounted', async () => {
		let completeTest: (() => void) | undefined;
		statusStore.testConnection.mockImplementationOnce(
			() =>
				new Promise<IHomeyTestConnection>((resolve) => {
					completeTest = () => {
						const result: IHomeyTestConnection = {
							mode: 'candidate',
							success: true,
							homeyName: 'Unmounted Homey',
						};
						statusStore.lastTest = result;
						resolve(result);
					};
				})
		);
		const oldPanel = mountPanel({ candidateUrl: 'http://homey.local:4859', candidateApiKey: 'candidate-key' });
		await flushPromises();

		await oldPanel.get('[data-test-id="homey-test-candidate"]').trigger('click');
		oldPanel.unmount();
		const reopenedPanel = mountPanel({ candidateUrl: 'http://homey.local:4859', candidateApiKey: 'candidate-key' });
		completeTest?.();
		await flushPromises();

		expect(statusStore.lastTest).toBeNull();
		expect(reopenedPanel.text()).not.toContain('Unmounted Homey');
	});

	it('shows a fixed request error without exposing the thrown detail', async () => {
		statusStore.testConnection.mockRejectedValueOnce(new Error('private transport detail'));
		const wrapper = mountPanel();
		await flushPromises();

		await wrapper.get('[data-test-id="homey-test-saved"]').trigger('click');
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeyPlugin.connectionTest.requestFailed');
		expect(wrapper.text()).not.toContain('private transport detail');
		expect(wrapper.get('[data-test-id="homey-test-feedback"]').classes()).toContain('mt-4');
	});
});
