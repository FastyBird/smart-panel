import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IChannelProperty } from '../../../../modules/devices/store/channels.properties.store.types';
import type { IChannel } from '../../../../modules/devices/store/channels.store.types';
import { DeviceUpdateReqSchema } from '../../../../modules/devices/store/devices.store.schemas';
import type { IDevice } from '../../../../modules/devices/store/devices.store.types';
import { transformDeviceUpdateRequest } from '../../../../modules/devices/store/devices.transformers';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../../modules/devices/store/keys';
import { SpaceType } from '../../../../modules/spaces/spaces.constants';
import { spacesStoreKey } from '../../../../modules/spaces/store/keys';
import type { ISpace } from '../../../../modules/spaces/store/spaces.store.types';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleDeviceCategory,
} from '../../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../../devices-virtual.constants';

import type { IVirtualWizardReviewStepProps } from './virtual-wizard-review-step.types';
import VirtualWizardReviewStep from './virtual-wizard-review-step.vue';
import type { IVirtualSlotMapping } from './virtual-wizard.types';

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

// Same requirement as the mapping step's spec: `createI18n` has to be present because mocking
// `common` below (for `injectStoresManager`) pulls in `common`'s real transitive chain via
// `vi.importActual`, which reaches the app's locale bootstrap.
vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
	}),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
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

				throw new Error('Unexpected store requested by the review step');
			},
		}),
		useBackend: () => ({ client: backendClient }),
		useFlashMessage: () => flashMessage,
		useLogger: () => logger,
	};
});

const DEVICE_SHELLY = 'device-shelly';
const DEVICE_ZIGBEE = 'device-zigbee';

const CHANNEL_RELAY_0 = 'channel-relay-0';
const CHANNEL_RELAY_1 = 'channel-relay-1';
const CHANNEL_SENSOR = 'channel-sensor';

const PROPERTY_RELAY_0_ON = 'property-relay-0-on';
const PROPERTY_RELAY_1_ON = 'property-relay-1-on';
const PROPERTY_POWER = 'property-power';
const PROPERTY_VOLTAGE = 'property-voltage';
const PROPERTY_SENSOR_ACTIVE = 'property-sensor-active';

const ROOM_LIVING = 'room-living';
const ZONE_SECURITY = 'zone-security';

const devices = [
	{ id: DEVICE_SHELLY, name: 'Shelly 4PM', type: 'shelly-ng', hidden: false, draft: false },
	{ id: DEVICE_ZIGBEE, name: 'Zigbee Sensor', type: 'zigbee2mqtt', hidden: false, draft: false },
] as unknown as IDevice[];

const channels = [
	{ id: CHANNEL_RELAY_0, device: DEVICE_SHELLY, name: 'Relay 1', category: DevicesModuleChannelCategory.switcher },
	{ id: CHANNEL_RELAY_1, device: DEVICE_SHELLY, name: 'Relay 2', category: DevicesModuleChannelCategory.switcher },
	{ id: CHANNEL_SENSOR, device: DEVICE_ZIGBEE, name: 'Motion', category: DevicesModuleChannelCategory.motion },
] as unknown as IChannel[];

const properties = [
	{ id: PROPERTY_RELAY_0_ON, channel: CHANNEL_RELAY_0, name: 'Output', category: DevicesModuleChannelPropertyCategory.on },
	{ id: PROPERTY_RELAY_1_ON, channel: CHANNEL_RELAY_1, name: 'Output', category: DevicesModuleChannelPropertyCategory.on },
	{ id: PROPERTY_POWER, channel: CHANNEL_RELAY_1, name: null, category: DevicesModuleChannelPropertyCategory.power },
	{ id: PROPERTY_VOLTAGE, channel: CHANNEL_RELAY_1, name: null, category: DevicesModuleChannelPropertyCategory.voltage },
	{ id: PROPERTY_SENSOR_ACTIVE, channel: CHANNEL_SENSOR, name: null, category: DevicesModuleChannelPropertyCategory.active },
] as unknown as IChannelProperty[];

const spaces = [
	{ id: ROOM_LIVING, name: 'Living Room', type: SpaceType.ROOM, category: 'living_room' },
	{ id: ZONE_SECURITY, name: 'Security', type: SpaceType.ZONE, category: 'security' },
] as unknown as ISpace[];

