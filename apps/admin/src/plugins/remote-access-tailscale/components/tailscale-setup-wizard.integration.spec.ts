import { ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { useTailscaleStatusStore } from '../store/tailscale-status.store';

import SetupWizard from './tailscale-setup-wizard.vue';

const fns = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), flashError: vi.fn() }));
let store: ReturnType<typeof useTailscaleStatusStore>;
let snapshot: Record<string, unknown>;
const type = 'remote-access-tailscale-plugin';

vi.mock('vue-i18n', async () => ({ ...(await vi.importActual('vue-i18n')), useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('qr') } }));
vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client: { GET: fns.get, POST: fns.post } }),
	useLogger: () => ({ error: vi.fn(), warning: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
	injectStoresManager: () => ({ getStore: () => store }),
	useFlashMessage: () => ({ error: fns.flashError, success: vi.fn() }),
	useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
	getErrorReason: () => 'Request failed',
	getErrorCode: () => null,
}));
vi.mock('../../../modules/config', async () => ({
	...(await vi.importActual('../../../modules/config')),
	useConfigPlugin: () => ({ configPlugin: ref(null), fetchConfigPlugin: vi.fn().mockResolvedValue(undefined) }),
}));
const wrappers: ReturnType<typeof shallowMount>[] = [];
const mountWizard = (initialStep: 'setup' | 'signin' = 'setup') => {
	const wrapper = shallowMount(SetupWizard, {
		props: { visible: true, initialStep },
		global: {
			renderStubDefaultSlot: true,
			stubs: {
				ElDialog: { template: '<div><slot /></div>' },
				ElSteps: { name: 'ElSteps', props: ['active'], template: '<div><slot /></div>' },
			},
		},
	});
	wrappers.push(wrapper);
	return wrapper;
};
const activeStep = (wrapper: ReturnType<typeof mountWizard>) => wrapper.findComponent({ name: 'ElSteps' }).props('active');
const job = (jobId: string, state: string) => ({ job_id: jobId, state, step: null, message: null, updated_at: '2026-10-04T10:00:00Z' });
const complete = () => {
	snapshot.setup = job('job-new', 'complete');
	snapshot.requirements = [{ code: 'binary-installed', satisfied: true, message: 'Installed', remedy: null }];
};

