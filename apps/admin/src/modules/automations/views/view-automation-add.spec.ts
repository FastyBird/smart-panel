import { ElMessageBox } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AutomationMode, FormResult, RouteNames } from '../automations.constants';
import { peekAutomationDraft, stashAutomationDraft } from '../automations.drafts';
import { AutomationAddForm } from '../components/components';

import ViewAutomationAdd from './view-automation-add.vue';

const mocks = vi.hoisted(() => ({
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	query: {} as Record<string, string>,
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({ query: mocks.query }),
	useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref } = await import('vue');

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
		// Below the medium breakpoint the save lives in the app bar
		useBreakpoints: () => ({
			isMDDevice: ref(false),
			isLGDevice: ref(false),
		}),
	};
});

// The form is stubbed so the tests can report the progress of a submit the way the form does
vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	return {
		AutomationAddForm: defineVueComponent({
			name: 'AutomationAddForm',
			props: {
				id: { type: String, required: true },
				remoteFormSubmit: { type: Boolean, default: false },
				remoteFormResult: { type: String, default: 'none' },
				remoteFormChanged: { type: Boolean, default: false },
				initial: { type: Object, default: null },
			},
			emits: ['update:remote-form-submit', 'update:remote-form-result', 'update:remote-form-changed'],
			setup() {
				return () => h('div');
			},
		}),
	};
});

describe('ViewAutomationAdd', (): void => {
	const appBarSave = (wrapper: VueWrapper) => {
		return wrapper.findAllComponents({ name: 'AppBarButton' }).find((button) => button.props('align') === 'right')!;
	};

	const appBarBack = (wrapper: VueWrapper) => {
		return wrapper.findAllComponents({ name: 'AppBarButton' }).find((button) => button.props('align') === 'left')!;
	};

	beforeEach((): void => {
		vi.clearAllMocks();

		mocks.query = {};
	});

	describe('from a template', (): void => {
		const draftId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a09';
		const graph = { version: 1, nodes: [{ id: 'n1', type: 'manual.start', position: { x: 0, y: 0 }, config: {} }], edges: [] };

		beforeEach((): void => {
			stashAutomationDraft(draftId, { name: 'Leak alarm', mode: AutomationMode.parallel, graph });

			mocks.query = { draft: draftId };
		});

		it('creates the automation under the id its flow waits under and opens the flow with it', async (): Promise<void> => {
			const wrapper = mount(ViewAutomationAdd);

			const form = wrapper.findComponent(AutomationAddForm);

			expect(form.props('id')).toBe(draftId);
			expect(form.props('initial')).toEqual({ name: 'Leak alarm', mode: AutomationMode.parallel });

			form.vm.$emit('update:remote-form-result', FormResult.OK);

			await flushPromises();

			expect(mocks.routerReplace).toHaveBeenCalledWith({ name: RouteNames.AUTOMATIONS_FLOW, params: { id: draftId } });

			wrapper.unmount();

			// Kept for the editor, which takes it
			expect(peekAutomationDraft(draftId)?.graph).toEqual(graph);
		});

		it('forgets the flow when the form is left without saving', (): void => {
			const wrapper = mount(ViewAutomationAdd);

			wrapper.unmount();

			expect(peekAutomationDraft(draftId)).toBeNull();
		});

		it('is the blank form when the draft is gone, as after a reload', (): void => {
			mocks.query = { draft: 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a10' };

			const wrapper = mount(ViewAutomationAdd);

			const form = wrapper.findComponent(AutomationAddForm);

			expect(form.props('initial')).toBeNull();
			expect(form.props('id')).not.toBe('b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a10');

			wrapper.unmount();
		});
	});

	it('leaves an untouched form without asking', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm');

		const wrapper = mount(ViewAutomationAdd);

		appBarBack(wrapper).vm.$emit('click');

		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		expect(mocks.routerPush).toHaveBeenCalledTimes(1);

		confirm.mockRestore();
	});

	it('asks before it leaves a form with something typed in, and stays when the answer is no', async (): Promise<void> => {
		const confirm = vi
			.spyOn(ElMessageBox, 'confirm')
			.mockRejectedValueOnce('cancel')
			.mockResolvedValueOnce('confirm' as never);

		const wrapper = mount(ViewAutomationAdd);

		wrapper.findComponent(AutomationAddForm).vm.$emit('update:remote-form-changed', true);

		await flushPromises();

		appBarBack(wrapper).vm.$emit('click');

		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(mocks.routerPush).not.toHaveBeenCalled();

		appBarBack(wrapper).vm.$emit('click');

		await flushPromises();

		expect(confirm).toHaveBeenCalledTimes(2);
		expect(mocks.routerPush).toHaveBeenCalledTimes(1);

		confirm.mockRestore();
	});

	it('does not let the view be left while the automation is being created, and opens its flow without asking once it is', async (): Promise<void> => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);

		const wrapper = mount(ViewAutomationAdd);

		const form = wrapper.findComponent(AutomationAddForm);

		form.vm.$emit('update:remote-form-changed', true);
		form.vm.$emit('update:remote-form-result', FormResult.WORKING);

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-saving')).toEqual([[true]]);
		expect(appBarBack(wrapper).props('disabled')).toBe(true);

		appBarBack(wrapper).vm.$emit('click');

		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		expect(mocks.routerPush).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		form.vm.$emit('update:remote-form-result', FormResult.OK);

		await flushPromises();

		expect(confirm).not.toHaveBeenCalled();
		// A new automation has an empty flow: drawing it is the next thing to do. It takes the place of the
		// creation form, so going back leads to the list and not to a form for yet another automation.
		expect(mocks.routerPush).not.toHaveBeenCalled();
		expect(mocks.routerReplace).toHaveBeenCalledTimes(1);
		expect(mocks.routerReplace).toHaveBeenCalledWith({
			name: RouteNames.AUTOMATIONS_FLOW,
			params: { id: form.props('id') },
		});

		confirm.mockRestore();
	});

	it('does not let the save in the app bar be used while a submit is on its way', async (): Promise<void> => {
		const wrapper = mount(ViewAutomationAdd);

		expect(appBarSave(wrapper).props()).toMatchObject({ disabled: false, loading: false });

		appBarSave(wrapper).vm.$emit('click');

		await flushPromises();

		expect(wrapper.findComponent(AutomationAddForm).props('remoteFormSubmit')).toBe(true);

		wrapper.findComponent(AutomationAddForm).vm.$emit('update:remote-form-result', FormResult.WORKING);

		await flushPromises();

		expect(appBarSave(wrapper).props()).toMatchObject({ disabled: true, loading: true });

		wrapper.findComponent(AutomationAddForm).vm.$emit('update:remote-form-result', FormResult.ERROR);

		await flushPromises();

		expect(appBarSave(wrapper).props()).toMatchObject({ disabled: false, loading: false });
	});
});
