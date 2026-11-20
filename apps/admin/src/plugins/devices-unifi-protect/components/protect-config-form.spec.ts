import { nextTick, reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import {
	DevicesUnifiProtectPluginDiscoveryStatus,
	DevicesUnifiProtectPluginErrorCategory,
	DevicesUnifiProtectPluginProbeProtect,
	DevicesUnifiProtectPluginProbeStatus,
	DevicesUnifiProtectPluginTlsMode,
} from '../../../openapi.constants';
import { ProtectApiException } from '../devices-unifi-protect.exceptions';
import type { IProtectConfigEditForm } from '../schemas/config.types';
import type { IProtectConfig } from '../store/config.store.types';
import { protectDiscoveryStoreKey, protectStatusStoreKey } from '../store/keys';
import { protectProbeKey } from '../store/protect-discovery.store';
import type { IProtectDiscovery, IProtectProbe, IProtectTestConnection, IProtectTestResult } from '../store/protect.types';

import ProtectConfigForm from './protect-config-form.vue';

const OLD_FINGERPRINT = '11'.repeat(32);
const NEW_FINGERPRINT = '22'.repeat(32);

const mocks = vi.hoisted(() => ({
	editForm: vi.fn(),
	statusStore: null as unknown,
	discoveryStore: null as unknown,
}));

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			locale: 'en-US',
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
			te: () => true,
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
				if (key === protectDiscoveryStoreKey) return mocks.discoveryStore;

				throw new Error('Unexpected store');
			},
		}),
	};
});

vi.mock('../../../modules/config', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../modules/config');

	return { ...actual, useConfigPluginEditForm: () => mocks.editForm() };
});

interface IStatusStoreMock {
	lastTest: IProtectTestResult | null;
	testing: boolean;
	status: null;
	stale: boolean;
	fetch: ReturnType<typeof vi.fn>;
	startPolling: ReturnType<typeof vi.fn>;
	testConnection: ReturnType<typeof vi.fn>;
	clearLastTest: ReturnType<typeof vi.fn>;
}

interface IDiscoveryStoreMock {
	discovery: IProtectDiscovery | null;
	probes: Record<string, IProtectProbe>;
	scanning: boolean;
	isProbing: () => boolean;
	fetch: ReturnType<typeof vi.fn>;
	scan: ReturnType<typeof vi.fn>;
	probe: ReturnType<typeof vi.fn>;
}

const probeOf = (overrides: Partial<IProtectProbe> = {}): IProtectProbe => ({
	host: '192.168.1.30',
	port: 443,
	status: DevicesUnifiProtectPluginProbeStatus.console,
	failure: null,
	protect: DevicesUnifiProtectPluginProbeProtect.present,
	model: 'UDM-Pro',
	name: 'Dream Machine',
	mac: 'aa:bb:cc:dd:ee:ff',
	deviceState: null,
	directConnectDomain: 'def456.id.ui.direct',
	certificate: null,
	preferredHost: 'def456.id.ui.direct',
	...overrides,
});

const discoveryOf = (): IProtectDiscovery => ({
	status: DevicesUnifiProtectPluginDiscoveryStatus.completed,
	failureReason: null,
	warnings: [],
	startedAt: null,
	finishedAt: null,
	interfaces: [],
	consoles: [
		{
			mac: 'aa:bb:cc:dd:ee:ff',
			host: '192.168.1.30',
			addresses: ['192.168.1.30'],
			hostname: 'Dream Machine',
			model: 'UDM-Pro',
			firmware: '4.1.13',
			directConnectDomain: 'def456.id.ui.direct',
			uuid: null,
			probe: probeOf(),
		},
	],
	otherUnifiDevices: 0,
});

const certificateOf = (fingerprintSha256: string) => ({
	fingerprintSha256,
	subjectCommonName: 'unifi.local',
	issuerCommonName: 'unifi.local',
	subjectAltNames: ['unifi.local'],
	validFrom: '2026-01-01T00:00:00.000Z',
	validTo: '2036-01-01T00:00:00.000Z',
	selfSigned: true,
	trusted: false,
});

