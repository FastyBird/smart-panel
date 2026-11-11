import { describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { FormResult } from '../automations.constants';
import { AutomationAddForm } from '../components/components';

import ViewAutomationAdd from './view-automation-add.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
