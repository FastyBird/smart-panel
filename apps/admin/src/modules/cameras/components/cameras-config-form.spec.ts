import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { CamerasModuleDataGo2rtcConfigMode } from '../../../openapi.constants';
import { ConfigApiException, ConfigValidationException, FormResult } from '../../config';
import { transformConfigModuleUpdateRequest } from '../../config/store/config-modules.store.transformers';
import type { ICamerasConfigEditForm } from '../schemas/config.schemas';
import { CamerasConfigEditFormSchema, CamerasConfigUpdateReqSchema } from '../schemas/config.schemas';

import CamerasConfigForm from './cameras-config-form.vue';

const mocks = vi.hoisted(() => ({
	editForm: vi.fn(),
	release: vi.fn(),
	startPolling: vi.fn(),
	status: { value: null as unknown },
	flashError: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../common');

	return {
		...actual,
		useFlashMessage: () => ({ error: mocks.flashError, success: vi.fn(), info: vi.fn(), warning: vi.fn() }),
		injectStoresManager: () => ({
			getStore: () => ({
				startPolling: mocks.startPolling,
				get status() {
					return mocks.status.value;
				},
			}),
		}),
	};
});

vi.mock('../../config', async () => {
	const actual = await vi.importActual('../../config');

	return { ...actual, useConfigModuleEditForm: () => mocks.editForm() };
});

const makeModel = (mode: CamerasModuleDataGo2rtcConfigMode) =>
	reactive({
		type: 'cameras-module',
		enabled: true,
		go2rtc: { mode, binaryPath: '/usr/local/lib/smart-panel/go2rtc/go2rtc', externalUrl: null as string | null },
		maxSessions: 8,
		maxSessionsPerCamera: 4,
	}) as unknown as ICamerasConfigEditForm;

const mountForm = () =>
	mount(CamerasConfigForm, {
		props: { config: { type: 'cameras-module', enabled: true } },
		global: { stubs: { RelayStatusPanel: { template: '<div data-test-id="panel-stub" />' } } },
	});

describe('CamerasConfigForm', () => {
	let model: ICamerasConfigEditForm;
	let sent: unknown;
	let formResult: ReturnType<typeof ref<string>>;

	const setup = (mode: CamerasModuleDataGo2rtcConfigMode) => {
		model = makeModel(mode);
		sent = undefined;
		formResult = ref<string>(FormResult.NONE);

		mocks.editForm.mockReset().mockReturnValue({
			formEl: ref(undefined),
			model,
			formChanged: ref(false),
			// What the generic hook and the config store do: gate the model with the edit form schema, then build the
			// request with the real transformer and the module's update request schema.
			submit: vi.fn().mockImplementation(async () => {
				const parsed = CamerasConfigEditFormSchema.safeParse(model);

				if (!parsed.success) {
					throw new ConfigValidationException('Failed to validate create module model.');
				}

				sent = transformConfigModuleUpdateRequest(parsed.data as never, CamerasConfigUpdateReqSchema);

				return 'saved';
			}),
			formResult,
		});
	};

	const submit = async (wrapper: ReturnType<typeof mountForm>): Promise<void> => {
		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();
	};

	beforeEach(() => {
		mocks.release.mockReset();
		mocks.startPolling.mockReset().mockReturnValue(mocks.release);
		mocks.status.value = null;
		mocks.flashError.mockReset();

		setup(CamerasModuleDataGo2rtcConfigMode.managed);
	});

	it('hides the binary path outside managed mode', () => {
		const managed = mountForm();

		expect(managed.find('[name="binaryPath"]').exists()).toBe(true);
		expect(managed.find('[name="externalUrl"]').exists()).toBe(false);

		setup(CamerasModuleDataGo2rtcConfigMode.external);

		const external = mountForm();

		expect(external.find('[name="binaryPath"]').exists()).toBe(false);
		expect(external.find('[name="externalUrl"]').exists()).toBe(true);
		expect(external.find('[name="externalUrl"]').attributes('inputmode')).toBe('url');
		expect(external.find('[name="externalUrl"]').attributes('autocorrect')).toBe('off');

		setup(CamerasModuleDataGo2rtcConfigMode.disabled);

		const disabled = mountForm();

		expect(disabled.find('[name="binaryPath"]').exists()).toBe(false);
		expect(disabled.find('[name="externalUrl"]').exists()).toBe(false);
	});

	it('sends the update request with snake_case keys', async () => {
		const wrapper = mountForm();

		await submit(wrapper);

		expect(sent).toEqual({
			type: 'cameras-module',
			enabled: true,
			go2rtc: { mode: 'managed', binary_path: '/usr/local/lib/smart-panel/go2rtc/go2rtc', external_url: null },
			max_sessions: 8,
			max_sessions_per_camera: 4,
		});
		expect(wrapper.emitted('update:remote-form-submit')?.[0]).toEqual([false]);
		expect(mocks.flashError).not.toHaveBeenCalled();
	});

	it('saves outside managed mode with an invalid stored binary path and leaves the path out', async () => {
		setup(CamerasModuleDataGo2rtcConfigMode.external);
		model.go2rtc.binaryPath = 'go2rtc';
		model.go2rtc.externalUrl = 'http://192.168.1.5:1984';

		await submit(mountForm());

		expect(sent).toEqual({
			type: 'cameras-module',
			enabled: true,
			go2rtc: { mode: 'external', external_url: 'http://192.168.1.5:1984' },
			max_sessions: 8,
			max_sessions_per_camera: 4,
		});
		expect(mocks.flashError).not.toHaveBeenCalled();
	});

	it.each([CamerasModuleDataGo2rtcConfigMode.disabled, CamerasModuleDataGo2rtcConfigMode.managed])(
		'saves after an invalid url edit in external mode and a switch to %s mode, leaving the url out',
		async (mode) => {
			setup(CamerasModuleDataGo2rtcConfigMode.external);

			const wrapper = mountForm();

			await wrapper.find('input[name="externalUrl"]').setValue('not-a-url');
			await wrapper.find(`input[type="radio"][value="${mode}"]`).setValue(true);

			expect(model.go2rtc.mode).toBe(mode);
			expect(model.go2rtc.externalUrl).toBe('not-a-url');
			expect(wrapper.find('[name="externalUrl"]').exists()).toBe(false);

			await submit(wrapper);

			expect(sent).toEqual({
				type: 'cameras-module',
				enabled: true,
				go2rtc: { mode, ...(mode === CamerasModuleDataGo2rtcConfigMode.managed ? { binary_path: '/usr/local/lib/smart-panel/go2rtc/go2rtc' } : {}) },
				max_sessions: 8,
				max_sessions_per_camera: 4,
			});
			expect(mocks.flashError).not.toHaveBeenCalled();

			// Back in external mode the invalid URL is visible again and blocks saving.
			sent = undefined;
			await wrapper.setProps({ remoteFormSubmit: false });
			await wrapper.find('input[type="radio"][value="external"]').setValue(true);

			expect((wrapper.find('input[name="externalUrl"]').element as HTMLInputElement).value).toBe('not-a-url');

			await submit(wrapper);

			expect(sent).toBeUndefined();
			expect(mocks.flashError).toHaveBeenCalledWith('camerasModule.config.messages.invalid');
		}
	);

	it('restores fields the mode hides when the form is reset', async () => {
		setup(CamerasModuleDataGo2rtcConfigMode.external);
		model.go2rtc.externalUrl = 'http://192.168.1.5:1984';

		const wrapper = mountForm();

		await wrapper.find('input[name="externalUrl"]').setValue('http://10.0.0.9:1984');
		await wrapper.find('input[type="radio"][value="managed"]').setValue(true);
		await wrapper.find('input[name="binaryPath"]').setValue('/opt/go2rtc');
		await wrapper.find('input[type="radio"][value="disabled"]').setValue(true);
		model.maxSessions = 3;
		await flushPromises();

		expect(model.go2rtc).toEqual({
			mode: CamerasModuleDataGo2rtcConfigMode.disabled,
			binaryPath: '/opt/go2rtc',
			externalUrl: 'http://10.0.0.9:1984',
		});
		expect(wrapper.find('[name="externalUrl"]').exists()).toBe(false);
		expect(wrapper.find('[name="binaryPath"]').exists()).toBe(false);

		await wrapper.setProps({ remoteFormReset: true });

		expect(wrapper.emitted('update:remote-form-reset')?.[0]).toEqual([false]);
		expect(model.go2rtc).toEqual({
			mode: CamerasModuleDataGo2rtcConfigMode.external,
			binaryPath: '/usr/local/lib/smart-panel/go2rtc/go2rtc',
			externalUrl: 'http://192.168.1.5:1984',
		});
		expect(model.maxSessions).toBe(8);
		expect((wrapper.find('input[name="externalUrl"]').element as HTMLInputElement).value).toBe('http://192.168.1.5:1984');

		await wrapper.find('input[type="radio"][value="managed"]').setValue(true);

		expect((wrapper.find('input[name="binaryPath"]').element as HTMLInputElement).value).toBe('/usr/local/lib/smart-panel/go2rtc/go2rtc');
	});

	it('tells the user when the form does not validate', async () => {
		model.go2rtc.binaryPath = 'go2rtc';

		await submit(mountForm());

		expect(sent).toBeUndefined();
		expect(mocks.flashError).toHaveBeenCalledWith('camerasModule.config.messages.invalid');
	});

	it('does not add a second message when saving failed, which the edit form already reported', async () => {
		const wrapper = mountForm();

		(mocks.editForm.mock.results[0].value.submit as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			formResult.value = FormResult.ERROR;

			throw new ConfigApiException('Failed to update module config.', 500);
		});

		await submit(wrapper);

		expect(mocks.flashError).not.toHaveBeenCalled();
	});

	it('polls the relay status while mounted and releases it on unmount', () => {
		const wrapper = mountForm();

		expect(mocks.startPolling).toHaveBeenCalledTimes(1);
		expect(mocks.release).not.toHaveBeenCalled();

		wrapper.unmount();

		expect(mocks.release).toHaveBeenCalledTimes(1);
	});
});
