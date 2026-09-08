import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { FormResult } from '../../../modules/config';
import { RemoteAccessCloudflareTunnelApiException } from '../remote-access-cloudflare-tunnel.exceptions';

import CloudflareTunnelSetupWizard from './cloudflare-tunnel-setup-wizard.vue';

// Only the mock functions themselves are hoisted (vi.mock factories need them, and vi.fn() does
// not depend on any import) - mirrors `tailscale-setup-wizard.spec.ts`.
const fns = vi.hoisted(() => ({
	fetchStatus: vi.fn(),
	install: vi.fn(),
	stopSetupPolling: vi.fn(),
	fetchConfigPlugin: vi.fn(),
	flashError: vi.fn(),
	flashSuccess: vi.fn(),
	copy: vi.fn(),
}));

const status = ref<{ state: string; endpoints: { url: string; label: string; https: boolean }[]; message?: string } | null>(null);
const requirements = ref<{ code: string; satisfied: boolean; message: string; remedy: { commands: string[]; note: string | null } | null }[]>([]);
const setup = ref<{ state: string; step: string | null; message: string | null } | null>(null);
const privilegedSetup = ref<{ available: boolean; reason: string | null } | null>({ available: true, reason: null });
const progress = ref<{ state: string; step?: string; message?: string } | null>(null);
const isInstalling = ref(false);
const configPlugin = ref<{ type: string; enabled: boolean } | null>({ type: 'remote-access-cloudflare-tunnel-plugin', enabled: false });

vi.mock('qrcode', () => ({
	default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') },
}));

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ success: fns.flashSuccess, error: fns.flashError }),
	useClipboard: () => ({ copy: fns.copy }),
}));

vi.mock('../../../modules/config', async () => {
	const actual = await vi.importActual('../../../modules/config');

	return {
		...actual,
		useConfigPlugin: () => ({ configPlugin, isLoading: ref(false), fetchConfigPlugin: fns.fetchConfigPlugin }),
	};
});

vi.mock('../composables', () => ({
	useCloudflareTunnelStatus: () => ({
		status,
		requirements,
		setup,
		privilegedSetup,
		isLoading: ref(false),
		isResetting: ref(false),
		fetchStatus: fns.fetchStatus,
		reset: vi.fn(),
	}),
	useCloudflareTunnelSetup: () => ({
		progress,
		isInstalling,
		install: fns.install,
		stopPolling: fns.stopSetupPolling,
	}),
}));

const mountWizard = (initialStep: 'install' | 'config' | 'done' = 'install') =>
	shallowMount(CloudflareTunnelSetupWizard, {
		props: { visible: true, initialStep },
		global: {
			// @vue/test-utils defaults auto-stubbed children to an empty slot, so a translated
			// button/alert label written as slot content (not a prop) would never reach
			// wrapper.text() otherwise - mirrors `tailscale-setup-wizard.spec.ts`.
			renderStubDefaultSlot: true,
			stubs: {
				ElDialog: { name: 'ElDialog', template: '<div><slot /></div>' },
				ElSteps: { name: 'ElSteps', props: ['active'], template: '<div><slot /></div>' },
			},
		},
	});

const stepsProp = (wrapper: ReturnType<typeof mountWizard>): number => wrapper.findComponent({ name: 'ElSteps' }).props('active') as number;

const findHintAlert = (wrapper: ReturnType<typeof mountWizard>, title: string) =>
	wrapper.findAllComponents({ name: 'ElAlert' }).find((alert) => alert.props('title') === title);

