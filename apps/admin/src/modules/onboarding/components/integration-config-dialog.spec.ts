/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, onBeforeUnmount, onMounted } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { configPluginsStoreKey } from '../../config/store/keys';
import { extensionsStoreKey } from '../../extensions/store/keys';

import IntegrationConfigDialog from './integration-config-dialog.vue';

type Config = Record<string, unknown> & { type: string };

const PLUGIN = 'devices-unifi-protect-plugin';

const mocks = vi.hoisted(() => ({
	mounted: vi.fn(),
	unmounted: vi.fn(),
	received: [] as Record<string, unknown>[],
	store: null as unknown,
}));

/** What the backend stores; every read hands out a fresh copy, as the real store commits a new object. */
let server: Config;

interface IConfigPluginsStoreMock {
	data: Record<string, Config>;
	findByType: (type: string) => Config | null;
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	validateConfig: ReturnType<typeof vi.fn>;
}

let store: IConfigPluginsStoreMock;

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../common');

	return {
		...actual,
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
		injectStoresManager: () => ({
			getStore: (key: unknown) => {
				if (key === configPluginsStoreKey) return mocks.store;
				if (key === extensionsStoreKey) return { findByType: () => null };

				throw new Error('Unexpected store');
			},
		}),
	};
});

vi.mock('../../../modules/config/composables/usePlugins', () => ({
	usePlugins: () => ({
		getByName: () => ({
			elements: [
				{
					type: 'config',
					components: {
						// Like the plugin forms (useConfigPluginEditForm), this one edits the config it is given in place.
						pluginConfigEditForm: defineComponent({
							props: { config: { type: Object, required: true } },
							emits: ['update:remoteFormChanged'],
							setup(props, { emit }) {
								onMounted(() => {
									mocks.received.push(props.config as Record<string, unknown>);
									mocks.mounted();
								});
								onBeforeUnmount(() => mocks.unmounted());

								return () =>
									h('div', { 'data-test-id': 'plugin-form', 'data-host': String((props.config as Record<string, unknown>).host) }, [
										h('button', {
											'data-test-id': 'edit',
											onClick: () => {
												const config = props.config as Record<string, unknown>;

												config.host = '192.168.1.99';
												config.apiKey = 'typed-key';
												emit('update:remoteFormChanged', true);
											},
										}),
									]);
							},
						}),
					},
				},
			],
		}),
	}),
}));

const dialogStub = defineComponent({
	// Like ElDialog, the content stays rendered after the dialog is hidden.
	setup(_props, { slots }) {
		return () => h('div', [slots.default?.(), slots.footer?.()]);
	},
});

const mountDialog = () =>
	mount(IntegrationConfigDialog, {
		props: { visible: true, pluginType: PLUGIN, pluginName: 'UniFi Protect' },
		global: { stubs: { ElDialog: dialogStub, ElScrollbar: false } },
	});

