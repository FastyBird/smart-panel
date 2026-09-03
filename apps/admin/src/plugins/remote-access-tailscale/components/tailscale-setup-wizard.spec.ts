import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { FormResult } from '../../../modules/config';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';

import TailscaleSetupWizard from './tailscale-setup-wizard.vue';

// Only the mock functions themselves are hoisted (vi.mock factories need them, and vi.fn() does
// not depend on any import). The reactive state below is declared as plain top-level `const` -
// vi.hoisted() runs before `import { ref } from 'vue'` is linked, so a `ref()` call inside it
// throws "Cannot access '__vi_import_0__' before initialization"; a `vi.mock(...)` factory, by
// contrast, is only invoked lazily once something actually imports the mocked module, by which
// point these top-level consts are already initialized. Mirrors homey-config-form.spec.ts.
const fns = vi.hoisted(() => ({
	fetchStatus: vi.fn(),
	install: vi.fn(),
	login: vi.fn(),
	stopPolling: vi.fn(),
	fetchConfigPlugin: vi.fn(),
	flashError: vi.fn(),
	flashSuccess: vi.fn(),
}));

const status = ref<{ state: string; endpoints: { url: string; label: string }[] } | null>(null);
const requirements = ref<{ code: string; satisfied: boolean; message: string }[]>([]);
const progress = ref<{ state: string; step?: string; message?: string } | null>(null);
const isInstalling = ref(false);
const isLoggingIn = ref(false);
const isPolling = ref(false);
const configPlugin = ref<{ type: string; enabled: boolean } | null>({ type: 'remote-access-tailscale-plugin', enabled: true });

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ success: fns.flashSuccess, error: fns.flashError }),
}));

vi.mock('../../../modules/config', async () => {
	const actual = await vi.importActual('../../../modules/config');

	return {
		...actual,
		useConfigPlugin: () => ({ configPlugin, isLoading: ref(false), fetchConfigPlugin: fns.fetchConfigPlugin }),
	};
});

vi.mock('../composables', () => ({
	useTailscaleStatus: () => ({
		status,
		requirements,
		isLoading: ref(false),
		isLoggingOut: ref(false),
		isResettingPreferences: ref(false),
		fetchStatus: fns.fetchStatus,
		logout: vi.fn(),
		resetPreferences: vi.fn(),
	}),
	useTailscaleSetup: () => ({
		progress,
		isInstalling,
		install: fns.install,
	}),
	useTailscaleLogin: () => ({
		isLoggingIn,
		isPolling,
		login: fns.login,
		stopPolling: fns.stopPolling,
	}),
}));

const mountWizard = (initialStep: 'setup' | 'signin' | 'options' | 'done' = 'setup') =>
	shallowMount(TailscaleSetupWizard, {
		props: { visible: true, initialStep },
		global: {
			// @vue/test-utils defaults auto-stubbed children to an empty slot, so a translated
			// button/alert label written as slot content (not a prop) would never reach
			// wrapper.text() otherwise - mirrors view-space-configure.spec.ts.
			renderStubDefaultSlot: true,
			stubs: {
				ElDialog: { name: 'ElDialog', template: '<div><slot /></div>' },
				ElSteps: { name: 'ElSteps', props: ['active'], template: '<div><slot /></div>' },
			},
		},
	});

const stepsProp = (wrapper: ReturnType<typeof mountWizard>): number => wrapper.findComponent({ name: 'ElSteps' }).props('active') as number;