const testResult = (overrides: Partial<IProtectTestConnection> = {}): IProtectTestConnection => ({
	mode: 'saved',
	success: false,
	tlsMode: DevicesUnifiProtectPluginTlsMode.verify,
	certificate: certificateOf(NEW_FINGERPRINT),
	directConnectDomain: null,
	suggestedServerName: null,
	consoleName: 'Dream Machine',
	consoleModel: 'UDM-Pro',
	applicationVersion: null,
	minimumVersion: '7.2.105',
	versionSupported: null,
	nvrName: null,
	errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_untrusted,
	error: 'The console certificate is not trusted.',
	...overrides,
});

const lastTestFor = (
	result: IProtectTestConnection,
	host = '192.168.1.10',
	tlsMode = DevicesUnifiProtectPluginTlsMode.verify
): IProtectTestResult => ({
	result,
	target: { host, port: 443, tlsMode },
	at: Date.now(),
});

const savedConfig = (
	tls: IProtectConfig['tls'] = { mode: DevicesUnifiProtectPluginTlsMode.verify, serverName: null, fingerprintSha256: null }
): IProtectConfig =>
	({
		type: 'devices-unifi-protect-plugin',
		enabled: true,
		host: '192.168.1.10',
		port: 443,
		apiKeyConfigured: true,
		tls,
		streamHostOverride: null,
		defaultStreamQuality: 'high',
		snapshotMinIntervalMs: 2000,
		pollIntervalMs: 30000,
	}) as IProtectConfig;

let model: IProtectConfigEditForm;
let statusStore: IStatusStoreMock;
let release: ReturnType<typeof vi.fn>;
let discoveryStore: IDiscoveryStoreMock;

const mountForm = (config: IProtectConfig = savedConfig()) => {
	model = reactive(structuredClone(config)) as unknown as IProtectConfigEditForm;

	mocks.editForm.mockReturnValue({
		formEl: ref(undefined),
		model,
		formChanged: ref(false),
		// What useConfigPluginEditForm does after a save: the backend's answer never carries the key, only whether one is
		// stored, and reconcile() drops what the answer does not carry.
		submit: vi.fn(async () => {
			const current = model as unknown as Record<string, unknown>;

			if (typeof model.apiKey === 'string') current.apiKeyConfigured = true;
			if (model.apiKey === null) current.apiKeyConfigured = false;

			delete current.apiKey;

			return 'saved';
		}),
		formResult: ref('none'),
	});

	return mount(ProtectConfigForm, { props: { config } });
};