describe('Tailscale setup wizard with actual store and composables', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setActivePinia(createPinia());
		vi.clearAllMocks();
		snapshot = {
			epoch: 'server',
			revision: 1,
			type,
			state: 'setup-required',
			endpoints: [],
			message: null,
			details: {},
			proxy_addresses: [],
			advisories: [],
			updated_at: '2026-10-04T10:00:00Z',
			requirements: [{ code: 'binary-installed', satisfied: false, message: 'Install required', remedy: null }],
			setup: null,
			privileged_setup: { available: true, reason: null },
			control: { enabled: true, service_state: 'stopped', authentication: 'required', operation: null, available_actions: ['login'] },
		};
		fns.get.mockImplementation(async () => ({ data: { data: structuredClone(snapshot) }, response: { status: 200 } }));
		fns.post.mockResolvedValue({ data: { data: { job: 'job-new' } }, response: { status: 202 } });
		store = useTailscaleStatusStore();
	});
	afterEach(() => {
		for (const wrapper of wrappers.splice(0)) wrapper.unmount();
		vi.useRealTimers();
	});

	it.each(['pending-auth', 'connecting', 'pending-approval'])(
		'reports a keyed login timeout with %s as the last status and allows a retry',
		async (state) => {
			snapshot.state = state;
			fns.post.mockResolvedValue({ data: { data: { state } }, response: { status: 200 } });
			const wrapper = mountWizard('signin');
			await flushPromises();
			wrapper.findComponent({ name: 'ElInput' }).vm.$emit('update:model-value', 'synthetic-invalid-key');
			await flushPromises();
			wrapper.findAllComponents({ name: 'ElButton' })[1]!.vm.$emit('click');
			await flushPromises();
			await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 3_000);
			expect(activeStep(wrapper)).toBe(1);
			expect(fns.flashError).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(3_000);
			expect(activeStep(wrapper)).toBe(1);
			expect(fns.flashError).toHaveBeenCalledExactlyOnceWith('remoteAccessTailscalePlugin.messages.loginTimedOut');
			expect(wrapper.findComponent({ name: 'ElInput' }).props('modelValue')).toBe('');
			await vi.advanceTimersByTimeAsync(6_000);
			expect(fns.flashError).toHaveBeenCalledTimes(1);

			fns.flashError.mockClear();
			wrapper.findComponent({ name: 'ElInput' }).vm.$emit('update:model-value', 'synthetic-retry-key');
			await flushPromises();
			wrapper.findAllComponents({ name: 'ElButton' })[1]!.vm.$emit('click');
			await flushPromises();
			await vi.advanceTimersByTimeAsync(3_000);
			expect(fns.flashError).not.toHaveBeenCalled();
			await wrapper.setProps({ visible: false });
			await wrapper.setProps({ visible: true });
			await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
			expect(fns.flashError).not.toHaveBeenCalled();
		}
	);

	it('immediately reconciles acceptance and advances after REST completion with all events lost', async () => {
		const wrapper = mountWizard();
		await flushPromises();
		fns.get.mockClear();
		snapshot.setup = job('job-new', 'running');
		wrapper.findAllComponents({ name: 'ElButton' })[0]!.vm.$emit('click');
		await flushPromises();
		expect(fns.get).toHaveBeenCalledTimes(1);
		expect(activeStep(wrapper)).toBe(0);
		complete();
		// Provider revision intentionally remains unchanged: setup is independent metadata.
		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();
		expect(activeStep(wrapper)).toBe(1);
	});

	it('a second install ignores cached terminal status and delayed previous-job completion', async () => {
		snapshot.setup = job('job-old', 'failed');
		const wrapper = mountWizard();
		await flushPromises();
		wrapper.findAllComponents({ name: 'ElButton' })[0]!.vm.$emit('click');
		await flushPromises();
		store.onEvent({ event: 'RemoteAccessModule.Setup.Progress', data: { type, job: 'job-old', state: 'complete' } });
		await flushPromises();
		expect(activeStep(wrapper)).toBe(0);
		expect(wrapper.findAllComponents({ name: 'ElButton' })[0]!.props('loading')).toBe(true);
		complete();
		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();
		expect(activeStep(wrapper)).toBe(1);
	});

	it('retries an initial status failure after accepted installation', async () => {
		const wrapper = mountWizard();
		await flushPromises();
		fns.get.mockRejectedValueOnce(new Error('temporarily offline'));
		wrapper.findAllComponents({ name: 'ElButton' })[0]!.vm.$emit('click');
		await flushPromises();
		expect(fns.flashError).not.toHaveBeenCalled();
		complete();
		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();
		expect(activeStep(wrapper)).toBe(1);
	});

	it('recovers terminal setup after reload without websocket progress', async () => {
		complete();
		const wrapper = mountWizard();
		await flushPromises();
		expect(activeStep(wrapper)).toBe(1);
	});

	it('recovers a terminal job already loaded before the wizard mounts', async () => {
		complete();
		await store.get();
		const wrapper = mountWizard();
		await flushPromises();
		expect(activeStep(wrapper)).toBe(1);
	});

	it.each(['failed', 'timeout'])('settles the setup spinner on %s', async (state) => {
		const wrapper = mountWizard();
		await flushPromises();
		wrapper.findAllComponents({ name: 'ElButton' })[0]!.vm.$emit('click');
		await flushPromises();
		snapshot.setup = job('job-new', state);
		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();
		expect(activeStep(wrapper)).toBe(0);
		expect(wrapper.findAllComponents({ name: 'ElButton' })[0]!.props('loading')).toBe(false);
	});
	it('adopts an authenticated manual installation and proceeds to options', async () => {
		complete();
		snapshot.control = {
			enabled: true,
			service_state: 'stopped',
			authentication: 'authenticated',
			operation: null,
			available_actions: ['connect', 'disconnect'],
		};
		const wrapper = mountWizard();
		await flushPromises();
		expect(activeStep(wrapper)).toBe(2);
	});
});
