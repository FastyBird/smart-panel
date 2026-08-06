/* eslint-disable vue/one-component-per-file */
import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../openapi.constants';

import ViewVirtualDeviceWizard from './view-virtual-device-wizard.vue';

const mocks = vi.hoisted(() => ({
	isMDDevice: true,
	isLGDevice: true,
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route: unknown) => route),
	useMeta: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-meta', () => ({
	useMeta: (input: unknown) => mocks.useMeta(input),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mocks.routerPush,
		replace: mocks.routerReplace,
		resolve: mocks.routerResolve,
	}),
}));

vi.mock('../../../modules/devices', () => ({
	RouteNames: {
		DEVICES: 'devices_module-devices',
	},
}));

vi.mock('../../../common', async () => {
	const { defineComponent } = await import('vue');

	return {
		AppBarHeading: defineComponent({
			name: 'AppBarHeading',
			template: '<div><slot name="icon" /><slot name="title" /><slot name="subtitle" /></div>',
		}),
		AppBarButton: defineComponent({
			name: 'AppBarButton',
			props: {
				align: { type: String, required: false, default: undefined },
			},
			emits: ['click'],
			template: '<button type="button" @click="$emit(\'click\')"><slot name="icon" /></button>',
		}),
		AppBarButtonAlign: {
			LEFT: 'left',
			RIGHT: 'right',
		},
		AppBreadcrumbs: defineComponent({
			name: 'AppBreadcrumbs',
			props: {
				items: { type: Array, required: false, default: () => [] },
			},
			template: '<nav data-test-id="breadcrumbs" />',
		}),
		ViewHeader: defineComponent({
			name: 'ViewHeader',
			props: {
				heading: { type: String, required: false, default: '' },
				subHeading: { type: String, required: false, default: '' },
				icon: { type: String, required: false, default: '' },
			},
			template: '<div><slot /><slot name="extra" /></div>',
		}),
		useBreakpoints: () => ({
			isMDDevice: ref(mocks.isMDDevice),
			isLGDevice: ref(mocks.isLGDevice),
		}),
	};
});

describe('ViewVirtualDeviceWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.isMDDevice = true;
		mocks.isLGDevice = true;
	});

	it('renders the category step as step 1 of the wizard', () => {
		const wrapper = mount(ViewVirtualDeviceWizard);

		expect(wrapper.findComponent({ name: 'VirtualWizardCategoryStep' }).exists()).toBe(true);
	});

	it('renders all four step labels in the step indicator', () => {
		const wrapper = mount(ViewVirtualDeviceWizard);

		const steps = wrapper.findAllComponents({ name: 'ElStep' });

		expect(steps).toHaveLength(4);
		expect(steps.map((step) => step.props('title'))).toEqual([
			'devicesVirtualPlugin.wizard.steps.category',
			'devicesVirtualPlugin.wizard.steps.mapping',
			'devicesVirtualPlugin.wizard.steps.details',
			'devicesVirtualPlugin.wizard.steps.review',
		]);
	});

	it('marks the category step as the active one', () => {
		const wrapper = mount(ViewVirtualDeviceWizard);

		expect(wrapper.findComponent({ name: 'ElSteps' }).props('active')).toBe(0);
	});

	it('carries a category chosen in the step back into the wizard state and down again', async () => {
		const wrapper = mount(ViewVirtualDeviceWizard);

		await wrapper.findComponent({ name: 'ElSelect' }).setValue(DevicesModuleDeviceCategory.lighting);

		expect(wrapper.findComponent({ name: 'VirtualWizardCategoryStep' }).props('modelValue')).toBe(DevicesModuleDeviceCategory.lighting);
	});

	it('starts with no category selected', () => {
		const wrapper = mount(ViewVirtualDeviceWizard);

		expect(wrapper.findComponent({ name: 'VirtualWizardCategoryStep' }).props('modelValue')).toBeNull();
	});

	it('navigates back to the devices list on cancel', async () => {
		const wrapper = mount(ViewVirtualDeviceWizard);

		await wrapper.find('button').trigger('click');

		expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'devices_module-devices' });
	});

	it('pushes rather than replaces on cancel for a non-large screen', async () => {
		mocks.isLGDevice = false;

		const wrapper = mount(ViewVirtualDeviceWizard);

		await wrapper.find('button').trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'devices_module-devices' });
		expect(mocks.routerReplace).not.toHaveBeenCalled();
	});

	it('sets the page title via useMeta', () => {
		mount(ViewVirtualDeviceWizard);

		expect(mocks.useMeta).toHaveBeenCalledWith(expect.objectContaining({ title: 'devicesVirtualPlugin.wizard.title' }));
	});

	it('builds breadcrumbs from the devices list to this wizard', () => {
		mount(ViewVirtualDeviceWizard);

		expect(mocks.routerResolve).toHaveBeenCalledWith({ name: 'devices_module-devices' });
		expect(mocks.routerResolve).toHaveBeenCalledWith({ name: 'devices_virtual-wizard' });
	});
});
