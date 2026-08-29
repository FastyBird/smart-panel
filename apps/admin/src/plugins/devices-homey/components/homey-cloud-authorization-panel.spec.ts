import { reactive } from 'vue';

import { ElOption } from 'element-plus';
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

const mountPanel = (props: { savedMode?: DevicesHomeyPluginConnectionMode; navigateToAuthorization?: (url: string) => void } = {}) =>
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

	it('requires cloud mode to be saved before authorization starts', async () => {
		const wrapper = mountPanel({ savedMode: DevicesHomeyPluginConnectionMode.local });
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeyPlugin.cloudAuthorization.saveCloudModeFirst');
		expect(wrapper.get('[data-test-id="homey-cloud-connect"]').attributes('disabled')).toBeDefined();
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
