import type { Ref } from 'vue';

import { ElMessageBox } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AutomationMode, AutomationStatus, FormResult } from '../automations.constants';
import { AutomationsApiException } from '../automations.exceptions';
import { AutomationEditForm } from '../components/components';
import type { IAutomation } from '../store/automations.store.types';

import ViewAutomationEdit from './view-automation-edit.vue';

const mocks = vi.hoisted(() => ({
	fetchAutomation: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	formMounted: vi.fn(),
	// Assigned by the mock factories below, which is the first place `ref` is available
	automation: null as unknown as Ref<IAutomation | null>,
	isLoading: null as unknown as Ref<boolean>,
	isMDDevice: null as unknown as Ref<boolean>,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref } = await import('vue');

	mocks.isMDDevice = ref<boolean>(true);

	return {
		AppBarButton: defineVueComponent({
			name: 'AppBarButton',
			props: {
				align: { type: String, default: 'none' },
				disabled: { type: Boolean, default: false },
				loading: { type: Boolean, default: false },
			},
			emits: ['click'],
			setup(_, { slots }) {
				return () => h('div', [slots.icon?.(), slots.default?.()]);
			},
		}),
		AppBarButtonAlign: { LEFT: 'left', RIGHT: 'right', BACK: 'back', NONE: 'none' },
		AppBarHeading: defineVueComponent({
			setup() {
				return () => h('div');
			},
		}),
		useBreakpoints: () => ({
			isMDDevice: mocks.isMDDevice,
			isLGDevice: ref(true),
		}),
	};
});