// Captures what `devicesStore.edit()` would actually send once the payload has been run through the
// *real* `transformDeviceUpdateRequest` + `DeviceUpdateReqSchema` pipeline — the exact place
// `hidden`/`hidden_by` would be silently dropped if that schema ever regressed. Asserting only that
// `edit` was called with the right local (camelCase) arguments would not catch that class of bug; this
// fixture exists specifically so a test can assert on the *transformed* (wire-shaped) body instead.
const editCalls: Record<string, unknown>[] = [];

const devicesStore = {
	findAll: (): IDevice[] => devices,
	findById: (id: string): IDevice | null => devices.find((device) => device.id === id) ?? null,
	get: vi.fn(async (payload: { id: string }): Promise<IDevice> => devices.find((device) => device.id === payload.id) as IDevice),
	addZone: vi.fn(async (payload: { id: string; zoneId: string }): Promise<IDevice> => devices.find((device) => device.id === payload.id) as IDevice),
	edit: vi.fn(async (payload: { id: string; data: Record<string, unknown> }): Promise<IDevice> => {
		editCalls.push(transformDeviceUpdateRequest(payload.data as never, DeviceUpdateReqSchema) as Record<string, unknown>);

		return devices.find((device) => device.id === payload.id) as IDevice;
	}),
};

const channelsStore = {
	findAll: (): IChannel[] => channels,
	findById: (id: string): IChannel | null => channels.find((channel) => channel.id === id) ?? null,
};

const propertiesStore = {
	findAll: (): IChannelProperty[] => properties,
	findById: (id: string): IChannelProperty | null => properties.find((property) => property.id === id) ?? null,
};

const spacesStore = {
	findAll: (): ISpace[] => spaces,
	findById: (id: string): ISpace | null => spaces.find((space) => space.id === id) ?? null,
};

const mapping = (
	specChannel: DevicesModuleChannelCategory,
	specProperty: DevicesModuleChannelPropertyCategory,
	sourceProperty: string | null
): IVirtualSlotMapping => ({ specChannel, specProperty, sourceProperty });

const respondCreated = (
	overrides: Partial<{ id: string; name: string }> = {}
): { data: { data: Record<string, unknown> }; error: undefined; response: Response } => ({
	data: {
		data: {
			id: 'new-device-id',
			type: DEVICES_VIRTUAL_TYPE,
			category: DevicesModuleDeviceCategory.lighting,
			name: 'Living Room Light',
			...overrides,
		},
	},
	error: undefined,
	response: { status: 201 } as Response,
});

const mountReviewStep = (props: Partial<IVirtualWizardReviewStepProps> = {}) => {
	const wrapper = mount(VirtualWizardReviewStep, {
		props: {
			category: DevicesModuleDeviceCategory.lighting,
			mappings: [],
			name: 'Living Room Light',
			roomId: null,
			zoneIds: [],
			...props,
		},
	});

	return {
		wrapper,
		rows: {
			get value() {
				return wrapper.vm.rows;
			},
		},
		canHideSource: {
			get value() {
				return wrapper.vm.canHideSource;
			},
		},
		sourceDevice: {
			get value() {
				return wrapper.vm.sourceDevice;
			},
		},
		submitState: {
			get value() {
				return wrapper.vm.submitState;
			},
		},
		hideState: {
			get value() {
				return wrapper.vm.hideState;
			},
		},
		canCreate: {
			get value() {
				return wrapper.vm.canCreate;
			},
		},
		created: {
			get value() {
				const emitted = wrapper.emitted('created');

				return emitted ? emitted[emitted.length - 1]?.[0] : undefined;
			},
		},
	};
};

