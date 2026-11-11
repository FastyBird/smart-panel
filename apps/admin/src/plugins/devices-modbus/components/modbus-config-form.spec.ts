import { ElMessageBox } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { camelToSnake } from '../../../common';
import { transformConfigPluginUpdateRequest } from '../../../modules/config/store/config-plugins.transformers';
import { ModbusConfigEditFormSchema } from '../schemas/config.schemas';
import { ModbusConfigUpdateReqSchema } from '../store/config.store.schemas';
import { modbusTemplatesStoreKey } from '../store/keys';

import ModbusConfigForm from './modbus-config-form.vue';

const edit = vi.fn();
const push = vi.fn();
const flash = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
const templatesStore = {
	catalog: null as unknown,
	fetch: vi.fn(),
	reload: vi.fn(),
};

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');

	return { ...actual, useRouter: () => ({ push }) };
});

vi.mock('element-plus', async () => {
	const actual = await vi.importActual<typeof import('element-plus')>('element-plus');

	return {
		...actual,
		ElMessageBox: { ...actual.ElMessageBox, confirm: vi.fn() },
	};
});

vi.mock('../../../modules/config/composables/usePlugins', () => ({
	usePlugins: () => ({
		getByName: () => ({
			type: 'devices-modbus-plugin',
			elements: [{ type: 'config', schemas: { pluginConfigEditFormSchema: ModbusConfigEditFormSchema } }],
		}),
	}),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useFlashMessage: () => flash,
		useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
		injectStoresManager: () => ({
			getStore: (key: symbol) => (key === modbusTemplatesStoreKey ? templatesStore : { edit }),
		}),
	};
});

const config = () => ({
	type: 'devices-modbus-plugin',
	enabled: true,
	defaultConnectTimeoutMs: 2000,
	defaultRequestTimeoutMs: 1000,
	defaultPollIntervalMs: 1000,
});

const mountForm = async () => {
	const wrapper = mount(ModbusConfigForm, { props: { config: config() as never } });
	await flushPromises();

	return wrapper;
};

describe('ModbusConfigForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		templatesStore.catalog = null;
		templatesStore.fetch.mockResolvedValue({ templates: [], files: [] });
		edit.mockImplementation(async (payload: { data: Record<string, unknown> }) => payload.data);
	});

	it('saves defaults in snake case', async () => {
		const wrapper = await mountForm();

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(edit).toHaveBeenCalledTimes(1);
		const payload = edit.mock.calls[0]![0].data;
		expect(payload).toMatchObject({
			type: 'devices-modbus-plugin',
			enabled: true,
			defaultConnectTimeoutMs: 2000,
			defaultRequestTimeoutMs: 1000,
			defaultPollIntervalMs: 1000,
		});

		// The config store converts the camelCase form to the wire format.
		expect(transformConfigPluginUpdateRequest(payload, ModbusConfigUpdateReqSchema as never)).toMatchObject({
			default_connect_timeout_ms: 2000,
			default_request_timeout_ms: 1000,
			default_poll_interval_ms: 1000,
		});
		expect(Object.keys(camelToSnake(payload))).toContain('default_poll_interval_ms');
	});

	it('reload refreshes the catalog', async () => {
		templatesStore.reload.mockResolvedValue({
			templates: [{ id: 't1', name: 'Relay board', source: 'builtin', revision: '2', pointCount: 4, overridesBuiltin: false }],
			files: [
				{ source: 'user', path: 'a.yaml', loaded: 0, errors: ['bad point'], warnings: ['w1', 'w2'] },
				{ source: 'builtin', path: 'b.yaml', loaded: 1, errors: [], warnings: [] },
			],
		});
		const wrapper = await mountForm();

		await wrapper.get('[data-test-id="modbus-templates-reload"]').trigger('click');
		await flushPromises();

		expect(templatesStore.reload).toHaveBeenCalledTimes(1);
		expect(flash.success).toHaveBeenCalledWith('devicesModbusPlugin.catalog.reloaded {"templates":1,"files":2,"errors":1,"warnings":2}');
	});

	it('does not reload while the initial fetch is still loading', async () => {
		let finishFetch!: () => void;
		templatesStore.fetch.mockImplementationOnce(() => new Promise<void>((resolve) => (finishFetch = resolve)));
		templatesStore.reload.mockResolvedValue({ templates: [], files: [] });

		const wrapper = mount(ModbusConfigForm, { props: { config: config() as never } });
		await flushPromises();

		const reload = wrapper.get('[data-test-id="modbus-templates-reload"]');

		expect(reload.attributes('disabled')).toBeDefined();

		await reload.trigger('click');
		await flushPromises();
		expect(templatesStore.reload).not.toHaveBeenCalled();

		finishFetch();
		await flushPromises();

		expect(reload.attributes('disabled')).toBeUndefined();

		await reload.trigger('click');
		await flushPromises();
		expect(templatesStore.reload).toHaveBeenCalledTimes(1);
	});

	it('asks before leaving for the endpoints page with unsaved changes', async () => {
		push.mockResolvedValue(undefined);
		const wrapper = await mountForm();
		const link = wrapper.get('[data-test-id="modbus-config-endpoints-link"]');

		await link.trigger('click');
		await flushPromises();

		expect(ElMessageBox.confirm).not.toHaveBeenCalled();
		expect(push).toHaveBeenCalledTimes(1);

		push.mockClear();
		await wrapper.find('input[name="defaultPollIntervalMs"]').setValue('2500');
		await flushPromises();

		vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel');
		await link.trigger('click');
		await flushPromises();

		expect(ElMessageBox.confirm).toHaveBeenCalledTimes(1);
		expect(push).not.toHaveBeenCalled();

		vi.mocked(ElMessageBox.confirm).mockResolvedValueOnce('confirm' as never);
		await link.trigger('click');
		await flushPromises();

		expect(push).toHaveBeenCalledTimes(1);
	});
});
