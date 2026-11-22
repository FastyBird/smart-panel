/* eslint-disable vue/one-component-per-file */
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import DeviceWizardShell from '../../../modules/devices/components/wizard/device-wizard-shell.vue';

import ViewSimulatorDeviceWizard from './view-simulator-device-wizard.vue';

const mocks = vi.hoisted(() => ({
	fetchCategories: vi.fn(),
	generate: vi.fn(),
	reset: vi.fn(),
	spacesFetch: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	results: [] as Array<{ name: string; success: boolean; deviceId?: string; error?: string }>,
	resultsRef: undefined as unknown as { value: Array<{ name: string; success: boolean; deviceId?: string; error?: string }> },
	categoriesError: null as string | null,
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: () => ({ meta: {} }) }));
vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: mocks.routerPush,
		replace: mocks.routerReplace,
		resolve: (to: unknown) => to,
	}),
	onBeforeRouteLeave: vi.fn(),
	onBeforeRouteUpdate: vi.fn(),
}));

vi.mock('../../../common/composables/useSizeClass', async () => {
	const { computed, ref } = await import('vue');

	return {
		useSizeClass: () => ({
			sizeClass: ref('dt'),
			isPhone: computed(() => false),
			isTabletPortrait: computed(() => false),
			isTabletLandscape: computed(() => false),
			isDesktop: computed(() => true),
			isTouch: computed(() => false),
		}),
	};
});

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref } = await import('vue');
	const Stub = defineVueComponent({
		setup:
			(_, { slots }) =>
			() =>
				h('div', [slots.default?.(), slots.actions?.()]),
	});

	return {
		WizardShell: (await import('../../../common/components/wizard-shell.vue')).default,
		useSizeClass: (await import('../../../common/composables/useSizeClass')).useSizeClass,
		AppBreadcrumbs: Stub,
		AppBarScope: Stub,
		ViewHeader: Stub,
		useBreakpoints: () => ({ isMDDevice: ref(true), isLGDevice: ref(false) }),
		useLogger: () => ({ error: vi.fn() }),
		injectStoresManager: () => ({
			getStore: () => ({
				findAll: () => [],
				fetch: mocks.spacesFetch,
			}),
		}),
	};
});

vi.mock('../composables', async () => {
	const { ref } = await import('vue');

	return {
		useSimulatorGenerationWizard: () => {
			mocks.resultsRef = ref(mocks.results);

			return {
				categories: ref([{ category: 'lighting', name: 'Lighting', description: '' }]),
				loadingCategories: ref(false),
				categoriesError: ref(mocks.categoriesError),
				results: mocks.resultsRef,
				generating: ref(false),
				fetchCategories: mocks.fetchCategories,
				generate: mocks.generate,
				reset: mocks.reset,
			};
		},
	};
});

vi.mock('../simulator.constants', () => ({ RouteNames: { WIZARD: 'simulator-wizard' } }));
vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICES: 'devices', DEVICE: 'device' } }));
vi.mock('../../../modules/spaces/spaces.constants', () => ({ SpaceType: { ROOM: 'room' } }));
vi.mock('../../../modules/spaces/store/keys', () => ({ spacesStoreKey: Symbol('spaces') }));