describe('IntegrationConfigDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.received.length = 0;

		server = { type: PLUGIN, enabled: true, host: '192.168.1.10', port: 443, apiKeyConfigured: true };
		store = {
			data: {},
			findByType: (type: string) => store.data[type] ?? null,
			get: vi.fn(async ({ type }: { type: string }) => {
				store.data[type] = structuredClone(server);

				return store.data[type];
			}),
			set: vi.fn(({ data }: { data: Config }) => {
				store.data[data.type] = { ...(store.data[data.type] ?? {}), ...data };

				return store.data[data.type];
			}),
			validateConfig: vi.fn(async () => ({ valid: true })),
		};
		mocks.store = store;
	});

	it("unmounts the plugin's form when the dialog closes, so it can release what it holds, and mounts a fresh one on reopen", async () => {
		const wrapper = mountDialog();

		await flushPromises();

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(true);
		expect(mocks.mounted).toHaveBeenCalledTimes(1);

		await wrapper.setProps({ visible: false });

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(false);
		expect(mocks.unmounted).toHaveBeenCalledTimes(1);

		await wrapper.setProps({ visible: true });
		await flushPromises();

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(true);
		expect(mocks.mounted).toHaveBeenCalledTimes(2);
	});

	it('starts a reopened form with Save disabled, whatever the previous one had changed', async () => {
		const wrapper = mountDialog();

		await flushPromises();

		const saveButton = () => wrapper.findAllComponents({ name: 'ElButton' }).find((button) => button.text().endsWith('buttons.save'))!;

		expect(saveButton().attributes('disabled')).toBeDefined();

		await wrapper.find('[data-test-id="edit"]').trigger('click');

		expect(saveButton().attributes('disabled')).toBeUndefined();

		await wrapper.setProps({ visible: false });
		await wrapper.setProps({ visible: true });
		await flushPromises();

		expect(saveButton().attributes('disabled')).toBeDefined();
	});

	it('re-reads the configuration on every open and drops what a cancelled form had changed, typed key included', async () => {
		const wrapper = mountDialog();

		await flushPromises();

		expect(store.get).toHaveBeenLastCalledWith({ type: PLUGIN, force: true });

		await wrapper.find('[data-test-id="edit"]').trigger('click');

		// The edits land in the form's own copy, never in the store.
		expect(mocks.received[0]).toMatchObject({ host: '192.168.1.99', apiKey: 'typed-key' });
		expect(store.data[PLUGIN].host).toBe('192.168.1.10');
		expect(store.data[PLUGIN]).not.toHaveProperty('apiKey');

		// Cancel.
		await wrapper.setProps({ visible: false });

		// Another client changed the configuration meanwhile; the reopened form takes the backend's version.
		server = { ...server, port: 7443 };

		await wrapper.setProps({ visible: true });
		await flushPromises();

		expect(store.get).toHaveBeenCalledTimes(2);
		expect(store.get).toHaveBeenLastCalledWith({ type: PLUGIN, force: true });
		expect(mocks.received[1]).toEqual({ type: PLUGIN, enabled: true, host: '192.168.1.10', port: 7443, apiKeyConfigured: true });
		expect(mocks.received[1]).not.toBe(store.data[PLUGIN]);
		expect(wrapper.get('[data-test-id="plugin-form"]').attributes('data-host')).toBe('192.168.1.10');
	});

	it('mounts the form only after the read completes', async () => {
		let finish: () => void = () => undefined;

		store.data[PLUGIN] = { ...server, host: 'stale.local' };
		store.get.mockImplementationOnce(
			({ type }: { type: string }) =>
				new Promise((resolve) => {
					finish = () => {
						store.data[type] = structuredClone(server);
						resolve(store.data[type]);
					};
				})
		);

		const wrapper = mountDialog();

		await flushPromises();

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="integration-config-empty"]').exists()).toBe(false);

		finish();
		await flushPromises();

		expect(wrapper.get('[data-test-id="plugin-form"]').attributes('data-host')).toBe('192.168.1.10');
	});

	it('shows the load error instead of a form on the copy it holds when a reopen cannot read the configuration', async () => {
		const wrapper = mountDialog();

		await flushPromises();
		await wrapper.setProps({ visible: false });

		store.get.mockRejectedValueOnce(new Error('offline'));

		await wrapper.setProps({ visible: true });
		await flushPromises();

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="integration-config-empty"]').text()).toContain('onboardingModule.integrations.configDialog.loadFailed');
	});

	it('seeds a default entry when the backend has no configuration to read, also on a reopen', async () => {
		store.get.mockRejectedValue(new Error('not found'));

		const wrapper = mountDialog();

		await flushPromises();

		expect(store.set).toHaveBeenCalledWith({ data: { type: PLUGIN, enabled: false } });
		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="edit"]').trigger('click');
		await wrapper.setProps({ visible: false });
		await wrapper.setProps({ visible: true });
		await flushPromises();

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(true);
		expect(mocks.received[1]).toEqual({ type: PLUGIN, enabled: false });
	});

	it('shows no empty state while the dialog is closed', async () => {
		const wrapper = mountDialog();

		await flushPromises();
		await wrapper.setProps({ visible: false });

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="integration-config-empty"]').exists()).toBe(false);
	});
});