describe('VirtualWizardReviewStep', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		editCalls.length = 0;
		backendClient.POST.mockResolvedValue(respondCreated());
	});

	it('summarises each mapping as source device, channel and property', () => {
		const onSlotMappedToRelay = mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON);

		const { rows } = mountReviewStep({ mappings: [onSlotMappedToRelay] });

		expect(rows.value[0]).toMatchObject({ specProperty: 'on', sourceDevice: 'Shelly 4PM', sourceProperty: 'Output' });
	});

	it('offers to hide the source device when every mapping comes from one device', () => {
		const relay0 = mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON);
		const relay1 = mapping(DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelPropertyCategory.power, PROPERTY_POWER);

		const { canHideSource } = mountReviewStep({ mappings: [relay0, relay1] });

		expect(canHideSource.value).toBe(true);
	});

	it('does not offer to hide when sources span devices', () => {
		const relayFromShelly = mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON);
		const sensorFromZigbee = mapping(DevicesModuleChannelCategory.motion, DevicesModuleChannelPropertyCategory.active, PROPERTY_SENSOR_ACTIVE);

		const { canHideSource } = mountReviewStep({ mappings: [relayFromShelly, sensorFromZigbee] });

		expect(canHideSource.value).toBe(false);
	});

	it('does not offer to hide when a mapping cannot be resolved back to a device', () => {
		const relay0 = mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON);
		const goneMissing = mapping(DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelPropertyCategory.power, 'no-such-property-id');

		const { canHideSource, rows } = mountReviewStep({ mappings: [relay0, goneMissing] });

		// The row still renders (with a fallback label) rather than silently vanishing — but the offer
		// to hide is conservatively withheld, since an unresolvable mapping is not proof the split is
		// still clean against a single device.
		expect(rows.value).toHaveLength(2);
		expect(canHideSource.value).toBe(false);
	});

	it('skips unmapped slots both when summarising and when building the create payload', async () => {
		const { rows, wrapper } = mountReviewStep({
			mappings: [
				mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON),
				mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.brightness, null),
			],
		});

		expect(rows.value).toHaveLength(1);

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		const [, options] = (backendClient.POST as Mock).mock.calls[0] as [
			string,
			{ body: { data: { channels: { category: string; properties: { category: string }[] }[] } } },
		];

		const lightChannel = options.body.data.channels.find((channel) => channel.category === DevicesModuleChannelCategory.light);

		expect(lightChannel?.properties).toHaveLength(1);
		expect(lightChannel?.properties[0].category).toBe(DevicesModuleChannelPropertyCategory.on);
	});

	it('creates the device in one POST with channels grouped by spec channel', async () => {
		const { wrapper } = mountReviewStep({
			category: DevicesModuleDeviceCategory.lighting,
			name: 'Living Room Light',
			roomId: ROOM_LIVING,
			mappings: [
				mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON),
				mapping(DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelPropertyCategory.power, PROPERTY_POWER),
			],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(backendClient.POST).toHaveBeenCalledTimes(1);

		const [path, options] = (backendClient.POST as Mock).mock.calls[0] as [
			string,
			{
				body: {
					data: { type: string; category: string; name: string; room_id: string | null; channels: { category: string; properties: unknown[] }[] };
				};
			},
		];

		expect(path).toBe('/modules/devices/devices');
		expect(options.body.data.type).toBe(DEVICES_VIRTUAL_TYPE);
		expect(options.body.data.category).toBe(DevicesModuleDeviceCategory.lighting);
		expect(options.body.data.name).toBe('Living Room Light');
		expect(options.body.data.room_id).toBe(ROOM_LIVING);
		expect(options.body.data.channels).toHaveLength(2);

		const categories = options.body.data.channels.map((channel) => channel.category).sort();

		expect(categories).toEqual([DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelCategory.light].sort());
	});

	// The previous test only proves two mappings under *different* spec channels land as two channel
	// objects — that assertion (`channels.toHaveLength(2)`) passes identically under a naive
	// one-channel-per-mapping implementation that never groups anything. This is the test that actually
	// exercises grouping: two *filled* mappings sharing one spec channel — `electrical_power.power` and
	// `electrical_power.voltage` together is the ordinary shape of that channel, not a contrived edge
	// case — must land as one channel object carrying both properties, not two channel objects with the
	// same category (which the backend would see as a duplicate-identifier channel in the same POST).
	it('groups two mappings that share one spec channel into a single channel object with both properties', async () => {
		const { wrapper } = mountReviewStep({
			mappings: [
				mapping(DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelPropertyCategory.power, PROPERTY_POWER),
				mapping(DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelPropertyCategory.voltage, PROPERTY_VOLTAGE),
			],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		const [, options] = (backendClient.POST as Mock).mock.calls[0] as [
			string,
			{ body: { data: { channels: { category: string; properties: { category: string }[] }[] } } },
		];

		expect(options.body.data.channels).toHaveLength(1);
		expect(options.body.data.channels[0].category).toBe(DevicesModuleChannelCategory.electrical_power);

		const propertyCategories = options.body.data.channels[0].properties.map((property) => property.category).sort();

		expect(propertyCategories).toEqual([DevicesModuleChannelPropertyCategory.power, DevicesModuleChannelPropertyCategory.voltage].sort());
	});

	// `light.brightness` declares two variants — a `uchar` percentage and an `enum`. The compatibility
	// check accepts either, so an enum-valued source passes and, if the payload always took the first
	// variant, would be stored as numeric with that variant's format and step. The projected strings
	// would then be exposed through a property calling itself a number.
	// Most slots declare a single `data_type` and no variant array, so the fallback is the common path.
	// Dropping the collapsed format and step there sent both as null, and the backend refuses a
	// constrained slot whose projection declares no range — `electrical_power.power` is `[0, 10000]`.
	it('keeps the format and step of a single-data-type slot', async () => {
		const { wrapper } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelPropertyCategory.power, PROPERTY_POWER)],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		const [, options] = (backendClient.POST as Mock).mock.calls[0] as [
			string,
			{ body: { data: { channels: { properties: { category: string; format: unknown }[] }[] } } },
		];

		const power = options.body.data.channels[0].properties.find((property) => property.category === DevicesModuleChannelPropertyCategory.power);

		expect(power?.format).not.toBeNull();
	});

	it('stores the spec variant matching the source data type, not the first one', async () => {
		const enumSourceId = 'property-enum-brightness';

		properties.push({
			id: enumSourceId,
			channel: CHANNEL_RELAY_0,
			name: 'Mode',
			category: DevicesModuleChannelPropertyCategory.brightness,
			dataType: DevicesModuleChannelPropertyDataType.enum,
		} as unknown as IChannelProperty);

		const { wrapper } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.brightness, enumSourceId)],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		const [, options] = (backendClient.POST as Mock).mock.calls[0] as [
			string,
			{ body: { data: { channels: { properties: { category: string; data_type: string }[] }[] } } },
		];

		const brightness = options.body.data.channels[0].properties.find(
			(property) => property.category === DevicesModuleChannelPropertyCategory.brightness
		);

		expect(brightness?.data_type).toBe(DevicesModuleChannelPropertyDataType.enum);
	});

	it('marks a borrowed property with value_origin "source" and the mapped property id', async () => {
		const { wrapper } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		const [, options] = (backendClient.POST as Mock).mock.calls[0] as [
			string,
			{ body: { data: { channels: { properties: { value_origin: string; source_property: string }[] }[] } } },
		];

		expect(options.body.data.channels[0].properties[0]).toMatchObject({
			value_origin: 'source',
			source_property: PROPERTY_RELAY_0_ON,
		});
	});

	it('emits created once the device exists, even with the hide checkbox left unchecked', async () => {
		const { wrapper, created, submitState } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(submitState.value).toBe('created');
		expect(created.value).toEqual({ id: 'new-device-id', name: 'Living Room Light' });
		expect(devicesStore.edit).not.toHaveBeenCalled();
	});

	// The trap this pins directly: asserting only that `devicesStore.edit` was *called* with
	// `{ hidden: true, hiddenBy: 'system' }` would still pass even if `DeviceUpdateReqSchema` silently
	// stripped both fields before they ever reached the wire — the drop happens one layer further in.
	// `editCalls` captures what the fixture's `edit()` produces after running the *real* transform, so
	// this fails if that schema regresses.
	it('sends only type, hidden and hidden_by when hiding the source device — never a spread device model', async () => {
		const { wrapper } = mountReviewStep({
			mappings: [
				mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON),
				mapping(DevicesModuleChannelCategory.electrical_power, DevicesModuleChannelPropertyCategory.power, PROPERTY_POWER),
			],
		});

		await wrapper.get('[data-test-id="hide-source-checkbox"]').find('input').setValue(true);
		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(devicesStore.edit).toHaveBeenCalledTimes(1);
		expect(devicesStore.edit).toHaveBeenCalledWith({
			id: DEVICE_SHELLY,
			data: { type: 'shelly-ng', hidden: true, hiddenBy: 'system' },
		});

		expect(editCalls).toHaveLength(1);
		expect(editCalls[0]).toMatchObject({ hidden: true, hidden_by: 'system' });
		// Only the three fields the brief calls for — no room_id/zone_ids/category/etc. carried along.
		expect(Object.keys(editCalls[0]).sort()).toEqual(['hidden', 'hidden_by', 'type']);
	});

	it('does not attempt to hide when the checkbox is left unchecked', async () => {
		const { wrapper } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(devicesStore.edit).not.toHaveBeenCalled();
	});

	it('does not offer the hide checkbox at all when sources span devices', () => {
		const { wrapper } = mountReviewStep({
			mappings: [
				mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON),
				mapping(DevicesModuleChannelCategory.motion, DevicesModuleChannelPropertyCategory.active, PROPERTY_SENSOR_ACTIVE),
			],
		});

		expect(wrapper.find('[data-test-id="hide-source-checkbox"]').exists()).toBe(false);
	});

	// This is the ordering/failure-handling case: the device was already created successfully by the
	// time the hide PATCH fails, so the user must not be told the whole thing failed, must not be
	// invited to click Create again (that would create a *second* device), and must still see `created`
	// fire so the wizard shell can move on. A retry affordance targets only the hide, not the create.
	it('still reports the device created when the hide that follows it fails, and offers to retry just the hide', async () => {
		devicesStore.edit.mockRejectedValueOnce(new Error('Source device could not be updated'));

		const { wrapper, created, submitState, hideState } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
		});

		await wrapper.get('[data-test-id="hide-source-checkbox"]').find('input').setValue(true);
		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(submitState.value).toBe('created');
		expect(created.value).toEqual({ id: 'new-device-id', name: 'Living Room Light' });
		expect(hideState.value).toBe('failed');
		expect(flashMessage.error).toHaveBeenCalled();

		// The Create button must be gone (retrying it would create a duplicate device) and a scoped
		// retry action for the hide must be present instead.
		expect(wrapper.find('[data-test-id="create-device"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="retry-hide"]').exists()).toBe(true);

		devicesStore.edit.mockResolvedValueOnce(devices[0]);

		await wrapper.get('[data-test-id="retry-hide"]').trigger('click');
		await flushAsync();

		expect(hideState.value).toBe('hidden');
		expect(backendClient.POST).toHaveBeenCalledTimes(1);
	});

	it('shows the backend error and allows retrying when creation itself fails', async () => {
		backendClient.POST.mockResolvedValueOnce({
			data: undefined,
			error: { error: { details: [{ reason: 'Category is not allowed for virtual devices' }] } },
			response: { status: 422 } as Response,
		});

		const { wrapper, submitState, canCreate } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(submitState.value).toBe('error');
		expect(wrapper.get('[data-test-id="create-error"]').text()).toContain('Category is not allowed for virtual devices');
		// Nothing was created, so retrying is exactly the right recovery — the button must come back.
		expect(canCreate.value).toBe(true);
		expect(wrapper.find('[data-test-id="create-device"]').exists()).toBe(true);
	});

	it('assigns every zone after creating the device, tolerating one failure without blocking the rest', async () => {
		devicesStore.addZone.mockRejectedValueOnce(new Error('Zone assignment refused'));

		const secondZone = 'zone-outdoor';

		const { wrapper } = mountReviewStep({
			zoneIds: [ZONE_SECURITY, secondZone],
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(devicesStore.addZone).toHaveBeenCalledWith({ id: 'new-device-id', zoneId: ZONE_SECURITY });
		expect(devicesStore.addZone).toHaveBeenCalledWith({ id: 'new-device-id', zoneId: secondZone });
		expect(flashMessage.warning).toHaveBeenCalled();
	});

	// `devicesStore.addZone()` rejects outright when the device is not yet in its local cache, so a
	// fire-and-forget hydration made zone assignment race a websocket update and commonly reported every
	// selected zone as failed on a creation that had actually succeeded.
	it('hydrates the created device before assigning its zones', async () => {
		const hydrationOrder: string[] = [];

		devicesStore.get.mockImplementationOnce(async (payload: { id: string }) => {
			hydrationOrder.push('get');

			return devices.find((device) => device.id === payload.id) as IDevice;
		});
		devicesStore.addZone.mockImplementationOnce(async (payload: { id: string; zoneId: string }) => {
			hydrationOrder.push('addZone');

			return devices.find((device) => device.id === payload.id) as IDevice;
		});

		const { wrapper } = mountReviewStep({
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
			zoneIds: [ZONE_SECURITY],
		});

		await wrapper.get('[data-test-id="create-device"]').trigger('click');
		await flushAsync();

		expect(hydrationOrder).toEqual(['get', 'addZone']);
	});

	it('disables Create when nothing is mapped', () => {
		const { canCreate } = mountReviewStep({ mappings: [] });

		expect(canCreate.value).toBe(false);
	});

	it('disables Create when the name is blank', () => {
		const { canCreate } = mountReviewStep({
			name: '   ',
			mappings: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_RELAY_0_ON)],
		});

		expect(canCreate.value).toBe(false);
	});
});

// Several micro-tasks deep: the create POST, the best-effort `get()` warm, zone assignment awaits and
// the hide awaits all chain after the click handler's own await boundaries. A couple of flushes is
// what actually drains them in jsdom; a single `nextTick()` leaves later stages unresolved.
const flushAsync = async (): Promise<void> => {
	for (let i = 0; i < 5; i += 1) {
		await Promise.resolve();
	}
};
