import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager } from '../../../../common';
import { AutomationMode, AutomationStatus, FormResult } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

import AutomationEditForm from './automation-edit-form.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() })),
	};
});

vi.mock('../../composables/useAutomationSpaces', async () => {
	const { ref } = await import('vue');

	return {
		useAutomationSpaces: () => ({
			spacesOptions: ref([]),
			loadingSpaces: ref(false),
			fetchSpaces: vi.fn().mockResolvedValue(undefined),
		}),
	};
});

const automation: IAutomation = {
	id: 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01',
	name: 'Hallway motion light',
	description: null,
	icon: null,
	enabled: true,
	spaceId: null,
	mode: AutomationMode.restart,
	graph: null,
	revision: 2,
	status: AutomationStatus.ok,
	lastTriggeredAt: null,
	lastRunStatus: null,
	createdAt: new Date(),
	updatedAt: null,
};

describe('AutomationEditForm', (): void => {
	let wrapper: VueWrapper;

	const mockStore = { edit: vi.fn(), findById: vi.fn(() => null) };

	const fields = (): boolean[] => {
		return ['input[name="name"]', 'textarea[name="description"]'].map(
			(selector) => (wrapper.find(selector).element as HTMLInputElement | HTMLTextAreaElement).disabled
		);
	};

	beforeEach((): void => {
		vi.clearAllMocks();

		vi.mocked(injectStoresManager).mockReturnValue({ getStore: vi.fn(() => mockStore) } as unknown as ReturnType<typeof injectStoresManager>);
	});

	afterEach((): void => {
		wrapper.unmount();
	});

	it('does not take input while a save is on its way, so nothing typed can be replaced by its response', async (): Promise<void> => {
		let resolve: (value: IAutomation) => void = () => {};

		mockStore.edit.mockReturnValue(
			new Promise<IAutomation>((res) => {
				resolve = res;
			})
		);

		wrapper = mount(AutomationEditForm, { props: { automation, remoteFormSubmit: false } });

		await wrapper.find('input[name="name"]').setValue('Hallway light');

		expect(fields()).toEqual([false, false]);

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(mockStore.edit).toHaveBeenCalledTimes(1);
		expect(wrapper.emitted('update:remote-form-result')?.at(-1)).toEqual([FormResult.WORKING]);
		expect(fields()).toEqual([true, true]);
		expect(wrapper.findAll('.el-select').every((select) => select.find('.is-disabled').exists())).toBe(true);

		resolve({ ...automation, name: 'Hallway light', revision: 3 });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.at(-1)).toEqual([FormResult.OK]);
		expect(fields()).toEqual([false, false]);
	});

	it('takes input again after a refused save', async (): Promise<void> => {
		mockStore.edit.mockRejectedValue(new Error('offline'));

		wrapper = mount(AutomationEditForm, { props: { automation, remoteFormSubmit: false } });

		await wrapper.find('input[name="name"]').setValue('Hallway light');
		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.at(-1)).toEqual([FormResult.ERROR]);
		expect(fields()).toEqual([false, false]);
		expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe('Hallway light');
	});
});
