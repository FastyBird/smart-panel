/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import ViewDevices from './view-devices.vue';

const mocks = vi.hoisted(() => ({
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route) => route),
	fetchDevices: vi.fn(),
	fetchValidation: vi.fn(),
	wizardOptions: [] as { value: string; label: string; description: string; disabled: boolean }[],
	route: {
		path: '/devices',
		name: 'devices',
		matched: [],
	},
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({
		meta: {},
	}),
}));

vi.mock('vue-router', () => ({
	useRoute: () => mocks.route,
	useRouter: () => ({
		push: mocks.routerPush,
		replace: mocks.routerReplace,
		resolve: mocks.routerResolve,
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref: vueRef } = await import('vue');

	const StubComponent = defineVueComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots.extra?.(), slots.icon?.(), slots.title?.(), slots.subtitle?.()]);
		},
	});

	return {
		AppBar: StubComponent,
		AppBarButton: StubComponent,
		AppBarButtonAlign: {
			LEFT: 'left',
			RIGHT: 'right',
		},
		AppBarHeading: StubComponent,
		AppBreadcrumbs: StubComponent,
		ViewError: StubComponent,
		ViewHeader: StubComponent,
		useBreakpoints: () => ({
			isMDDevice: vueRef(true),
			isLGDevice: vueRef(false),
		}),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		ListDevices: defineVueComponent({
			template: '<div />',
		}),
		ListDevicesAdjust: defineVueComponent({
			template: '<div />',
		}),
	};
});

vi.mock('../composables/composables', () => ({
	useDevicesActions: () => ({
		remove: vi.fn(),
		bulkRemove: vi.fn(),
		bulkEnable: vi.fn(),
		bulkDisable: vi.fn(),
	}),
	useDevicesDataSource: () => ({
		fetchDevices: mocks.fetchDevices,
		devices: ref([]),
		devicesPaginated: ref([]),
		totalRows: ref(0),
		filters: ref({ types: [] }),
		filtersActive: ref(false),
		sortBy: ref(undefined),
		sortDir: ref(null),
		paginateSize: ref(10),
		paginatePage: ref(1),
		areLoading: ref(false),
		resetFilter: vi.fn(),
	}),
	useDevicesPlugins: () => ({
		wizardOptions: computed(() => mocks.wizardOptions),
	}),
	useDevicesValidation: () => ({
		fetchValidation: mocks.fetchValidation,
	}),
}));

vi.mock('../devices.constants', () => ({
	RouteNames: {
		DEVICES: 'devices',
		DEVICES_ADD: 'devices-add',
		DEVICES_EDIT: 'devices-edit',
		DEVICES_WIZARD: 'devices-wizard',
	},
}));

vi.mock('../devices.exceptions', () => ({
	DevicesException: Error,
}));

const mountView = () =>
	mount(ViewDevices, {
		global: {
			stubs: {
				ElButton: defineComponent({
					template: '<button type="button" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
				}),
				ElCard: defineComponent({
					template: '<div @click="$emit(\'click\')"><slot /></div>',
				}),
				ElDialog: defineComponent({
					props: {
						modelValue: { type: Boolean, default: false },
					},
					template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
				}),
				ElDrawer: true,
				ElIcon: defineComponent({
					template: '<span><slot /></span>',
				}),
				Icon: true,
				RouterView: true,
				Suspense: false,
				teleport: true,
			},
		},
	});

describe('ViewDevices', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fetchDevices.mockResolvedValue(undefined);
		mocks.fetchValidation.mockResolvedValue(undefined);
		mocks.wizardOptions = [];
		mocks.route = {
			path: '/devices',
			name: 'devices',
			matched: [],
		};
	});

	it('opens the only installed wizard directly without showing the selection dialog', async () => {
		mocks.wizardOptions = [
			{
				value: 'devices-home-assistant-plugin',
				label: 'Home Assistant',
				description: 'Wizard',
				disabled: false,
			},
		];

		const wrapper = mountView();

		await wrapper
			.findAll('button')
			.find((button) => button.text().includes('devicesModule.buttons.wizard.title'))
			?.trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith({
			name: 'devices-wizard',
			params: {
				type: 'devices-home-assistant-plugin',
			},
		});
		expect(wrapper.text()).not.toContain('Home Assistant');
	});

	it('hides the wizard button when all wizard-capable plugins are disabled', () => {
		mocks.wizardOptions = [
			{
				value: 'devices-home-assistant-plugin',
				label: 'Home Assistant',
				description: 'Wizard',
				disabled: true,
			},
		];

		const wrapper = mountView();

		expect(wrapper.findAll('button').some((button) => button.text().includes('devicesModule.buttons.wizard.title'))).toBe(false);
	});
});