describe('CloudflareTunnelSetupWizard', () => {
	beforeEach(() => {
		status.value = null;
		requirements.value = [];
		setup.value = null;
		privilegedSetup.value = { available: true, reason: null };
		progress.value = null;
		isInstalling.value = false;
		configPlugin.value = { type: 'remote-access-cloudflare-tunnel-plugin', enabled: false };
		fns.fetchStatus.mockReset().mockResolvedValue(undefined);
		fns.install.mockReset().mockResolvedValue('job-123');
		fns.stopSetupPolling.mockReset();
		fns.fetchConfigPlugin.mockReset().mockResolvedValue(undefined);
		fns.flashError.mockReset();
		fns.flashSuccess.mockReset();
		fns.copy.mockReset().mockResolvedValue(true);
	});

	it('opens on the step the card decided (install)', () => {
		const wrapper = mountWizard('install');

		expect(stepsProp(wrapper)).toBe(0);
		expect(wrapper.text()).toContain('remoteAccessCloudflareTunnelPlugin.wizard.buttons.startSetup');
	});

	it('opens directly on the config step when the card already knows install is done (the "Configure" action)', async () => {
		const wrapper = mountWizard('config');

		expect(stepsProp(wrapper)).toBe(1);
		expect(fns.fetchConfigPlugin).toHaveBeenCalled();

		await flushPromises();

		expect(wrapper.findComponent({ name: 'CloudflareTunnelConfigForm' }).exists()).toBe(true);
	});

	it('forces the config it binds to as enabled once loaded, so a plain save enables the tunnel', async () => {
		configPlugin.value = { type: 'remote-access-cloudflare-tunnel-plugin', enabled: false };
		mountWizard('config');

		await flushPromises();

		expect(configPlugin.value?.enabled).toBe(true);
	});

	it('advances from install to config once the install job completes', async () => {
		const wrapper = mountWizard('install');

		expect(stepsProp(wrapper)).toBe(0);

		progress.value = { state: 'complete' };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(1);
		expect(fns.fetchStatus).toHaveBeenCalled();
	});

	it('does not advance past install while the install job is still running', async () => {
		const wrapper = mountWizard('install');

		progress.value = { state: 'running', step: 'install-package' };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(0);
	});

	it('does not advance when the install job fails', async () => {
		const wrapper = mountWizard('install');

		progress.value = { state: 'failed', message: 'apt-get failed' };
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(0);
		const errorAlert = wrapper.findAllComponents({ name: 'ElAlert' }).find((alert) => alert.props('type') === 'error');
		expect(errorAlert?.props('title')).toBe('apt-get failed');
	});

	describe('install error messages', () => {
		it('surfaces the backend reason for a 422 (permanently unsupported platform)', async () => {
			fns.install.mockRejectedValue(new RemoteAccessCloudflareTunnelApiException('Cloudflare Tunnel setup is unavailable on this platform.', 422));
			const wrapper = mountWizard('install');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('Cloudflare Tunnel setup is unavailable on this platform.');
		});

		it('falls back to a translated generic message for an unexpected install error', async () => {
			fns.install.mockRejectedValue(new RemoteAccessCloudflareTunnelApiException('Internal error detail', 500));
			const wrapper = mountWizard('install');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('remoteAccessCloudflareTunnelPlugin.messages.setupFailed');
		});

		it('falls back to a translated generic message for a non-API error', async () => {
			fns.install.mockRejectedValue(new Error('network blip'));
			const wrapper = mountWizard('install');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('remoteAccessCloudflareTunnelPlugin.messages.setupFailed');
		});
	});

	it('advances from config to done once the config form reports success', async () => {
		const wrapper = mountWizard('config');
		expect(stepsProp(wrapper)).toBe(1);

		await wrapper.findComponent({ name: 'CloudflareTunnelConfigForm' }).vm.$emit('update:remote-form-result', FormResult.OK);
		await flushPromises();

		expect(stepsProp(wrapper)).toBe(2);
	});

	it('done shows the public https endpoint URL with a QR code and the Cloudflare Access recommendation', async () => {
		status.value = { state: 'connected', endpoints: [{ url: 'https://panel.example.com', label: 'Cloudflare Tunnel', https: true }] };
		const wrapper = mountWizard('done');
		await flushPromises();

		expect(wrapper.text()).toContain('https://panel.example.com');
		// The ElAlert title is a prop, not slot content - it never reaches wrapper.text() even with
		// renderStubDefaultSlot (same note as the Tailscale wizard's own error-hint alerts).
		expect(findHintAlert(wrapper, 'remoteAccessCloudflareTunnelPlugin.wizard.accessRecommendation')).toBeTruthy();
		expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,QR');
	});

	it('copies the public URL to the clipboard via the shared composable and shows a success toast', async () => {
		status.value = { state: 'connected', endpoints: [{ url: 'https://panel.example.com', label: 'Cloudflare Tunnel', https: true }] };
		const wrapper = mountWizard('done');
		await flushPromises();

		// The 'done' step renders the URL's own copy button before Close - emit click on the first button.
		await wrapper.findAllComponents({ name: 'ElButton' })[0]!.vm.$emit('click');
		await flushPromises();

		expect(fns.copy).toHaveBeenCalledWith('https://panel.example.com');
		expect(fns.flashSuccess).toHaveBeenCalledWith('remoteAccessCloudflareTunnelPlugin.messages.urlCopied');
	});

	it('resets back to the initial step every time it reopens', async () => {
		const wrapper = mountWizard('config');

		await wrapper.setProps({ visible: false });
		await wrapper.setProps({ visible: true });

		expect(stepsProp(wrapper)).toBe(1);
	});

	it('stops the setup poll when the wizard is closed', async () => {
		const wrapper = mountWizard('install');

		await wrapper.setProps({ visible: false });

		expect(fns.stopSetupPolling).toHaveBeenCalled();
	});

	it('stops the setup poll when the wizard unmounts', () => {
		const wrapper = mountWizard('install');

		wrapper.unmount();

		expect(fns.stopSetupPolling).toHaveBeenCalled();
	});

	describe('D12: privileged setup availability', () => {
		it('offers the Set up button plus a "Run it yourself" disclosure when privileged setup is available and a remedy exists', () => {
			privilegedSetup.value = { available: true, reason: null };
			requirements.value = [
				{
					code: 'binary-installed',
					satisfied: false,
					message: 'cloudflared is not installed.',
					remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null },
				},
			];
			const wrapper = mountWizard('install');

			expect(wrapper.text()).toContain('remoteAccessCloudflareTunnelPlugin.wizard.buttons.startSetup');
			expect(wrapper.findComponent({ name: 'ElCollapse' }).exists()).toBe(true);
			expect(wrapper.text()).toContain('sudo apt-get install -y cloudflared');
		});

		it('replaces the Set up button with the reason, an ordered command block and a Re-check button when unavailable', () => {
			privilegedSetup.value = { available: false, reason: 'Privileged jobs are currently unavailable on this installation.' };
			requirements.value = [
				{
					code: 'binary-installed',
					satisfied: false,
					message: 'x',
					remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null },
				},
			];
			const wrapper = mountWizard('install');

			expect(wrapper.text()).not.toContain('remoteAccessCloudflareTunnelPlugin.wizard.buttons.startSetup');
			const reasonAlert = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => alert.props('title') === 'Privileged jobs are currently unavailable on this installation.');
			expect(reasonAlert).toBeTruthy();
			expect(wrapper.text()).toContain('sudo apt-get install -y cloudflared');
			expect(wrapper.text()).toContain('remoteAccessCloudflareTunnelPlugin.wizard.buttons.recheck');
		});

		it('shows only the note, with no empty command block, when the sole unsatisfied requirement has no exact command', () => {
			privilegedSetup.value = { available: false, reason: 'Unsupported platform.' };
			requirements.value = [
				{ code: 'platform-supported', satisfied: false, message: 'x', remedy: { commands: [], note: 'https://pkg.cloudflare.com/index.html' } },
			];
			const wrapper = mountWizard('install');

			expect(wrapper.text()).toContain('https://pkg.cloudflare.com/index.html');
			expect(wrapper.find('pre').exists()).toBe(false);
		});

		it('the Re-check button refetches status', async () => {
			privilegedSetup.value = { available: false, reason: 'Unavailable.' };
			const wrapper = mountWizard('install');
			fns.fetchStatus.mockClear();

			const recheckButton = wrapper.findAllComponents({ name: 'ElButton' }).find((button) => button.text().includes('recheck'));
			await recheckButton?.vm.$emit('click');
			await flushPromises();

			expect(fns.fetchStatus).toHaveBeenCalled();
		});

		it('copies the concatenated remedy commands to the clipboard', async () => {
			privilegedSetup.value = { available: false, reason: 'Unavailable.' };
			requirements.value = [
				{ code: 'binary-installed', satisfied: false, message: 'x', remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null } },
			];
			const wrapper = mountWizard('install');

			const copyButton = wrapper
				.findAllComponents({ name: 'ElButton' })
				.find((button) => button.text().includes('remoteAccessCloudflareTunnelPlugin.wizard.buttons.copy'));
			await copyButton?.vm.$emit('click');
			await flushPromises();

			expect(fns.copy).toHaveBeenCalledWith('sudo apt-get install -y cloudflared');
			expect(fns.flashSuccess).toHaveBeenCalledWith('remoteAccessCloudflareTunnelPlugin.messages.commandCopied');
		});
	});

	describe('resuming setup progress from a fresh GET /status read (D6)', () => {
		it('shows the running spinner from the polled status even though no websocket progress event has arrived', async () => {
			setup.value = { state: 'running', step: 'install-package', message: null };
			const wrapper = mountWizard('install');
			await flushPromises();

			expect(wrapper.text()).toContain('install-package');
		});

		it('advances to config once the polled status alone reaches complete', async () => {
			const wrapper = mountWizard('install');

			setup.value = { state: 'complete', step: null, message: null };
			await flushPromises();

			expect(stepsProp(wrapper)).toBe(1);
			expect(fns.fetchStatus).toHaveBeenCalled();
		});
	});

	describe('action error hints (D13)', () => {
		it('shows the privileged-worker-unavailable hint after a Set up failure carrying that error code', async () => {
			const error = new RemoteAccessCloudflareTunnelApiException(
				'Privileged jobs are currently unavailable.',
				422,
				null,
				'privileged-worker-unavailable'
			);
			fns.install.mockRejectedValue(error);
			const wrapper = mountWizard('install');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(findHintAlert(wrapper, 'remoteAccessCloudflareTunnelPlugin.errors.privilegedWorkerUnavailable')).toBeTruthy();
		});

		it('shows the platform-unsupported hint after a Set up failure carrying that error code', async () => {
			const error = new RemoteAccessCloudflareTunnelApiException(
				'Cloudflare Tunnel setup is unavailable on this platform.',
				422,
				null,
				'platform-unsupported'
			);
			fns.install.mockRejectedValue(error);
			const wrapper = mountWizard('install');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();

			expect(findHintAlert(wrapper, 'remoteAccessCloudflareTunnelPlugin.errors.platformUnsupported')).toBeTruthy();
		});

		it('clears a stale error hint once the dialog reopens', async () => {
			const error = new RemoteAccessCloudflareTunnelApiException('x', 422, null, 'platform-unsupported');
			fns.install.mockRejectedValue(error);
			const wrapper = mountWizard('install');

			await wrapper.findAllComponents({ name: 'ElButton' })[0].vm.$emit('click');
			await flushPromises();
			expect(findHintAlert(wrapper, 'remoteAccessCloudflareTunnelPlugin.errors.platformUnsupported')).toBeTruthy();

			await wrapper.setProps({ visible: false });
			await wrapper.setProps({ visible: true });

			expect(
				wrapper
					.findAllComponents({ name: 'ElAlert' })
					.find((alert) => typeof alert.props('title') === 'string' && alert.props('title').startsWith('remoteAccessCloudflareTunnelPlugin.errors.'))
			).toBeUndefined();
		});
	});
});
