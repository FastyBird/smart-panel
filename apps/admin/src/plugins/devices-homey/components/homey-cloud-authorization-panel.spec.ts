import { reactive } from 'vue';

import { ElOption, ElSelect } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesHomeyPluginConnectionMode } from '../../../openapi.constants';
import type { IHomeyCloudAuthorizationStatus, IHomeyCloudHomeyChoices } from '../store/homey.types';

import HomeyCloudAuthorizationPanel from './HomeyCloudAuthorizationPanel.vue';

interface ICloudAuthorizationStoreMock {
	status: IHomeyCloudAuthorizationStatus | null;
	pendingTransaction: { transactionId: string; expiresAt: string } | null;
	homeys: IHomeyCloudHomeyChoices['homeys'];
	fetching: boolean;
	authorizing: boolean;
	mutating: boolean;
	fetchStatus: ReturnType<typeof vi.fn>;
	start: ReturnType<typeof vi.fn>;
	resume: ReturnType<typeof vi.fn>;
	select: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
	disconnect: ReturnType<typeof vi.fn>;
}

let authorizationStore: ICloudAuthorizationStoreMock;

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../store/homey-cloud-authorization.store', () => ({ useHomeyCloudAuthorization: () => authorizationStore }));

const mountPanel = (
	props: {
		savedMode?: DevicesHomeyPluginConnectionMode;
		configurationSaved?: boolean;
		navigateToAuthorization?: (url: string) => void;
	} = {}
) =>
	mount(HomeyCloudAuthorizationPanel, {
		props,
		global: { stubs: { transition: false, Transition: false } },
	});

describe('HomeyCloudAuthorizationPanel', () => {
	beforeEach(() => {
		authorizationStore = reactive<ICloudAuthorizationStoreMock>({
			status: { connected: false, selectedHomeyId: null },
			pendingTransaction: null,
			homeys: [],
			fetching: false,
			authorizing: false,
			mutating: false,
			fetchStatus: vi.fn().mockResolvedValue({ connected: false }),
			start: vi.fn().mockResolvedValue({
				authorizeUrl: 'https://api.athom.com/oauth2/authorise',
				transactionId: 'transaction-id',
				expiresAt: '2099-08-30T12:00:00.000Z',
			}),
			resume: vi.fn().mockResolvedValue(null),
			select: vi.fn().mockResolvedValue({ status: 'connected', changed: true, homeyId: 'homey-b' }),
			cancel: vi.fn().mockResolvedValue({ status: 'cancelled', changed: true }),
			disconnect: vi.fn().mockResolvedValue({ status: 'disconnected', changed: true }),
		});
	});

	it('loads status and resumes a page-scoped transaction', async () => {
		mountPanel();
		await flushPromises();

		expect(authorizationStore.fetchStatus).toHaveBeenCalledOnce();
		expect(authorizationStore.resume).toHaveBeenCalledOnce();
	});

	it('does not report a status-read failure after a successful callback resume', async () => {
		authorizationStore.fetchStatus.mockRejectedValueOnce(new Error('temporary status failure'));
		authorizationStore.resume.mockImplementationOnce(async () => {
			authorizationStore.homeys = [{ id: 'homey-a', name: 'Home' }];

			return { status: 'selection_required', homeyId: null, homeys: authorizationStore.homeys };
		});
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud });
		await flushPromises();

		expect(wrapper.find('[data-test-id="homey-cloud-selection"]').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('devicesHomeyPlugin.cloudAuthorization.requestFailed');
	});

	it('requires cloud mode to be saved before authorization starts', async () => {
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.local });
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeyPlugin.cloudAuthorization.saveConfigurationFirst');
		expect(wrapper.get('[data-test-id="homey-cloud-connect"]').attributes('disabled')).toBeDefined();
	});

	it('blocks authorization while edited cloud settings are unsaved', async () => {
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud, configurationSaved: false });
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeyPlugin.cloudAuthorization.saveConfigurationFirst');
		expect(wrapper.get('[data-test-id="homey-cloud-connect"]').attributes('disabled')).toBeDefined();
		await wrapper.get('[data-test-id="homey-cloud-connect"]').trigger('click');
		expect(authorizationStore.start).not.toHaveBeenCalled();
	});

	it('does not present an unknown grant status as disconnected', async () => {
		authorizationStore.status = null;
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud });
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeyPlugin.cloudAuthorization.unknown');
		expect(wrapper.text()).not.toContain('devicesHomeyPlugin.cloudAuthorization.disconnected');
		expect(wrapper.find('[data-test-id="homey-cloud-connect"]').exists()).toBe(false);
	});

	it('persists through the store and navigates to Homey authorization', async () => {
		const navigate = vi.fn();
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud, navigateToAuthorization: navigate });
		await flushPromises();

		await wrapper.get('[data-test-id="homey-cloud-connect"]').trigger('click');
		await flushPromises();

		expect(authorizationStore.start).toHaveBeenCalledWith(false);
		expect(navigate).toHaveBeenCalledWith('https://api.athom.com/oauth2/authorise');
	});

	it('disables disconnect while reconnect authorization is starting', async () => {
		authorizationStore.status = { connected: true, selectedHomeyId: 'homey-id' };
		authorizationStore.start.mockImplementationOnce(
			() =>
				new Promise(() => {
					authorizationStore.authorizing = true;
				})
		);
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud });
		await flushPromises();

		await wrapper.get('[data-test-id="homey-cloud-reconnect"]').trigger('click');
		await wrapper.vm.$nextTick();

		expect(wrapper.get('[data-test-id="homey-cloud-disconnect"]').attributes('disabled')).toBeDefined();
	});

	it('renders eligible Homeys returned after the callback', async () => {
		authorizationStore.homeys = [
			{ id: 'homey-a', name: 'Home' },
			{ id: 'homey-b', name: 'Cabin' },
		];
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud });
		await flushPromises();

		expect(wrapper.find('[data-test-id="homey-cloud-selection"]').exists()).toBe(true);
		expect(wrapper.findAllComponents(ElOption).map((option) => option.props('label'))).toEqual(['Home', 'Cabin']);
	});

	it('clears a selection that disappears when the store refreshes rejected choices', async () => {
		authorizationStore.homeys = [
			{ id: 'homey-a', name: 'Home' },
			{ id: 'homey-b', name: 'Cabin' },
		];
		authorizationStore.select.mockImplementationOnce(async () => {
			authorizationStore.homeys = [{ id: 'homey-a', name: 'Home' }];
			throw new Error('selection rejected');
		});
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud });
		await flushPromises();

		wrapper.getComponent(ElSelect).vm.$emit('update:modelValue', 'homey-b');
		await wrapper.vm.$nextTick();
		await wrapper.get('[data-test-id="homey-cloud-select"]').trigger('click');
		await flushPromises();

		expect(authorizationStore.select).toHaveBeenCalledWith('homey-b');
		expect(wrapper.getComponent(ElSelect).props('modelValue')).toBeNull();
		expect(wrapper.get('[data-test-id="homey-cloud-select"]').attributes('disabled')).toBeDefined();
	});

	it('shows only a fixed error when authorization fails', async () => {
		authorizationStore.start.mockRejectedValueOnce(new Error('private OAuth detail'));
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.cloud });
		await flushPromises();

		await wrapper.get('[data-test-id="homey-cloud-connect"]').trigger('click');
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeyPlugin.cloudAuthorization.requestFailed');
		expect(wrapper.text()).not.toContain('private OAuth detail');
	});
});
