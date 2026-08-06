/* eslint-disable vue/one-component-per-file */
import { ref } from 'vue';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { spacesStoreKey } from '../../../modules/spaces/store/keys';
import type { ISpace } from '../../../modules/spaces/store/spaces.store.types';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';
import VirtualWizardDetailsStep from '../components/wizard/virtual-wizard-details-step.vue';
import VirtualWizardMappingStep from '../components/wizard/virtual-wizard-mapping-step.vue';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';

import ViewVirtualDeviceWizard from './view-virtual-device-wizard.vue';

const mocks = vi.hoisted(() => ({
	isMDDevice: true,
	isLGDevice: true,
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	routerResolve: vi.fn((route: unknown) => route),
	useMeta: vi.fn(),
}));

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
};

const flashMessage = {
	error: vi.fn(),
	warning: vi.fn(),
	success: vi.fn(),
	info: vi.fn(),
};

const logger = {
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
};

// A single real device standing in for one channel of a multi-relay device (the flagship "split a
// Shelly 4PM into per-room switches" scenario) — enough to satisfy `lighting`'s one required slot
// (`light.on`) without pulling in the fuller fixtures the individual step specs use.
const DEVICE_SHELLY = 'device-shelly';
const CHANNEL_RELAY = 'channel-relay';
const shellyRelayPropertyId = 'property-relay-on';

const devices = [{ id: DEVICE_SHELLY, name: 'Shelly 4PM', type: 'shelly-ng', hidden: false, draft: false }] as unknown as IDevice[];

const channels = [
	{ id: CHANNEL_RELAY, device: DEVICE_SHELLY, name: 'Relay 1', category: DevicesModuleChannelCategory.switcher },
] as unknown as IChannel[];

const properties = [
	{
		id: shellyRelayPropertyId,
		channel: CHANNEL_RELAY,
		name: 'Output',
		category: DevicesModuleChannelPropertyCategory.on,
		permissions: [DevicesModuleChannelPropertyPermissions.rw],
		dataType: DevicesModuleChannelPropertyDataType.bool,
	},
] as unknown as IChannelProperty[];

const spaces: ISpace[] = [];

const devicesStore = {
	findAll: (): IDevice[] => devices,
	findById: (id: string): IDevice | null => devices.find((device) => device.id === id) ?? null,
	fetch: vi.fn(async () => devices),
	get: vi.fn(async (payload: { id: string }): Promise<IDevice> => devices.find((device) => device.id === payload.id) as IDevice),
	addZone: vi.fn(async (payload: { id: string; zoneId: string }): Promise<IDevice> => devices.find((device) => device.id === payload.id) as IDevice),
	edit: vi.fn(async (payload: { id: string }): Promise<IDevice> => devices.find((device) => device.id === payload.id) as IDevice),
};

const channelsStore = {
	findAll: (): IChannel[] => channels,
	findForDevice: (deviceId: string): IChannel[] => channels.filter((channel) => channel.device === deviceId),
	findById: (id: string): IChannel | null => channels.find((channel) => channel.id === id) ?? null,
	fetch: vi.fn(async (payload: { deviceId?: string }) => channels.filter((channel) => !payload.deviceId || channel.device === payload.deviceId)),
};

const propertiesStore = {
	findAll: (): IChannelProperty[] => properties,
	findForChannel: (channelId: string): IChannelProperty[] => properties.filter((property) => property.channel === channelId),
	findById: (id: string): IChannelProperty | null => properties.find((property) => property.id === id) ?? null,
	fetch: vi.fn(async (payload: { channelId: string }) => properties.filter((property) => property.channel === payload.channelId)),
};

const spacesStore = {
	findAll: (): ISpace[] => spaces,
	findById: (): ISpace | null => null,
	fetch: vi.fn(async () => spaces),
};

// The backend answers one compatibility report per candidate, echoing the triple it was evaluated
// for; every candidate this suite ever sends is meant to succeed, so the fixture always reports back
// `compatible: true` rather than hand-writing a report per test.
const respondCompatible = async (
	_path: string,
	options: { body: { data: { candidates: { spec_channel: string; spec_property: string; source_property: string }[] } } }
): Promise<{ data: { data: Record<string, unknown>[] }; error: undefined; response: Response }> => ({
	data: {
		data: options.body.data.candidates.map((candidate) => ({
			spec_channel: candidate.spec_channel,
			spec_property: candidate.spec_property,
			source_property: candidate.source_property,
			compatible: true,
		})),
	},
	error: undefined,
	response: { status: 200 } as Response,
});

