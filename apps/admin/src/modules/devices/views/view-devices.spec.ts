/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { ListDevices } from '../components/components';

import ViewDevices from './view-devices.vue';

const mocks = vi.hoisted(() => ({
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route) => route),
	fetchDevices: vi.fn(),
	fetchValidation: vi.fn(),
	flashError: vi.fn(),
	wizardOptions: [] as { value: string; label: string; description: string; disabled: boolean }[],
	virtualWizardEnabled: true,
	// Read once per `useBreakpoints()` call (at mount time), same as `virtualWizardEnabled` above — not
	// reactive within a test, so set it before `mountView()`, not after.
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

vi.mock('../../../plugins/devices-virtual/devices-virtual.constants', () => ({
	RouteNames: {
		WIZARD: 'devices_virtual-wizard',
	},
	DEVICES_VIRTUAL_PLUGIN_NAME: 'devices-virtual',
}));

vi.mock('../../config', () => ({
	useConfigPlugins: () => ({
		enabled: () => mocks.virtualWizardEnabled,
	}),
}));

vi.mock('../devices.exceptions', () => ({
	DevicesException: Error,
}));

const mountView = (props: Record<string, unknown> = {}) =>
	mount(ViewDevices, {
		props,
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
		mocks.virtualWizardEnabled = true;
		mocks.isLGDevice = false;
		mocks.isMDDevice = true;
		mocks.route = {
			path: '/devices',
			name: 'devices',
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
			matched: [],
		};

		const wrapper = mountView();
		await flushPromises();

		expect(wrapper.find('router-view-stub').exists()).toBe(true);
		expect(wrapper.findComponent(ListDevices).exists()).toBe(false);
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
		mocks.virtualWizardEnabled = false;

		const wrapper = mountView();

		await flushPromises();

		expect(wrapper.find('[data-test-id="virtual-device-wizard-small"]').exists()).toBe(false);
	});

	it('hides the virtual device wizard launcher when the plugin is disabled', () => {
		// Mirrors 'hides the wizard button when all wizard-capable plugins are disabled' above: the
		// launcher must not stay visible just because devices-virtual is a core plugin — its config DTO
		// supports `enabled`, so an admin can genuinely turn it off from Extensions.
		mocks.virtualWizardEnabled = false;

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
