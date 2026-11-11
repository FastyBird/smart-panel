/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, ref } from 'vue';
import { type Router, RouterView, createMemoryHistory, createRouter } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';
import { RouteNames as VirtualRouteNames } from '../../../plugins/devices-virtual/devices-virtual.constants';
import { PluginRoutes } from '../../../plugins/devices-virtual/router';
import { ListDevices } from '../components/components';

import ViewDevices from './view-devices.vue';

const mocks = vi.hoisted(() => ({
	useRealRouter: false,
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route) => route),
	fetchDevices: vi.fn(),
	fetchValidation: vi.fn(),
	flashError: vi.fn(),
	wizardOptions: [] as { value: string; label: string; description: string; disabled: boolean }[],
	wizardRouteOptions: [] as {
		value: string;
		label: string;
		icon: string;
		to: { name: string };
		testId: string;
		disabled: boolean;
		optionsTitle?: string;
		options?: { value: string; label: string; description: string; icon: string; to: { name: string }; testId: string }[];
	}[],
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
			isMDDevice: vueRef(mocks.isMDDevice),
			isLGDevice: vueRef(mocks.isLGDevice),
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
		wizardRouteOptions: computed(() => mocks.wizardRouteOptions),
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
		mocks.wizardRouteOptions = [
			{
				value: 'devices-virtual',
				label: 'devicesVirtualPlugin.wizard.title',
				icon: 'mdi:call-split',
				to: { name: 'devices_virtual-wizard' },
				testId: 'virtual-device-wizard',
				disabled: false,
			},
		];
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

	it('navigates to the virtual device wizard from its own launcher, independent of the discovery wizard dialog', async () => {
		// Deliberately left empty: the virtual wizard's launcher must not depend on any discovery
		// plugin being installed — it is not a `wizardOptions` entry.
		mocks.wizardOptions = [];

		const wrapper = mountView();

		await wrapper.find('[data-test-id="virtual-device-wizard"]').trigger('click');

		// `beforeEach` defaults `isLGDevice` to `false` (see the `useBreakpoints` stub above), the same
		// branch `onDeviceCreate` is already exercised under elsewhere in this file, so `push` — not
		// `replace` — is the call that reflects it here.
		expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'devices_virtual-wizard' });
	});

	it('asks which kind of virtual device to create before the wizard starts', async () => {
		mocks.wizardRouteOptions[0] = {
			...mocks.wizardRouteOptions[0]!,
			optionsTitle: 'devicesVirtualPlugin.wizard.selectKind',
			options: [
				{
					value: 'projection',
					label: 'p.title',
					description: 'p.description',
					icon: 'mdi:a',
					to: { name: 'devices_virtual-wizard' },
					testId: 'kind-projection',
				},
				{
					value: 'group',
					label: 'g.title',
					description: 'g.description',
					icon: 'mdi:b',
					to: { name: 'devices_virtual-light_group_wizard' },
					testId: 'kind-group',
				},
			],
		} as (typeof mocks.wizardRouteOptions)[number];

		const wrapper = mountView();
		await flushPromises();

		await wrapper.get('[data-test-id="virtual-device-wizard"]').trigger('click');
		await flushPromises();

		// The launcher opens the chooser instead of navigating.
		expect(mocks.routerPush).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();
		expect(wrapper.get('[data-test-id="kind-projection"]').text()).toContain('p.title');

		// Each choice is reachable and operable from the keyboard, not only by pointer.
		const projection = wrapper.get('[data-test-id="kind-projection"]');
		expect(projection.attributes('role')).toBe('button');
		expect(projection.attributes('tabindex')).toBe('0');
		await projection.trigger('keydown', { key: 'Enter' });
		expect(mocks.routerPush).toHaveBeenLastCalledWith({ name: 'devices_virtual-wizard' });

		await wrapper.get('[data-test-id="virtual-device-wizard"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-test-id="kind-group"]').trigger('keydown', { key: ' ' });
		expect(mocks.routerPush).toHaveBeenLastCalledWith({ name: 'devices_virtual-light_group_wizard' });

		await wrapper.get('[data-test-id="virtual-device-wizard"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-test-id="kind-group"]').trigger('click');

		expect(mocks.routerPush).toHaveBeenLastCalledWith({ name: 'devices_virtual-light_group_wizard' });
	});

	it('renders and navigates an enabled Simulator generation launcher alongside Virtual Devices', async () => {
		mocks.wizardRouteOptions.push({
			value: 'simulator-plugin',
			label: 'simulatorPlugin.wizard.title',
			icon: 'mdi:test-tube',
			to: { name: 'simulator-wizard' },
			testId: 'simulator-device-wizard',
			disabled: false,
		});

		const wrapper = mountView();

		await wrapper.find('[data-test-id="simulator-device-wizard"]').trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'simulator-wizard' });
	});

	it('renders the virtual device wizard route on lg+ (desktop) viewports, not just mobile', async () => {
		// Regression test: the virtual wizard route (`devices_virtual-wizard`, registered as a child of
		// `RouteNames.DEVICES` by the plugin) used to be invisible to `isWizardRoute`, which checked only
		// `RouteNames.DEVICES_WIZARD`. On an `lg`+ viewport, that made the outer `router-view`'s condition
		// — `isWizardRoute || (!isDevicesListRoute && !isLGDevice)` — false: the device list stayed
		// mounted and the wizard never rendered, even though the URL had already navigated there. Every
		// other test in this file mounts with `isLGDevice: false` (mobile), which never exercised this.
		mocks.isLGDevice = true;
		mocks.route = {
			path: '/devices/devices-virtual/wizard',
			name: 'devices_virtual-wizard',
			meta: {},
			matched: [],
		};

		const wrapper = mountView();
		await flushPromises();

		expect(wrapper.find('router-view-stub').exists()).toBe(true);
		expect(wrapper.findComponent(ListDevices).exists()).toBe(false);
	});

	it.each([true, false])('renders secondary virtual wizards through the real router (desktop: %s)', async (desktop) => {
		mocks.useRealRouter = true;
		mocks.isLGDevice = desktop;
		const wizardPage = defineComponent({ template: '<div data-test-id="wizard-page" />' });
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{
					path: '/devices',
					name: 'devices',
					component: ViewDevices,
					children: [
						{ path: ':id', name: 'devices-edit', component: defineComponent({ template: '<div data-test-id="device-editor" />' }) },
						...PluginRoutes.map((route) =>
							route.name === VirtualRouteNames.MEASUREMENT_WIZARD
								? route
								: {
										path: route.path,
										name: route.name,
										meta: route.meta,
										component: wizardPage,
									}
						),
					],
				},
			],
		});
		// A direct URL (including a browser refresh) must render the actual measurement shell.
		await router.push('/devices/devices-virtual/measurements/new?mode=sensor_aggregate');
		await router.isReady();
		const wrapper = mountView({}, router);
		await flushPromises();
		expect(wrapper.get('[data-test-id="measurement-editor"]').text()).toBe('sensor_aggregate');
		expect(wrapper.findComponent(ListDevices).exists()).toBe(false);

		// Either measurement mode must also work while the parent stays mounted.
		for (const mode of [DevicesVirtualPluginDeviceMode.sensor_aggregate, DevicesVirtualPluginDeviceMode.sensor_transform]) {
			await router.push({ name: VirtualRouteNames.WIZARD });
			await flushPromises();
			expect(router.currentRoute.value.name).toBe(VirtualRouteNames.WIZARD);
			await router.push({ name: VirtualRouteNames.MEASUREMENT_WIZARD, query: { mode } });
			await flushPromises();
			expect(wrapper.get('[data-test-id="measurement-editor"]').text()).toBe(mode);
			expect(wrapper.findComponent(ListDevices).exists()).toBe(false);
		}
		for (const name of [VirtualRouteNames.LIGHT_GROUP_WIZARD, VirtualRouteNames.THERMOSTAT_WIZARD]) {
			await router.push({ name });
			await flushPromises();
			expect(wrapper.find('[data-test-id="wizard-page"]').exists()).toBe(true);
			expect(wrapper.findComponent(ListDevices).exists()).toBe(false);
		}
		await router.push('/devices/existing-device');
		await flushPromises();
		expect(wrapper.find('[data-test-id="device-editor"]').exists()).toBe(true);
		expect(wrapper.findComponent(ListDevices).exists()).toBe(desktop);
		expect(wrapper.find('[data-test-id="edit-drawer"] [data-test-id="device-editor"]').exists()).toBe(desktop);
		await router.push('/devices');
		await flushPromises();
		expect(wrapper.findComponent(ListDevices).exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-page"]').exists()).toBe(false);
		wrapper.unmount();
	});

	// `ViewHeader` is gated on `isMDDevice`, so on a small screen it renders nothing — and the app bar's
	// single teleported right-hand slot is already the Add button. Without a row of its own there is no
	// way to reach the virtual wizard on a phone short of typing its URL, and unlike the discovery
	// wizard it has no dialog to appear in: the plugin deliberately registers no `deviceWizardAdapter`.
	it('offers the virtual device wizard on small screens, where the header is not rendered', async () => {
		mocks.isMDDevice = false;

		const wrapper = mountView();

		await flushPromises();

		expect(wrapper.find('[data-test-id="virtual-device-wizard-small"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="virtual-device-wizard-small"]').trigger('click');

		expect(mocks.routerPush).toHaveBeenCalledWith(expect.objectContaining({ name: 'devices_virtual-wizard' }));
	});

	it('hides the small-screen virtual wizard launcher when the plugin is disabled', async () => {
		mocks.isMDDevice = false;
		mocks.wizardRouteOptions[0]!.disabled = true;

		const wrapper = mountView();

		await flushPromises();

		expect(wrapper.find('[data-test-id="virtual-device-wizard-small"]').exists()).toBe(false);
	});

	it('hides the virtual device wizard launcher when the plugin is disabled', () => {
		// Mirrors 'hides the wizard button when all wizard-capable plugins are disabled' above: the
		// launcher must not stay visible just because devices-virtual is a core plugin — its config DTO
		// supports `enabled`, so an admin can genuinely turn it off from Extensions.
		mocks.wizardRouteOptions[0]!.disabled = true;

		const wrapper = mountView();

		expect(wrapper.find('[data-test-id="virtual-device-wizard"]').exists()).toBe(false);
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
});