const respondCreated = (): { data: { data: Record<string, unknown> }; error: undefined; response: Response } => ({
	data: {
		data: {
			id: 'created-device-id',
			type: DEVICES_VIRTUAL_TYPE,
			category: DevicesModuleDeviceCategory.lighting,
			name: 'Living Room Light',
		},
	},
	error: undefined,
	response: { status: 201 } as Response,
});

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
		DEVICE: 'devices_module-device',
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
		// The mapping, details and review steps read these four directly — they are mounted for real
		// (not stubbed) so the flow between them is what is actually under test here.
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === devicesStoreKey) {
					return devicesStore;
				}

				if (key === channelsStoreKey) {
					return channelsStore;
				}

				if (key === channelsPropertiesStoreKey) {
					return propertiesStore;
				}

				if (key === spacesStoreKey) {
					return spacesStore;
				}

				throw new Error('Unexpected store requested by the wizard shell');
			},
		}),
		useBackend: () => ({ client: backendClient }),
		useFlashMessage: () => flashMessage,
		useLogger: () => logger,
		getErrorReason: (_error: unknown, fallback: string) => fallback,
	};
});

// Several micro-tasks deep: the compatibility/create POSTs, the best-effort `get()` cache warm and
// any zone/hide awaits all chain after a click handler's own await boundaries. A couple of flushes is
// what actually drains them in jsdom; a single `nextTick()` leaves later stages unresolved.
const flushAsync = async (): Promise<void> => {
	for (let i = 0; i < 5; i += 1) {
		await Promise.resolve();
	}
};

const mountWizard = () => {
	const wrapper = mount(ViewVirtualDeviceWizard);

	const chooseCategory = async (category: DevicesModuleDeviceCategory): Promise<void> => {
		await wrapper.findComponent({ name: 'ElSelect' }).setValue(category);
		await flushAsync();

		await wrapper.find('[data-test-id="wizard-next"]').trigger('click');
		await flushAsync();
	};

	// Drives the mapping step's own `selectSource`, the same way that step's own spec does, rather
	// than simulating its three cascading device/channel/property selects — this test is about the
	// wizard shell wiring the steps together, not about re-proving the mapping step's own UI.
	const mapSlot = async (specProperty: DevicesModuleChannelPropertyCategory, sourcePropertyId: string): Promise<void> => {
		const mappingStep = wrapper.findComponent(VirtualWizardMappingStep);
		const slot = mappingStep.vm.slots.find((entry) => entry.specProperty === specProperty);

		if (!slot) {
			throw new Error(`No slot for spec property '${specProperty}'`);
		}

		await mappingStep.vm.selectSource(slot.key, sourcePropertyId);
		await flushAsync();

		await wrapper.find('[data-test-id="wizard-next"]').trigger('click');
		await flushAsync();
	};

	const setName = async (name: string): Promise<void> => {
		await wrapper.findComponent(VirtualWizardDetailsStep).find('input').setValue(name);
		await flushAsync();

		await wrapper.find('[data-test-id="wizard-next"]').trigger('click');
		await flushAsync();
	};

	// Drives the review step's own "Create device" button — the shell has no create action of its
	// own, so this is the only thing `confirm()` can mean.
	const confirm = async (): Promise<void> => {
		await wrapper.find('[data-test-id="create-device"]').trigger('click');
		await flushAsync();
	};

	return {
		wrapper,
		chooseCategory,
		mapSlot,
		setName,
		confirm,
		activeStep: {
			get value() {
				return wrapper.vm.activeStep;
			},
		},
		canAdvance: {
			get value() {
				return wrapper.vm.canAdvance;
			},
		},
		createdDevice: {
			get value() {
				return wrapper.vm.createdDevice;
			},
		},
	};
};