const ButtonStub = defineComponent({
	props: { disabled: Boolean, loading: Boolean },
	emits: ['click'],
	template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
});
const PassThroughStub = defineComponent({ template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' });

const mountView = () =>
	mount(DeviceWizardShell, {
		props: { title: 'Simulator' },
		slots: { default: () => h(ViewSimulatorDeviceWizard) },
		global: {
			stubs: {
				ElAlert: PassThroughStub,
				ElButton: ButtonStub,
				ElCard: PassThroughStub,
				ElCheckbox: true,
				ElDescriptions: PassThroughStub,
				ElDescriptionsItem: PassThroughStub,
				ElForm: PassThroughStub,
				ElFormItem: PassThroughStub,
				ElInput: true,
				ElInputNumber: true,
				ElOption: true,
				ElScrollbar: PassThroughStub,
				ElSelect: true,
				ElStep: true,
				ElSteps: PassThroughStub,
				ElTable: PassThroughStub,
				ElTableColumn: true,
				ElTag: PassThroughStub,
				Icon: true,
			},
		},
	});

describe('ViewSimulatorDeviceWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.results = [];
		mocks.categoriesError = null;
		mocks.fetchCategories.mockResolvedValue(undefined);
		mocks.spacesFetch.mockResolvedValue(undefined);
		mocks.generate.mockResolvedValue(undefined);
	});

	it('loads generation categories once when mounted', async () => {
		mountView();
		await flushPromises();

		expect(mocks.fetchCategories).toHaveBeenCalledTimes(1);
		expect(mocks.spacesFetch).toHaveBeenCalledTimes(1);
	});

	it('allows category loading to be retried in place', async () => {
		mocks.categoriesError = 'Unavailable';
		const wrapper = mountView();
		await flushPromises();

		expect(mocks.fetchCategories).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="wizard-retry-categories"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="wizard-retry-categories"]').trigger('click');
		await flushPromises();

		expect(mocks.fetchCategories).toHaveBeenCalledTimes(2);
	});

	it('surfaces a room loading failure and allows retrying it in place', async () => {
		mocks.spacesFetch.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(undefined);

		const wrapper = mountView();
		await flushPromises();

		expect(mocks.spacesFetch).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="wizard-rooms-error"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-retry-rooms"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="wizard-retry-rooms"]').trigger('click');
		await flushPromises();

		expect(mocks.spacesFetch).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="wizard-rooms-error"]').exists()).toBe(false);
	});

	it('derives and reviews every batch name before generation', async () => {
		const wrapper = mountView();
		const vm = wrapper.findComponent(ViewSimulatorDeviceWizard).vm as unknown as {
			form: { category: string; namePrefix: string; count: number };
			previewNames: string[];
		};

		vm.form.category = 'lighting';
		vm.form.namePrefix = 'Office light';
		vm.form.count = 3;
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-shell-next"]').trigger('click');

		expect(wrapper.find('[data-test-id="wizard-review"]').exists()).toBe(true);
		expect(vm.previewNames).toEqual(['Office light 1', 'Office light 2', 'Office light 3']);
	});

	it('prevents review when the device count is fractional', async () => {
		const wrapper = mountView();
		const vm = wrapper.findComponent(ViewSimulatorDeviceWizard).vm as unknown as { form: { category: string; namePrefix: string; count: number } };

		vm.form.category = 'lighting';
		vm.form.namePrefix = 'Office light';
		vm.form.count = 1.5;
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-shell-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-test-id="wizard-configure"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-review"]').exists()).toBe(false);
		expect(mocks.generate).not.toHaveBeenCalled();
	});

	it('prevents review when the active simulation interval is invalid', async () => {
		const wrapper = mountView();
		const vm = wrapper.findComponent(ViewSimulatorDeviceWizard).vm as unknown as {
			form: { category: string; namePrefix: string; autoSimulate: boolean; simulateInterval: number | null };
		};

		vm.form.category = 'lighting';
		vm.form.namePrefix = 'Office light';
		vm.form.autoSimulate = true;
		vm.form.simulateInterval = null;
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-shell-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-test-id="wizard-configure"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-review"]').exists()).toBe(false);
		expect(mocks.generate).not.toHaveBeenCalled();
	});

	it('keeps realistic behavior selectable when automatic simulation is disabled', () => {
		const wrapper = mountView();
		const vm = wrapper.findComponent(ViewSimulatorDeviceWizard).vm as unknown as { form: { autoSimulate: boolean } };

		expect(vm.form.autoSimulate).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-behavior-mode"]').exists()).toBe(true);
	});

	it('submits the reviewed configuration and shows partial results', async () => {
		mocks.generate.mockImplementation(async () => {
			mocks.resultsRef.value = [
				{ name: 'Office light 1', success: true, deviceId: 'device-1' },
				{ name: 'Office light 2', success: false, error: 'Unavailable' },
			];
		});

		const wrapper = mountView();
		const vm = wrapper.findComponent(ViewSimulatorDeviceWizard).vm as unknown as { form: { category: string; namePrefix: string; count: number } };
		vm.form.category = 'lighting';
		vm.form.namePrefix = 'Office light';
		vm.form.count = 2;
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-shell-next"]').trigger('click');
		await wrapper.find('[data-test-id="wizard-shell-next"]').trigger('click');
		await flushPromises();

		expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ category: 'lighting', count: 2, namePrefix: 'Office light' }));
		expect(wrapper.find('[data-test-id="wizard-results"]').exists()).toBe(true);
	});

	it('can reset the completed batch to generate more', async () => {
		const wrapper = mountView();
		const vm = wrapper.findComponent(ViewSimulatorDeviceWizard).vm as unknown as { activeStep: number };
		vm.activeStep = 2;
		await flushPromises();

		await wrapper.find('[data-test-id="wizard-shell-next"]').trigger('click');

		expect(mocks.reset).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="wizard-configure"]').exists()).toBe(true);
	});

	it('opens a generated device from the results', () => {
		const wrapper = mountView();
		const vm = wrapper.findComponent(ViewSimulatorDeviceWizard).vm as unknown as { onViewDevice: (id: string) => void };

		vm.onViewDevice('device-1');

		expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'device', params: { id: 'device-1' } });
	});
});
