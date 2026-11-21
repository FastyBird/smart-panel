/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import ViewDevices from './view-devices.vue';

const mocks = vi.hoisted(() => ({
	useRealRouter: false,
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	confirmDiscard: vi.fn(() => Promise.resolve(true)),
	routerResolve: vi.fn((route) => route),
	fetchDevices: vi.fn(),
	fetchValidation: vi.fn(),
	flashError: vi.fn(),
	wizardOptions: [] as { value: string; label: string; description: string; disabled: boolean }[],
	isLGDevice: false,
	// Read once per `useBreakpoints()` call, like `isLGDevice` above: set it before `mountView()`.
	isMDDevice: true,
	// Populated by the `useDevicesDataSource` mock below (a real `ref()` cannot live in this
	// hoisted object: `vi.hoisted` runs before the `vue` import binds, so `ref` is not callable
	// here yet). Tests grab this after mounting to flip the toggle through real Vue reactivity.
	showHiddenRef: undefined as unknown as { value: boolean },
	route: {
		path: '/devices',
		name: 'devices',
		meta: {},
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

vi.mock('vue-router', async (importOriginal) => {
	const actual = await importOriginal<typeof import('vue-router')>();

	return {
		...actual,
		useRoute: () => (mocks.useRealRouter ? actual.useRoute() : mocks.route),
		useRouter: () =>
			mocks.useRealRouter
				? actual.useRouter()
				: {
						push: mocks.routerPush,
						replace: mocks.routerReplace,
						resolve: mocks.routerResolve,
					},
	};
});

vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICE: 'device' } }));
vi.mock('../../../plugins/devices-virtual/components/virtual-measurement-editor.vue', () => ({
	default: defineComponent({
		name: 'VirtualMeasurementEditor',
		props: { mode: { type: String, required: true } },
		template: '<div data-test-id="measurement-editor">{{ mode }}</div>',
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent, h, ref: vueRef } = await import('vue');

	const StubComponent = defineVueComponent({
		setup(_, { slots }) {
			return () => h('div', [slots.default?.(), slots.actions?.(), slots.icon?.(), slots.title?.(), slots.subtitle?.()]);
		},
	});

	return {
		AppBreadcrumbs: StubComponent,
		ViewError: StubComponent,
		EditDrawerLayout: StubComponent,
		ViewHeader: StubComponent,
		useBreakpoints: () => ({
			isMDDevice: vueRef(mocks.isMDDevice),
			isLGDevice: vueRef(mocks.isLGDevice),
		}),
		// The forms open in a drawer where a large screen used to have one; a page of their own otherwise
		// Reads its getter at once, as the real provider does, so a getter declared too late fails the mount
		provideEditDrawer: (open: () => boolean) => ({
			opened: open(),
			inDrawer: vueRef(mocks.isLGDevice),
			mode: vueRef(mocks.isLGDevice ? 'drawer' : 'page'),
			drawerSize: vueRef('640px'),
		}),
		useFlashMessage: () => ({
			success: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			error: mocks.flashError,
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
	useDiscardGuard: () => ({ confirmDiscard: mocks.confirmDiscard }),
	useDevicesActions: () => ({
		remove: vi.fn(),
		bulkRemove: vi.fn(),
		bulkEnable: vi.fn(),
		bulkDisable: vi.fn(),
	}),
	useDevicesDataSource: () => {
		mocks.showHiddenRef = ref(false);

		return {
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
			showHidden: mocks.showHiddenRef,
		};
	},
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
		DEVICES_WIZARD_SELECT: 'devices-wizard-select',
	},
}));

vi.mock('../devices.exceptions', () => ({
	DevicesException: Error,
}));

const mountView = (props: Record<string, unknown> = {}, router?: Router) =>
	mount(router ? defineComponent({ render: () => h(RouterView) }) : ViewDevices, {
		props: router ? {} : props,
		global: {
			plugins: router ? [router] : [],
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
				ElDrawer: router
					? defineComponent({
							props: { modelValue: Boolean },
							template: '<div v-if="modelValue" data-test-id="edit-drawer"><slot /></div>',
						})
					: true,
				ElIcon: defineComponent({
					template: '<span><slot /></span>',
				}),
				Icon: true,
				RouterView: !router,
				Suspense: false,
				teleport: true,
			},
		},
	});

describe('ViewDevices', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.useRealRouter = false;
		mocks.fetchDevices.mockResolvedValue(undefined);
		mocks.fetchValidation.mockResolvedValue(undefined);
		mocks.wizardOptions = [];
		mocks.isLGDevice = false;
		mocks.isMDDevice = true;
		mocks.route = {
			path: '/devices',
			name: 'devices',
			meta: {},
			matched: [],
		};
	});

	it('accepts the wizard route param without leaving it as an extraneous attribute', async () => {
		// The parent `devices` route uses `props: true`, so whenever the `wizard/:type` child
		// matches, `route.params.type` is handed to this view as well. It renders a fragment, so
		// an undeclared `type` cannot be auto-inherited and Vue warns on every render. Sibling
		// parents (`view-device`, `view-channel`) already declare the params their children
		// contribute for exactly this reason, even where they never read them.
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		try {
			mountView({ type: 'devices-zigbee2mqtt-plugin' });
			await flushPromises();

			const extraneous = warn.mock.calls.filter(([message]) => String(message).includes('Extraneous non-props attributes'));

			expect(extraneous).toEqual([]);
		} finally {
			warn.mockRestore();
		}
	});

	it('leaves catalogue loading to the wizard on direct entry', async () => {
		mocks.route = { path: '/devices/wizard/devices-virtual', name: 'devices-wizard', meta: {}, matched: [] };
		mountView();
		await flushPromises();
		expect(mocks.fetchDevices).not.toHaveBeenCalled();
		expect(mocks.fetchValidation).not.toHaveBeenCalled();
	});

	it('refreshes the list when returning from the wizard without loading it behind the wizard', async () => {
		mocks.useRealRouter = true;
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/devices',
					name: 'devices',
					component: ViewDevices,
					children: [{ path: 'wizard', name: 'devices-wizard-select', component: defineComponent({ template: '<div />' }) }],
				},
			],
		});
		await router.push('/devices/wizard');
		await router.isReady();
		const view = mountView({}, router);
		await flushPromises();
		expect(mocks.fetchDevices).not.toHaveBeenCalled();
		await router.push('/devices');
		await flushPromises();
		expect(mocks.fetchDevices).toHaveBeenCalledTimes(1);
		expect(mocks.fetchValidation).toHaveBeenCalledTimes(1);
		await router.push('/devices/wizard');
		await flushPromises();
		expect(mocks.fetchDevices).toHaveBeenCalledTimes(1);
		await router.push('/devices');
		await flushPromises();
		expect(mocks.fetchDevices).toHaveBeenCalledTimes(2);
		view.unmount();
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

	it('refetches devices when the show-hidden toggle changes', async () => {
		mountView();
		await flushPromises();

		mocks.fetchDevices.mockClear();

		mocks.showHiddenRef.value = true;
		await flushPromises();

		expect(mocks.fetchDevices).toHaveBeenCalledTimes(1);
	});

	// A request the toggle has since left is not the one on screen. Restoring `previous` for it would
	// assign the value the toggle already holds — an assignment Vue never notifies — so the guard that
	// swallows the restoration stayed armed and ate the *next* genuine flip's fetch, leaving the list
	// showing the visible-only cache under an enabled toggle.
	it('leaves the toggle alone when a superseded request fails, and still fetches on the next flip', async () => {
		mountView();
		await flushPromises();

		mocks.fetchDevices.mockClear();

		let failSuperseded!: (reason: Error) => void;

		mocks.fetchDevices.mockImplementationOnce(
			(): Promise<void> =>
				new Promise((_resolve, reject) => {
					failSuperseded = reject;
				})
		);

		// Enabled …
		mocks.showHiddenRef.value = true;
		await flushPromises();

		// … then disabled again before the first request settles. That one succeeds.
		mocks.showHiddenRef.value = false;
		await flushPromises();

		// Only now does the superseded request fail.
		failSuperseded(new Error('network was down'));
		await flushPromises();

		// The newer request already answered for what is on screen, so nothing is restored and nothing is
		// reported.
		expect(mocks.showHiddenRef.value).toBe(false);
		expect(mocks.flashError).not.toHaveBeenCalled();

		mocks.fetchDevices.mockClear();

		// The next genuine flip must still refresh.
		mocks.showHiddenRef.value = true;
		await flushPromises();

		expect(mocks.fetchDevices).toHaveBeenCalledTimes(1);
	});

	// A failed refresh used to leave the toggle on over a list that still held the visible-only
	// response: the UI claimed to be showing hidden devices while showing none of them, and the throw
	// from the detached catch reported the failure to nobody.
	it('puts the show-hidden toggle back and says so when its refresh fails', async () => {
		mountView();
		await flushPromises();

		mocks.fetchDevices.mockClear();
		mocks.fetchDevices.mockRejectedValueOnce(new Error('network is down'));

		mocks.showHiddenRef.value = true;
		await flushPromises();

		expect(mocks.showHiddenRef.value).toBe(false);
		expect(mocks.flashError).toHaveBeenCalledTimes(1);
		// The restoration is not a fresh request: the store already holds what the previous filter read.
		expect(mocks.fetchDevices).toHaveBeenCalledTimes(1);
	});
	it('opens the shared wizard selection for every registered wizard plugin', async () => {
		mocks.wizardOptions = [{ value: 'devices-virtual', label: 'Virtual', description: '', disabled: false }];
		const wrapper = mountView();
		const button = wrapper.findAll('button').find((item) => item.text().includes('devicesModule.buttons.wizard.title'));
		await button!.trigger('click');
		expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'devices-wizard-select' });
		expect(wrapper.find('[data-test-id="virtual-device-wizard"]').exists()).toBe(false);
	});

	describe('next to an open form', () => {
		const openForm = async (changed: boolean) => {
			mocks.isLGDevice = true;
			mocks.route = { path: '/devices/add', name: 'devices-add', meta: {}, matched: [{ name: 'devices-add' }] } as never;

			const wrapper = mountView();

			await flushPromises();

			const vm = wrapper.vm as unknown as {
				remoteFormChanged: boolean;
				onDeviceEdit: (id: string) => Promise<void>;
				onDeviceCreate: () => Promise<void>;
			};

			vm.remoteFormChanged = changed;

			return vm;
		};

		afterEach(() => {
			mocks.isLGDevice = false;
			mocks.route = { path: '/devices', name: 'devices', meta: {}, matched: [] } as never;
		});

		it('asks before Edit replaces a changed form, and stays when the answer is no', async () => {
			mocks.confirmDiscard.mockResolvedValueOnce(false);

			const vm = await openForm(true);

			await vm.onDeviceEdit('device-id');

			expect(mocks.confirmDiscard).toHaveBeenCalledTimes(1);
			expect(mocks.routerReplace).not.toHaveBeenCalled();
		});

		it('replaces a changed form once the answer is yes', async () => {
			mocks.confirmDiscard.mockResolvedValueOnce(true);

			const vm = await openForm(true);

			await vm.onDeviceEdit('device-id');

			expect(mocks.routerReplace).toHaveBeenCalledWith(expect.objectContaining({ params: { id: 'device-id' } }));
		});

		it('leaves the form open, and asks nothing, when the one asked for is already open', async () => {
			const vm = await openForm(true);

			mocks.routerResolve.mockReturnValueOnce({ path: '/devices/add' });

			await vm.onDeviceCreate();

			expect(mocks.confirmDiscard).not.toHaveBeenCalled();
			expect(mocks.routerReplace).not.toHaveBeenCalled();
			// Still changed: closing it later must still ask
			expect(vm.remoteFormChanged).toBe(true);
		});

		it('replaces an untouched form without asking', async () => {
			const vm = await openForm(false);

			await vm.onDeviceEdit('device-id');

			expect(mocks.confirmDiscard).not.toHaveBeenCalled();
			expect(mocks.routerReplace).toHaveBeenCalled();
		});
	});
});