describe('ProtectConfigForm', () => {
	beforeEach(() => {
		release = vi.fn();
		statusStore = reactive<IStatusStoreMock>({
			lastTest: null,
			testing: false,
			status: null,
			stale: false,
			fetch: vi.fn(async () => null),
			startPolling: vi.fn(() => release),
			testConnection: vi.fn(async () => {
				statusStore.lastTest = null;

				return { timedOut: true };
			}),
			clearLastTest: vi.fn(() => {
				statusStore.lastTest = null;
			}),
		});
		discoveryStore = reactive<IDiscoveryStoreMock>({
			discovery: null,
			probes: {},
			scanning: false,
			isProbing: () => false,
			fetch: vi.fn(async () => {
				discoveryStore.discovery = discoveryOf();

				return discoveryStore.discovery;
			}),
			scan: vi.fn(),
			probe: vi.fn(),
		});
		mocks.statusStore = statusStore;
		mocks.discoveryStore = discoveryStore;
	});

	it("uses a discovered console's preferred host and the port it was probed on", async () => {
		const wrapper = mountForm();

		await flushPromises();

		model.port = 7443;

		await wrapper.get('[data-test-id="protect-console-use"]').trigger('click');

		expect(model.host).toBe('def456.id.ui.direct');
		expect(model.port).toBe(443);
		expect((wrapper.get('input[name="host"]').element as HTMLInputElement).value).toBe('def456.id.ui.direct');
	});

	it('offers the suggested server name and the direct connect domain as fills in verify mode', async () => {
		discoveryStore.probes = {
			[protectProbeKey('192.168.1.10')]: probeOf({ host: '192.168.1.10', directConnectDomain: 'def456.id.ui.direct' }),
		};

		const wrapper = mountForm();

		await flushPromises();

		statusStore.lastTest = lastTestFor(
			testResult({
				errorCategory: DevicesUnifiProtectPluginErrorCategory.validation,
				suggestedServerName: 'abc123.id.ui.direct',
				certificate: { ...certificateOf(NEW_FINGERPRINT), trusted: true },
			})
		);
		await nextTick();

		await wrapper.get('[data-test-id="protect-fill-suggested"]').trigger('click');

		expect(model.tls.serverName).toBe('abc123.id.ui.direct');

		await wrapper.get('[data-test-id="protect-fill-direct-connect"]').trigger('click');

		expect(model.tls.serverName).toBe('def456.id.ui.direct');

		model.tls.mode = 'pinned';
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-fill-suggested"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-fill-direct-connect"]').exists()).toBe(false);
		expect(wrapper.find('input[name="fingerprintSha256"]').exists()).toBe(true);
		expect(wrapper.find('input[name="serverName"]').exists()).toBe(false);
	});

	it('trusting an untrusted certificate switches to pinned mode with its fingerprint and re-tests', async () => {
		const wrapper = mountForm();

		await flushPromises();

		model.apiKey = 'typed-key';
		statusStore.lastTest = lastTestFor(testResult({ mode: 'candidate' }));
		await nextTick();

		await wrapper.get('[data-test-id="protect-certificate-trust"]').trigger('click');
		await flushPromises();

		expect(model.tls.mode).toBe('pinned');
		expect(model.tls.fingerprintSha256).toBe(NEW_FINGERPRINT);
		expect(statusStore.testConnection).toHaveBeenCalledTimes(1);
		expect(statusStore.testConnection).toHaveBeenCalledWith(
			{
				data: {
					mode: 'candidate',
					host: '192.168.1.10',
					port: 443,
					api_key: 'typed-key',
					tls: { mode: 'pinned', server_name: null, fingerprint_sha256: NEW_FINGERPRINT },
				},
			},
			{ host: '192.168.1.10', port: 443, tlsMode: 'pinned', serverName: null }
		);
	});

	it('shows the key hint instead of re-testing a trusted certificate without a typed key', async () => {
		const wrapper = mountForm();

		await flushPromises();

		statusStore.lastTest = lastTestFor(testResult());
		await nextTick();

		await wrapper.get('[data-test-id="protect-certificate-trust"]').trigger('click');
		await flushPromises();

		expect(model.tls.mode).toBe('pinned');
		expect(model.tls.fingerprintSha256).toBe(NEW_FINGERPRINT);
		expect(statusStore.testConnection).not.toHaveBeenCalled();
		expect(wrapper.get('[data-test-id="protect-test-hint"]').text()).toBe('devicesUnifiProtectPlugin.testConnection.hints.needs_key');
	});

	it('asks for confirmation before replacing a pin whose certificate changed', async () => {
		const wrapper = mountForm(savedConfig({ mode: DevicesUnifiProtectPluginTlsMode.pinned, serverName: null, fingerprintSha256: OLD_FINGERPRINT }));

		await flushPromises();

		model.apiKey = 'typed-key';
		statusStore.lastTest = lastTestFor(
			testResult({
				tlsMode: DevicesUnifiProtectPluginTlsMode.pinned,
				errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_fingerprint_mismatch,
				error: 'The certificate does not match the pinned fingerprint.',
			}),
			'192.168.1.10',
			DevicesUnifiProtectPluginTlsMode.pinned
		);
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-certificate-changed"]').exists()).toBe(true);

		await wrapper.get('[data-test-id="protect-certificate-replace"]').trigger('click');

		expect(model.tls.fingerprintSha256).toBe(OLD_FINGERPRINT);
		expect(statusStore.testConnection).not.toHaveBeenCalled();

		await wrapper.get('[data-test-id="protect-certificate-confirm"]').trigger('click');
		await flushPromises();

		expect(model.tls.mode).toBe('pinned');
		expect(model.tls.fingerprintSha256).toBe(NEW_FINGERPRINT);
		expect(statusStore.testConnection).toHaveBeenCalledTimes(1);
		expect(statusStore.testConnection.mock.calls[0][0]).toMatchObject({ data: { mode: 'candidate', tls: { fingerprint_sha256: NEW_FINGERPRINT } } });
	});

	it('offers no trust for a passing test or for a result of a previous host', async () => {
		const wrapper = mountForm();

		await flushPromises();

		statusStore.lastTest = lastTestFor(testResult({ success: true, errorCategory: null, error: null, certificate: certificateOf(NEW_FINGERPRINT) }));
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-certificate"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-certificate-replace"]').exists()).toBe(false);

		statusStore.lastTest = lastTestFor(testResult(), '192.168.1.99');
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-certificate"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-test-failure"]').exists()).toBe(false);

		// The same console typed in another case is still the tested one.
		statusStore.lastTest = lastTestFor(testResult(), 'unifi.local');
		model.host = ' UniFi.Local ';
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(true);

		model.port = 8443;
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(false);
	});

	it('keeps the advanced section collapsed by default', async () => {
		const wrapper = mountForm();

		await flushPromises();

		const advanced = wrapper.get('[data-test-id="protect-advanced"]');

		expect(advanced.find('.el-collapse-item.is-active').exists()).toBe(false);
		expect(advanced.find('input[name="pollIntervalMs"]').isVisible()).toBe(false);

		await advanced.get('.el-collapse-item__header').trigger('click');
		await flushPromises();

		expect(advanced.find('.el-collapse-item.is-active').exists()).toBe(true);
	});

	it('runs the saved test when nothing relevant changed and shows a timeout for the current host only', async () => {
		const wrapper = mountForm();

		await flushPromises();

		expect(statusStore.clearLastTest).toHaveBeenCalled();
		expect(wrapper.get('[data-test-id="protect-api-key-help"]').text()).toBe('devicesUnifiProtectPlugin.config.apiKeyHelp');

		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');
		await flushPromises();

		expect(statusStore.testConnection).toHaveBeenCalledWith(
			{ data: { mode: 'saved' } },
			{ host: '192.168.1.10', port: 443, tlsMode: 'verify', serverName: null }
		);
		expect(wrapper.find('[data-test-id="protect-test-timeout"]').exists()).toBe(true);

		model.host = '192.168.1.20';
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-test-timeout"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="protect-test-hint"]').text()).toBe('devicesUnifiProtectPlugin.testConnection.hints.needs_key');
	});

	it('hides a verify result and its trust once the server name changes', async () => {
		const wrapper = mountForm();

		await flushPromises();

		statusStore.lastTest = lastTestFor(testResult());
		await nextTick();

		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(true);

		// The verdict was for the SNI it ran with; another server name may well be trusted.
		await wrapper.get('input[name="serverName"]').setValue('abc123.id.ui.direct');

		expect(wrapper.find('[data-test-id="protect-test-failure"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(false);

		await wrapper.get('input[name="serverName"]').setValue('');

		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(true);
	});

	it('refreshes the saved snapshot after a save, so a saved key enables the saved test and a removed key disables it', async () => {
		const wrapper = mountForm(savedConfig());

		await flushPromises();

		await wrapper.get('input[name="apiKey"]').setValue('fresh-key');
		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(model.apiKey).toBeUndefined();
		expect(wrapper.find('[data-test-id="protect-test-hint"]').exists()).toBe(false);

		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');
		await flushPromises();

		expect(statusStore.testConnection).toHaveBeenLastCalledWith({ data: { mode: 'saved' } }, expect.objectContaining({ host: '192.168.1.10' }));

		await wrapper.get('button[name="apiKey-remove"]').trigger('click');

		expect(wrapper.get('[data-test-id="protect-test-hint"]').text()).toBe('devicesUnifiProtectPlugin.testConnection.hints.needs_key');

		await wrapper.setProps({ remoteFormSubmit: false });
		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(model.apiKey).toBeUndefined();
		expect(model.apiKeyConfigured).toBe(false);
		expect(wrapper.get('[data-test-id="protect-test-hint"]').text()).toBe('devicesUnifiProtectPlugin.testConnection.hints.needs_key');
		expect(wrapper.get('[data-test-id="protect-test-button"]').attributes('disabled')).toBeDefined();
	});

	it('takes a re-read configuration as the saved baseline for the test and the status panel', async () => {
		const wrapper = mountForm();

		await flushPromises();

		// The host re-read the configuration: the backend now stores another host and poll interval.
		await wrapper.setProps({ config: { ...savedConfig(), host: '192.168.1.20', pollIntervalMs: 60000 } as IProtectConfig });

		expect(wrapper.findComponent({ name: 'ProtectConnectionStatus' }).props('pollIntervalMs')).toBe(60000);
		// The form still shows .10, which is no longer what is saved, so the saved test would test another host.
		expect(wrapper.get('[data-test-id="protect-test-hint"]').text()).toBe('devicesUnifiProtectPlugin.testConnection.hints.needs_key');

		model.host = '192.168.1.20';
		await nextTick();
		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');
		await flushPromises();

		expect(statusStore.testConnection).toHaveBeenCalledWith({ data: { mode: 'saved' } }, expect.objectContaining({ host: '192.168.1.20' }));
	});

	it("shows the backend's reason for a refused test under the generic sentence, never the typed key", async () => {
		const wrapper = mountForm();

		await flushPromises();

		model.apiKey = 'typed-key';
		statusStore.testConnection.mockRejectedValueOnce(new ProtectApiException('Host must be a host name or IP address', 422));

		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');
		await flushPromises();

		const failed = wrapper.get('[data-test-id="protect-test-request-failed"]');

		expect(failed.text()).toContain('devicesUnifiProtectPlugin.testConnection.requestFailed');
		expect(wrapper.get('[data-test-id="protect-test-request-failed-detail"]').text()).toBe('Host must be a host name or IP address');

		statusStore.testConnection.mockRejectedValueOnce(new ProtectApiException('Invalid api_key "typed-key"', 422));

		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="protect-test-request-failed"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="protect-test-request-failed-detail"]').exists()).toBe(false);
		expect(wrapper.html()).not.toContain('typed-key');
	});

	it('keeps the typed key out of the rendered page and the stores', async () => {
		const wrapper = mountForm();

		await flushPromises();

		const keyInput = wrapper.get('input[type="password"]');

		await keyInput.setValue('super-secret-key');

		expect(model.apiKey).toBe('super-secret-key');

		statusStore.testConnection.mockImplementation(async (_request: unknown, target: IProtectTestResult['target']) => {
			statusStore.lastTest = { result: testResult({ mode: 'candidate' }), target, at: Date.now() };

			return statusStore.lastTest;
		});

		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');
		await flushPromises();

		expect(statusStore.testConnection.mock.calls[0][0]).toMatchObject({ data: { api_key: 'super-secret-key' } });
		expect(JSON.stringify(statusStore.lastTest)).not.toContain('super-secret-key');
		expect(JSON.stringify(discoveryStore)).not.toContain('super-secret-key');
		expect(wrapper.html()).not.toContain('super-secret-key');

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		// After the save the field is blank again: neither the markup nor the live input value holds the key.
		expect((wrapper.get('input[type="password"]').element as HTMLInputElement).value).toBe('');
		expect(wrapper.findAll('input').map((input) => (input.element as HTMLInputElement).value)).not.toContain('super-secret-key');
		expect(wrapper.html()).not.toContain('super-secret-key');
	});
	it('mounts the status panel with the saved poll interval and releases polling when the form unmounts', async () => {
		const wrapper = mountForm();

		await flushPromises();

		expect(statusStore.startPolling).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent({ name: 'ProtectConnectionStatus' }).props('pollIntervalMs')).toBe(30000);

		// The panel describes what the backend runs with, so an unsaved edit does not change it; the save does.
		model.pollIntervalMs = 45000;
		await nextTick();

		expect(wrapper.findComponent({ name: 'ProtectConnectionStatus' }).props('pollIntervalMs')).toBe(30000);

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(wrapper.findComponent({ name: 'ProtectConnectionStatus' }).props('pollIntervalMs')).toBe(45000);

		wrapper.unmount();

		expect(release).toHaveBeenCalledTimes(1);
	});

	it('refreshes the status once after a successful save', async () => {
		const wrapper = mountForm();

		await flushPromises();

		expect(statusStore.fetch).not.toHaveBeenCalled();

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(statusStore.fetch).toHaveBeenCalledTimes(1);
		expect(statusStore.fetch).toHaveBeenCalledWith({ fresh: true });
	});

	it('does not refresh the status after a failed save', async () => {
		const wrapper = mountForm();

		await flushPromises();

		mocks.editForm.mock.results.at(-1)?.value.submit.mockRejectedValueOnce(new Error('save failed'));

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(statusStore.fetch).not.toHaveBeenCalled();
	});

	it('refreshes the status after each test, including a timed out one, and survives a failing refresh', async () => {
		statusStore.fetch.mockRejectedValue(new Error('status unavailable'));

		const wrapper = mountForm();

		await flushPromises();
		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');
		await flushPromises();

		expect(statusStore.testConnection).toHaveBeenCalledTimes(1);
		expect(statusStore.fetch).toHaveBeenCalledTimes(1);
		expect(statusStore.fetch).toHaveBeenCalledWith({ fresh: true });
		expect(wrapper.find('[data-test-id="protect-test-button"]').exists()).toBe(true);
	});
});