describe('TailscaleSetupWizard', () => {
	beforeEach(() => {
		status.value = null;
		requirements.value = [];
		progress.value = null;
		isInstalling.value = false;
		isLoggingIn.value = false;
		isPolling.value = false;
		configPlugin.value = { type: 'remote-access-tailscale-plugin', enabled: true };
		fns.fetchStatus.mockReset().mockResolvedValue(undefined);
		fns.install.mockReset().mockResolvedValue('job-123');
		fns.login.mockReset();
		fns.stopPolling.mockReset();
		fns.fetchConfigPlugin.mockReset().mockResolvedValue(undefined);
		fns.flashError.mockReset();
		fns.flashSuccess.mockReset();
	});

	it('opens on the step the card decided (setup)', () => {
		const wrapper = mountWizard('setup');

		expect(stepsProp(wrapper)).toBe(0);
		expect(wrapper.text()).toContain('remoteAccessTailscalePlugin.wizard.buttons.startSetup');
	});

	it('opens directly on sign-in when the card already knows setup is done', () => {
		const wrapper = mountWizard('signin');

		expect(stepsProp(wrapper)).toBe(1);
		expect(wrapper.text()).toContain('remoteAccessTailscalePlugin.wizard.buttons.getSignInLink');
	});

	it('fetches the plugin config and renders the options form when opened directly on options', async () => {
		// Regression test: `currentStep` starts life already equal to `props.initialStep`, so
		// reassigning it to the same value from the `visible` watcher is a no-op Vue never
		// reports as a change - only a watcher declared `immediate: true` is guaranteed to fetch
		// the config on this direct-open path (see the comment above that watch() call).
		const wrapper = mountWizard('options');

		expect(stepsProp(wrapper)).toBe(2);
		expect(fns.fetchConfigPlugin).toHaveBeenCalled();

		await flushPromises();

		expect(wrapper.findComponent({ name: 'TailscaleConfigForm' }).exists()).toBe(true);
	});

	it('advances from setup to sign-in once the install job completes', async () => {
		const wrapper = mountWizard('setup');

		expect(stepsProp(wrapper)).toBe(0);

		progress.value = { state: 'complete' };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(1);
		expect(fns.fetchStatus).toHaveBeenCalled();
	});

	it('does not advance past setup while the install job is still running', async () => {
		const wrapper = mountWizard('setup');

		progress.value = { state: 'running', step: 'install-package' };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(0);
	});

	it('does not advance when the install job fails', async () => {
		const wrapper = mountWizard('setup');

		progress.value = { state: 'failed', message: 'apt-get failed' };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(0);
		// The error alert's message is an ElAlert `title` prop, not slot content, so it never
		// reaches wrapper.text() even with renderStubDefaultSlot - inspect the stub's props instead.
		const errorAlert = wrapper.findAllComponents({ name: 'ElAlert' }).find((alert) => alert.props('type') === 'error');
		expect(errorAlert?.props('title')).toBe('apt-get failed');
	});

	describe('install error messages', () => {
		it('surfaces the backend reason for a 409 (a setup job is already running)', async () => {
			fns.install.mockRejectedValue(new RemoteAccessTailscaleApiException('A Tailscale setup job is already running.', 409));
			const wrapper = mountWizard('setup');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('A Tailscale setup job is already running.');
		});

		it('surfaces the backend reason for a 422 (permanently unsupported platform)', async () => {
			fns.install.mockRejectedValue(new RemoteAccessTailscaleApiException('Tailscale setup is unavailable on this platform.', 422));
			const wrapper = mountWizard('setup');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('Tailscale setup is unavailable on this platform.');
		});

		it('falls back to a translated generic message for an unexpected install error', async () => {
			fns.install.mockRejectedValue(new RemoteAccessTailscaleApiException('Internal error detail', 500));
			const wrapper = mountWizard('setup');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('remoteAccessTailscalePlugin.messages.setupFailed');
		});

		it('falls back to a translated generic message for a non-API error', async () => {
			fns.install.mockRejectedValue(new Error('network blip'));
			const wrapper = mountWizard('setup');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('remoteAccessTailscalePlugin.messages.setupFailed');
		});
	});

	it('advances from sign-in to options once the node reports connected', async () => {
		const wrapper = mountWizard('signin');

		expect(stepsProp(wrapper)).toBe(1);

		status.value = { state: 'connected', endpoints: [] };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(2);
	});

	describe('login error messages', () => {
		it('surfaces the backend reason for a 409 (a sign-in is already in flight)', async () => {
			fns.login.mockRejectedValue(new RemoteAccessTailscaleApiException('A Tailscale sign-in is already in progress.', 409));
			const wrapper = mountWizard('signin');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('A Tailscale sign-in is already in progress.');
		});

		it('falls back to a translated generic message for an unexpected login error', async () => {
			fns.login.mockRejectedValue(new RemoteAccessTailscaleApiException('Internal error detail', 500));
			const wrapper = mountWizard('signin');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('remoteAccessTailscalePlugin.messages.loginFailed');
		});
	});

	it('does not jump ahead from setup just because the status happens to already be connected', async () => {
		// The connected-status watcher only fires the transition while sitting on the sign-in step -
		// a stray status update must not skip the setup step's own progress-driven transition.
		const wrapper = mountWizard('setup');

		status.value = { state: 'connected', endpoints: [] };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(0);
	});

	it('advances from options to done once the config form reports success', async () => {
		const wrapper = mountWizard('options');

		expect(stepsProp(wrapper)).toBe(2);

		await wrapper.findComponent({ name: 'TailscaleConfigForm' }).vm.$emit('update:remote-form-result', FormResult.OK);
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(3);
	});

	it('the skip button on options moves straight to done without waiting on the form', async () => {
		const wrapper = mountWizard('options');

		// The options step renders exactly two buttons, in order: Skip, then Save and continue.
		// Auto-stubbed ElButton children under shallowMount do not forward a native click into the
		// `@click` component-event listener, so the click is simulated the same way
		// mcp-token-dialog.spec.ts does: emitting the event directly on the found stub instance.
		await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');

		expect(stepsProp(wrapper)).toBe(3);
	});

	it('done lists the connected endpoints', () => {
		status.value = { state: 'connected', endpoints: [{ url: 'https://panel.example.ts.net', label: 'Tailscale (HTTPS)' }] };
		const wrapper = mountWizard('done');

		expect(wrapper.text()).toContain('https://panel.example.ts.net');
	});

	it('resets back to the initial step and clears the sign-in link every time it reopens', async () => {
		const wrapper = mountWizard('signin');

		status.value = { state: 'connected', endpoints: [] };
		await flushPromises();
		expect(stepsProp(wrapper)).toBe(2);

		await wrapper.setProps({ visible: false });
		await wrapper.setProps({ visible: true });

		expect(stepsProp(wrapper)).toBe(1);
		expect(fns.stopPolling).toHaveBeenCalled();
	});

	it('stops polling when the wizard is closed', async () => {
		const wrapper = mountWizard('signin');

		await wrapper.setProps({ visible: false });

		expect(fns.stopPolling).toHaveBeenCalled();
	});
});