// The form is stubbed so the tests can report the progress of a submit the way the form does
vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent, h, onMounted } = await import('vue');

	return {
		AutomationEditForm: defineVueComponent({
			name: 'AutomationEditForm',
			props: {
				automation: { type: Object, required: true },
				remoteFormSubmit: { type: Boolean, default: false },
				remoteFormResult: { type: String, default: 'none' },
				remoteFormChanged: { type: Boolean, default: false },
			},
			emits: ['update:remote-form-submit', 'update:remote-form-result', 'update:remote-form-changed'],
			setup() {
				onMounted(() => mocks.formMounted());

				return () => h('div');
			},
		}),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	mocks.automation = ref<IAutomation | null>(null);
	mocks.isLoading = ref<boolean>(false);

	return {
		useAutomation: () => ({
			automation: mocks.automation,
			isLoading: mocks.isLoading,
			fetchAutomation: mocks.fetchAutomation,
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

describe('ViewAutomationEdit', (): void => {
	let wrapper: VueWrapper;

	const mountView = async (): Promise<VueWrapper> => {
		wrapper = mount(ViewAutomationEdit, { props: { id: automation.id } });

		await flushPromises();

		return wrapper;
	};

	const footerSave = (wrapper: VueWrapper) => {
		return wrapper.findAll('button').find((button) => button.text() === 'automations.buttons.save.title')!;
	};

	const appBarSave = (wrapper: VueWrapper) => {
		return wrapper.findAllComponents({ name: 'AppBarButton' }).find((button) => button.props('align') === 'right')!;
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	beforeEach((): void => {
		vi.clearAllMocks();

		mocks.fetchAutomation.mockResolvedValue(undefined);
		mocks.automation.value = automation;
		mocks.isLoading.value = false;
		mocks.isMDDevice.value = true;
	});

	it('waits for the automation to be read before it shows the form', async (): Promise<void> => {
		let resolve: () => void = () => {};

		mocks.fetchAutomation.mockReturnValue(
			new Promise<void>((res) => {
				resolve = res;
			})
		);

		await mountView();

		expect(wrapper.findComponent(AutomationEditForm).exists()).toBe(false);

		resolve();

		await flushPromises();

		expect(wrapper.findComponent(AutomationEditForm).exists()).toBe(true);
	});

	it('offers the save in the app bar only once the form is there to take it', async (): Promise<void> => {
		mocks.isMDDevice.value = false;

		let resolve: () => void = () => {};

		mocks.fetchAutomation.mockReturnValue(
			new Promise<void>((res) => {
				resolve = res;
			})
		);

		// The automation is known from the list already, while it is still being read on its own
		await mountView();

		expect(wrapper.findComponent(AutomationEditForm).exists()).toBe(false);
		expect(appBarSave(wrapper)).toBeUndefined();

		resolve();

		await flushPromises();

		// Nothing was asked for before the form could hear it
		expect(wrapper.findComponent(AutomationEditForm).props('remoteFormSubmit')).toBe(false);

		appBarSave(wrapper).vm.$emit('click');

		await flushPromises();

		expect(wrapper.findComponent(AutomationEditForm).props('remoteFormSubmit')).toBe(true);
	});

	it('says that the automation was not found', async (): Promise<void> => {
		mocks.automation.value = null;
		mocks.fetchAutomation.mockRejectedValue(new AutomationsApiException('Not found', 404));

		await mountView();

		expect(wrapper.text()).toContain('automations.messages.notFound');
		expect(wrapper.text()).not.toContain('automations.messages.loadFailed');
	});

	it('says that the automation could not be read, rather than that it is gone, and reads it again when asked to', async (): Promise<void> => {
		mocks.automation.value = null;
		mocks.fetchAutomation.mockRejectedValueOnce(new AutomationsApiException('Server error', 500));

		await mountView();

		expect(wrapper.text()).toContain('automations.messages.loadFailed');
		expect(wrapper.text()).not.toContain('automations.messages.notFound');

		mocks.fetchAutomation.mockImplementationOnce(async (): Promise<void> => {
			mocks.automation.value = automation;
		});

		await wrapper
			.findAll('button')
			.find((button) => button.text() === 'automations.buttons.retry.title')!
			.trigger('click');
		await flushPromises();

		expect(mocks.fetchAutomation).toHaveBeenCalledTimes(2);
		expect(wrapper.findComponent(AutomationEditForm).exists()).toBe(true);
	});

	it('keeps the form and the outcome of its submit while the automation is read again after a conflict', async (): Promise<void> => {
		await mountView();

		const form = wrapper.findComponent(AutomationEditForm);

		form.vm.$emit('update:remote-form-changed', true);
		form.vm.$emit('update:remote-form-result', FormResult.WORKING);

		await flushPromises();

		expect(footerSave(wrapper).attributes('disabled')).toBeDefined();

		// The save was refused with a conflict and the store reads the automation again
		mocks.isLoading.value = true;

		await flushPromises();

		mocks.automation.value = { ...automation, description: 'Changed elsewhere', revision: 3 };
		mocks.isLoading.value = false;

		await flushPromises();

		// Still the same form, so what it reports next still gets here
		expect(mocks.formMounted).toHaveBeenCalledTimes(1);

		wrapper.findComponent(AutomationEditForm).vm.$emit('update:remote-form-result', FormResult.ERROR);
		wrapper.findComponent(AutomationEditForm).vm.$emit('update:remote-form-changed', true);

		await flushPromises();

		expect(footerSave(wrapper).attributes('disabled')).toBeUndefined();
	});

	const footerButton = (wrapper: VueWrapper, title: string) => {
		return wrapper.findAll('button').find((button) => button.text() === title);
	};

	const appBarBack = (wrapper: VueWrapper) => {
		return wrapper.findAllComponents({ name: 'AppBarButton' }).find((button) => button.props('align') === 'left')!;
	};

	it('can be left again when the automation disappears while its save is on its way', async (): Promise<void> => {
		await mountView();

		wrapper.findComponent(AutomationEditForm).vm.$emit('update:remote-form-result', FormResult.WORKING);

		await flushPromises();

		// Removed meanwhile: the form goes with it before it can say how the save ended
		mocks.automation.value = null;

		await flushPromises();

		expect(wrapper.findComponent(AutomationEditForm).exists()).toBe(false);
		expect(wrapper.text()).toContain('automations.messages.notFound');
		expect(wrapper.emitted('update:remote-form-saving')).toEqual([[true], [false]]);

		await wrapper
			.findAll('button')
			.find((button) => button.text() === 'automations.buttons.backToList.title')!
			.trigger('click');
		await flushPromises();

		expect(mocks.routerReplace).toHaveBeenCalledTimes(1);
	});

	it('does not let a changed form be discarded while its save is on its way', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);

		await mountView();

		const form = wrapper.findComponent(AutomationEditForm);

		form.vm.$emit('update:remote-form-changed', true);
		form.vm.$emit('update:remote-form-result', FormResult.WORKING);

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-saving')).toEqual([[true]]);

		const discard = footerButton(wrapper, 'automations.buttons.discard.title')!;

		expect(discard.attributes('disabled')).toBeDefined();

		// Also when the click gets through, e.g. from the keyboard
		await discard.trigger('click');
		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		// The save was refused: the form is the user's again
		form.vm.$emit('update:remote-form-result', FormResult.ERROR);

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-saving')).toEqual([[true], [false]]);

		await footerButton(wrapper, 'automations.buttons.discard.title')!.trigger('click');
		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(mocks.routerReplace).toHaveBeenCalledTimes(1);

		confirm.mockRestore();
	});

	it('does not let the view be left from the app bar while a save is on its way, and closes it once it is saved', async (): Promise<void> => {
		mocks.isMDDevice.value = false;

		await mountView();

		const form = wrapper.findComponent(AutomationEditForm);

		form.vm.$emit('update:remote-form-result', FormResult.WORKING);

		await flushPromises();

		expect(appBarBack(wrapper).props('disabled')).toBe(true);

		appBarBack(wrapper).vm.$emit('click');

		await flushPromises();

		expect(mocks.routerReplace).not.toHaveBeenCalled();

		form.vm.$emit('update:remote-form-result', FormResult.OK);

		await flushPromises();

		expect(mocks.routerReplace).toHaveBeenCalledTimes(1);
	});

	it('does not let the save in the app bar be used while a submit is on its way', async (): Promise<void> => {
		mocks.isMDDevice.value = false;

		await mountView();

		expect(appBarSave(wrapper).props()).toMatchObject({ disabled: false, loading: false });

		wrapper.findComponent(AutomationEditForm).vm.$emit('update:remote-form-result', FormResult.WORKING);

		await flushPromises();

		expect(appBarSave(wrapper).props()).toMatchObject({ disabled: true, loading: true });

		wrapper.findComponent(AutomationEditForm).vm.$emit('update:remote-form-result', FormResult.ERROR);

		await flushPromises();

		expect(appBarSave(wrapper).props()).toMatchObject({ disabled: false, loading: false });
	});
});
