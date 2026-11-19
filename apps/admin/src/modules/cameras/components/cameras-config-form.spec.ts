import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { camelToSnake } from '../../../common';
import { CamerasModuleDataGo2rtcConfigMode } from '../../../openapi.constants';
import { FormResult } from '../../config';
import type { ICamerasConfigEditForm } from '../schemas/config.schemas';
import { CamerasConfigUpdateReqSchema } from '../schemas/config.schemas';

import CamerasConfigForm from './cameras-config-form.vue';

const mocks = vi.hoisted(() => ({
	editForm: vi.fn(),
	release: vi.fn(),
	startPolling: vi.fn(),
	status: { value: null as unknown },
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../common');

	return {
		...actual,
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

	const setup = (mode: CamerasModuleDataGo2rtcConfigMode) => {
		model = makeModel(mode);
		sent = undefined;

		mocks.editForm.mockReset().mockReturnValue({
			formEl: ref(undefined),
			model,
			formChanged: ref(false),
			// Stands in for the request the generic hook builds: the edit model in snake_case through the module schema.
			submit: vi.fn().mockImplementation(async () => {
				sent = CamerasConfigUpdateReqSchema.parse(camelToSnake({ ...model }));

				return 'saved';
			}),
			formResult: ref(FormResult.NONE),
		});
	};

	beforeEach(() => {
		mocks.release.mockReset();
		mocks.startPolling.mockReset().mockReturnValue(mocks.release);
		mocks.status.value = null;

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

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(sent).toEqual({
			type: 'cameras-module',
			enabled: true,
			go2rtc: { mode: 'managed', binary_path: '/usr/local/lib/smart-panel/go2rtc/go2rtc', external_url: null },
			max_sessions: 8,
			max_sessions_per_camera: 4,
		});
		expect(wrapper.emitted('update:remote-form-submit')?.[0]).toEqual([false]);
	});

	it('polls the relay status while mounted and releases it on unmount', () => {
		const wrapper = mountForm();

		expect(mocks.startPolling).toHaveBeenCalledTimes(1);
		expect(mocks.release).not.toHaveBeenCalled();

		wrapper.unmount();

		expect(mocks.release).toHaveBeenCalledTimes(1);
	});
});