describe('ViewVirtualDeviceWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.isMDDevice = true;
		mocks.isLGDevice = true;

		backendClient.POST.mockImplementation(async (path: string, options: never) => {
			if (path.endsWith('/compatibility')) {
				return respondCompatible(path, options);
			}

			return respondCreated();
		});
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

	it('does not allow advancing past the category step until a category is chosen', () => {
		const wizard = mountWizard();

		expect(wizard.canAdvance.value).toBe(false);
	});

	it('refuses to advance while a required slot is unmapped', async () => {
		const wizard = mountWizard();

		await wizard.chooseCategory(DevicesModuleDeviceCategory.lighting);

		expect(wizard.activeStep.value).toBe(1);
		expect(wizard.canAdvance.value).toBe(false);
	});

	it('creates a virtual device from a completed flow', async () => {
		const wizard = mountWizard();

		await wizard.chooseCategory(DevicesModuleDeviceCategory.lighting);
		await wizard.mapSlot(DevicesModuleChannelPropertyCategory.on, shellyRelayPropertyId);
		await wizard.setName('Living Room Light');
		await wizard.confirm();

		// The review step deliberately bypasses `devicesStore.add()` (which strips nested `channels`)
		// and POSTs through the backend client directly — so that is the call this asserts against,
		// not a `devicesApi.create()`-shaped helper.
		expect(backendClient.POST).toHaveBeenCalledWith(
			'/modules/devices/devices',
			expect.objectContaining({
				body: {
					data: expect.objectContaining({
						type: DEVICES_VIRTUAL_TYPE,
						category: DevicesModuleDeviceCategory.lighting,
						name: 'Living Room Light',
					}),
				},
			})
		);

		// Exactly one create call: the shell must not add a Finish/Create action of its own alongside
		// the review step's, or a single confirm could create two devices.
		const createCalls = (backendClient.POST as Mock).mock.calls.filter((call: unknown[]) => call[0] === '/modules/devices/devices');

		expect(createCalls).toHaveLength(1);
		expect(wizard.createdDevice.value).toEqual({ id: 'created-device-id', name: 'Living Room Light' });
	});

	it('moves back to the previous step without losing what was already chosen', async () => {
		const wizard = mountWizard();

		await wizard.chooseCategory(DevicesModuleDeviceCategory.lighting);

		expect(wizard.activeStep.value).toBe(1);

		await wizard.wrapper.find('[data-test-id="wizard-back"]').trigger('click');

		expect(wizard.activeStep.value).toBe(0);
		expect(wizard.wrapper.findComponent({ name: 'VirtualWizardCategoryStep' }).props('modelValue')).toBe(DevicesModuleDeviceCategory.lighting);
	});

	it('clears a mapping made under the previous category once the category is changed', async () => {
		const wizard = mountWizard();

		await wizard.chooseCategory(DevicesModuleDeviceCategory.lighting);
		await wizard.mapSlot(DevicesModuleChannelPropertyCategory.on, shellyRelayPropertyId);

		expect(wizard.activeStep.value).toBe(2);

		await wizard.wrapper.find('[data-test-id="wizard-back"]').trigger('click');
		await wizard.wrapper.find('[data-test-id="wizard-back"]').trigger('click');

		expect(wizard.activeStep.value).toBe(0);

		// `switcher`'s only required channel (`device_information`) is filtered out of the mapping
		// step's own expansion, so its required set is empty and it reports itself complete the instant
		// *anything* is mapped — including a stray mapping carried over from a different category. This
		// is exactly the scenario the wizard shell has to guard against when the category changes.
		await wizard.wrapper.findComponent({ name: 'ElSelect' }).setValue(DevicesModuleDeviceCategory.switcher);
		await flushAsync();

		await wizard.wrapper.find('[data-test-id="wizard-next"]').trigger('click');
		await flushAsync();

		expect(wizard.activeStep.value).toBe(1);
		expect(wizard.canAdvance.value).toBe(false);
	});

	it('replaces Cancel/Back with a way to view the created device once the flow completes', async () => {
		const wizard = mountWizard();

		await wizard.chooseCategory(DevicesModuleDeviceCategory.lighting);
		await wizard.mapSlot(DevicesModuleChannelPropertyCategory.on, shellyRelayPropertyId);
		await wizard.setName('Living Room Light');
		await wizard.confirm();

		expect(wizard.wrapper.find('[data-test-id="wizard-cancel"]').exists()).toBe(false);
		expect(wizard.wrapper.find('[data-test-id="wizard-back"]').exists()).toBe(false);
		expect(wizard.wrapper.find('[data-test-id="wizard-next"]').exists()).toBe(false);

		await wizard.wrapper.find('[data-test-id="wizard-view-device"]').trigger('click');

		expect(mocks.routerReplace).toHaveBeenCalledWith({ name: 'devices_module-device', params: { id: 'created-device-id' } });
	});
});
