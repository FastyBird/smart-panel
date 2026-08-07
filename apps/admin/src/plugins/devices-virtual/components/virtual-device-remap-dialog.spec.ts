import { computed, nextTick } from 'vue';
import type { App } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IPluginOptions } from '../../../app.types';
import type { IPlugin } from '../../../common';
import type { IChannel, IDevice } from '../../../modules/devices';
import { registerChannelsPropertiesStore } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
	DevicesModuleDeviceHiddenBy,
	DevicesModuleDevicesHiddenFilter,
	DevicesVirtualPluginValueOrigin,
} from '../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import DevicesVirtualPlugin from '../devices-virtual.plugin';

import type { IVirtualDeviceRemapDialogProps } from './virtual-device-remap-dialog.types';
import VirtualDeviceRemapDialog from './virtual-device-remap-dialog.vue';

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
	POST: vi.fn(),
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

// The plugin descriptor `useChannelsPropertiesPlugins` resolves `type: 'virtual'` against, captured
// from the *real* installer rather than hand-built — see the `DevicesVirtualPlugin.install()` call
// below. A hand-built descriptor would keep this suite green even if `devices-virtual.plugin.ts`
// stopped registering `channelPropertyUpdateReqSchema`, which is exactly the bug this file exists to
// pin (task-12-brief.md's "a trap that fails silently").
const registeredPlugins: IPlugin[] = [];

const pluginsManagerFake = {
	addPlugin: (_key: unknown, plugin: IPlugin): void => {
		registeredPlugins.push(plugin);
	},
	getPlugins: (): IPlugin[] => registeredPlugins,
};

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
	}),
}));

// The real `useChannelsProperties` store instantiates `useChannelsPropertiesPlugins()` at store-setup
// time, which unconditionally calls `useConfigPlugins()` for its `options`/`enabled` surface (unused
// here — only `getElement()` matters for this suite). Bypassing it directly, the same way
// devices.store.spec.ts does, means this file does not also have to fabricate a config-plugins store.
vi.mock('../../../modules/config', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../../modules/config')>()),
	useConfigPlugins: () => ({ enabled: () => true, loaded: { value: true } }),
}));

const devicesStore = {
	findAll: (): IDevice[] => devices,
	findById: (id: string): IDevice | null => devices.find((device) => device.id === id) ?? null,
	fetch: vi.fn(async () => devices),
};

const channelsStore = {
	findForDevice: (deviceId: string): IChannel[] => channels.filter((channel) => channel.device === deviceId),
	findById: (id: string): IChannel | null => channels.find((channel) => channel.id === id) ?? null,
	fetch: vi.fn(async (payload: { deviceId?: string }) => channels.filter((channel) => !payload.deviceId || channel.device === payload.deviceId)),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

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

				throw new Error('Unexpected store requested by the remap dialog');
			},
		}),
		injectPluginsManager: () => pluginsManagerFake,
		useBackend: () => ({ client: backendClient }),
		useFlashMessage: () => flashMessage,
		useLogger: () => logger,
	};
});

// This is the same real store the sources panel and the wizard use — `edit()` here is what routes a
// remap through `transformChannelPropertyUpdateRequest`/`channelPropertyUpdateReqSchema`
// (channels.properties.store.ts:~406-411), which is the exact place `source_property` would be
// silently stripped if the plugin stopped registering its wire schema. A mocked properties store
// would never exercise that code and could not catch the regression.
const pinia = createPinia();
setActivePinia(pinia);
const propertiesStore = registerChannelsPropertiesStore(pinia);

// Installed against the real plugin file (mocked only at the `injectPluginsManager` boundary above),
// so `registeredPlugins` holds exactly what `devices-virtual.plugin.ts`'s `schemas` block declares —
// not a copy of what it *should* declare.
DevicesVirtualPlugin.install(
	{} as App,
	{
		i18n: { global: { getLocaleMessage: () => ({}), setLocaleMessage: () => {} } },
		router: { getRoutes: () => [], addRoute: () => {} },
	} as unknown as IPluginOptions
);

const VIRTUAL_DEVICE_ID = uuid();
const ORPHANED_CHANNEL_ID = uuid();
const ORPHANED_PROPERTY_ID = uuid();

const NEW_SOURCE_DEVICE_ID = uuid();
const NEW_SOURCE_CHANNEL_ID = uuid();
const NEW_SOURCE_PROPERTY_ID = uuid();

const SYSTEM_HIDDEN_DEVICE_ID = uuid();
const HIDDEN_DEVICE_ID = uuid();
const HIDDEN_CHANNEL_ID = uuid();

const devices: IDevice[] = [
	{
		id: VIRTUAL_DEVICE_ID,
		name: 'Hall switch (split)',
		type: DEVICES_VIRTUAL_TYPE,
		category: DevicesModuleDeviceCategory.switcher,
		hidden: false,
		draft: false,
	} as unknown as IDevice,
	{
		id: NEW_SOURCE_DEVICE_ID,
		name: 'Hall relay',
		type: 'shelly-ng',
		category: DevicesModuleDeviceCategory.switcher,
		hidden: false,
		draft: false,
	} as unknown as IDevice,
	{
		id: HIDDEN_DEVICE_ID,
		name: 'Hidden source',
		type: 'shelly-ng',
		category: DevicesModuleDeviceCategory.switcher,
		hidden: true,
		hiddenBy: DevicesModuleDeviceHiddenBy.user,
		draft: false,
	} as unknown as IDevice,
	{
		id: SYSTEM_HIDDEN_DEVICE_ID,
		name: 'Half-split relay board',
		type: 'shelly-ng',
		category: DevicesModuleDeviceCategory.switcher,
		hidden: true,
		hiddenBy: DevicesModuleDeviceHiddenBy.system,
		draft: false,
	} as unknown as IDevice,
];

const channels: IChannel[] = [
	{ id: ORPHANED_CHANNEL_ID, device: VIRTUAL_DEVICE_ID, name: 'Switch', category: DevicesModuleChannelCategory.switcher } as unknown as IChannel,
	{
		id: NEW_SOURCE_CHANNEL_ID,
		device: NEW_SOURCE_DEVICE_ID,
		name: 'Relay 2',
		category: DevicesModuleChannelCategory.switcher,
	} as unknown as IChannel,
	{ id: HIDDEN_CHANNEL_ID, device: HIDDEN_DEVICE_ID, name: 'Hidden relay', category: DevicesModuleChannelCategory.switcher } as unknown as IChannel,
];

const seedProperty = (id: string, overrides: Record<string, unknown>): void => {
	propertiesStore.set({
		id,
		data: {
			// Every seeded property is a plain (non-virtual) source by default — only the orphaned
			// property itself overrides this to `DEVICES_VIRTUAL_TYPE`, which is what makes `edit()` look
			// up the virtual plugin's schemas at all.
			type: 'shelly-ng',
			category: DevicesModuleChannelPropertyCategory.on,
			identifier: DevicesModuleChannelPropertyCategory.on,
			name: null,
			permissions: [DevicesModuleChannelPropertyPermissions.rw],
			dataType: DevicesModuleChannelPropertyDataType.bool,
			format: null,
			invalid: null,
			step: null,
			value: null,
			createdAt: '2024-03-01T12:00:00Z',
			...overrides,
		},
	} as unknown as Parameters<typeof propertiesStore.set>[0]);
};

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

const patchSuccessResponse = (sourcePropertyId: string): { data: { data: Record<string, unknown> }; error: undefined; response: Response } => ({
	data: {
		data: {
			id: ORPHANED_PROPERTY_ID,
			type: DEVICES_VIRTUAL_TYPE,
			channel: ORPHANED_CHANNEL_ID,
			category: DevicesModuleChannelPropertyCategory.on,
			identifier: DevicesModuleChannelPropertyCategory.on,
			name: null,
			permissions: [DevicesModuleChannelPropertyPermissions.rw],
			data_type: DevicesModuleChannelPropertyDataType.bool,
			format: null,
			invalid: null,
			step: null,
			value: null,
			value_origin: DevicesVirtualPluginValueOrigin.source,
			source_property: sourcePropertyId,
			created_at: '2024-03-01T12:00:00Z',
			updated_at: '2024-03-02T12:00:00Z',
		},
	},
	error: undefined,
	response: { status: 200 } as Response,
});

const mountRemapDialog = (props: Partial<IVirtualDeviceRemapDialogProps> = {}) => {
	const wrapper = mount(VirtualDeviceRemapDialog, {
		props: {
			propertyId: ORPHANED_PROPERTY_ID,
			...props,
		},
	});

	const selectSource = async (sourcePropertyId: string | null): Promise<void> => {
		await wrapper.vm.selectSource(sourcePropertyId);
		await nextTick();
	};

	const confirm = async (): Promise<void> => {
		await wrapper.vm.confirm();
		await nextTick();
	};

	return {
		wrapper,
		selectSource,
		confirm,
		property: computed(() => wrapper.vm.property),
		error: computed(() => wrapper.vm.error),
		checking: computed(() => wrapper.vm.checking),
		canConfirm: computed(() => wrapper.vm.canConfirm),
		confirmError: computed(() => wrapper.vm.confirmError),
		sourceDevicesOptions: computed(() => wrapper.vm.sourceDevicesOptions as { value: string; label: string }[]),
	};
};

describe('VirtualDeviceRemapDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		backendClient.POST.mockImplementation(respondCompatible);
		backendClient.PATCH.mockImplementation(async (_path: string, options: { body: { data: { source_property?: string } } }) =>
			patchSuccessResponse(options.body.data.source_property ?? NEW_SOURCE_PROPERTY_ID)
		);

		seedProperty(ORPHANED_PROPERTY_ID, {
			type: DEVICES_VIRTUAL_TYPE,
			channel: ORPHANED_CHANNEL_ID,
			valueOrigin: DevicesVirtualPluginValueOrigin.source,
			sourceProperty: null,
		});
		seedProperty(NEW_SOURCE_PROPERTY_ID, { channel: NEW_SOURCE_CHANNEL_ID, name: 'On' });
		seedProperty(uuid(), { channel: HIDDEN_CHANNEL_ID, name: 'On (hidden source)' });
	});

	// This is the test the brief's Step 1 asks for. It intentionally does not mock the properties
	// store: `mountRemapDialog` -> `confirm()` -> the component's own `propertiesStore.edit()` call ->
	// the real transformer -> the real (plugin-resolved) wire schema -> `backendClient.PATCH`. Every
	// layer between "user clicked confirm" and "bytes on the wire" is the genuine implementation.
	// A source that switched to another allowed variant of its slot is exactly what orphans a
	// projection, and the backend refuses a projection whose representation differs from its source. So
	// a remap that only repointed the link would be refused — the repair flow has to adopt the new
	// representation in the same request or it cannot repair.
	it('adopts the new source representation alongside the link', async () => {
		const { selectSource, confirm } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);
		await confirm();

		const body = (backendClient.PATCH as Mock).mock.calls[0]?.[1] as { body: { data: Record<string, unknown> } } | undefined;

		expect(body?.body.data).toMatchObject({ source_property: NEW_SOURCE_PROPERTY_ID });
		expect(Object.keys(body?.body.data ?? {})).toContain('data_type');
	});

	// The outgoing projection constrains; the incoming source deliberately does not. Coalescing each
	// field past the source's explicit null keeps the old constraint, and the backend takes it, because
	// those fields are irrelevant to the variant now in play — so the property goes on advertising a
	// range and a grid its new source has never had.
	it("adopts a new source's explicitly absent constraints rather than keeping the old ones", async () => {
		propertiesStore.set({
			id: ORPHANED_PROPERTY_ID,
			data: {
				format: [0, 100],
				step: 1,
			},
		} as unknown as Parameters<typeof propertiesStore.set>[0]);

		const { selectSource, confirm } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);
		await confirm();

		const body = (backendClient.PATCH as Mock).mock.calls[0]?.[1] as { body: { data: Record<string, unknown> } } | undefined;

		expect(body?.body.data).toMatchObject({ format: null, step: null });
	});

	// A sentinel travels with the link for the same reason the representation does: the backend refuses
	// a projection that does not reserve what its source reserves, so a remap that left it behind could
	// not repair a source that had started declaring one.
	it("adopts the new source's reserved sentinel", async () => {
		propertiesStore.set({
			id: NEW_SOURCE_PROPERTY_ID,
			data: { invalid: 99 },
		} as unknown as Parameters<typeof propertiesStore.set>[0]);

		const { selectSource, confirm } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);
		await confirm();

		const body = (backendClient.PATCH as Mock).mock.calls[0]?.[1] as { body: { data: Record<string, unknown> } } | undefined;

		expect(body?.body.data).toMatchObject({ invalid: 99 });
	});

	it('remaps an orphaned property to a new source', async () => {
		const { selectSource, confirm } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);
		await confirm();

		expect(backendClient.PATCH).toHaveBeenCalledTimes(1);

		const [path, options] = (backendClient.PATCH as Mock).mock.calls[0] as [string, { body: { data: Record<string, unknown> } }];

		expect(path).toBe('/modules/devices/channels/{channelId}/properties/{id}');
		expect(options.body.data).toMatchObject({ source_property: NEW_SOURCE_PROPERTY_ID });
	});

	it('sends the PATCH against the orphaned property, not the chosen source', async () => {
		const { selectSource, confirm } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);
		await confirm();

		const [, options] = (backendClient.PATCH as Mock).mock.calls[0] as [string, { params: { path: { channelId: string; id: string } } }];

		expect(options.params.path).toEqual({ channelId: ORPHANED_CHANNEL_ID, id: ORPHANED_PROPERTY_ID });
	});

	it('checks compatibility with the spec triple derived from the orphaned property', async () => {
		const { selectSource } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);

		expect(backendClient.POST).toHaveBeenCalledWith(
			'/plugins/devices-virtual/devices/compatibility',
			expect.objectContaining({
				body: {
					data: {
						category: DevicesModuleDeviceCategory.switcher,
						candidates: [
							{
								spec_channel: DevicesModuleChannelCategory.switcher,
								spec_property: DevicesModuleChannelPropertyCategory.on,
								source_property: NEW_SOURCE_PROPERTY_ID,
							},
						],
					},
				},
			})
		);
	});

	// Same hard block as the wizard mapping step: an unverified or refused pairing must not be
	// confirmable, and the backend's own reason is shown rather than a generic substitute.
	it('hard-blocks an incompatible source and shows the backend reason verbatim', async () => {
		const reason = 'Source property permissions [ro] do not satisfy required permission(s) [rw]';

		backendClient.POST.mockResolvedValueOnce({
			data: {
				data: [
					{
						spec_channel: DevicesModuleChannelCategory.switcher,
						spec_property: DevicesModuleChannelPropertyCategory.on,
						source_property: NEW_SOURCE_PROPERTY_ID,
						compatible: false,
						reason,
					},
				],
			},
			error: undefined,
			response: { status: 200 } as Response,
		});

		const { selectSource, confirm, error, canConfirm } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);

		expect(error.value).toBe(reason);
		expect(canConfirm.value).toBe(false);

		await confirm();

		expect(backendClient.PATCH).not.toHaveBeenCalled();
	});

	// Regression test: `runCompatibility` used to return before setting `error`/`checking` when the
	// target property resolved but its channel (or device) did not — e.g. a concurrent delete leaves the
	// property cached with a `channel` id the channels store no longer has. `canConfirm` then read
	// `error === null && !checking` as true, enabling Confirm on a pairing no verdict was ever obtained
	// for. An unverified pairing must block exactly as an incompatible one does.
	it('blocks confirm when the target property resolves but its channel does not', async () => {
		const propertyWithMissingChannelId = uuid();

		seedProperty(propertyWithMissingChannelId, {
			type: DEVICES_VIRTUAL_TYPE,
			channel: uuid(), // Deliberately not in `channels` — simulates the channel having been deleted.
			valueOrigin: DevicesVirtualPluginValueOrigin.source,
			sourceProperty: null,
		});

		const { selectSource, confirm, property, error, canConfirm } = mountRemapDialog({ propertyId: propertyWithMissingChannelId });

		expect(property.value).toBeDefined();

		await selectSource(NEW_SOURCE_PROPERTY_ID);

		expect(backendClient.POST).not.toHaveBeenCalled();
		expect(error.value).not.toBeNull();
		expect(canConfirm.value).toBe(false);

		await confirm();

		expect(backendClient.PATCH).not.toHaveBeenCalled();
	});

	it('blocks confirm while a compatibility check is still in flight', async () => {
		let resolveCheck: ((value: unknown) => void) | undefined;

		backendClient.POST.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveCheck = resolve;
				})
		);

		const { wrapper, canConfirm } = mountRemapDialog();

		const pending = wrapper.vm.selectSource(NEW_SOURCE_PROPERTY_ID);

		await nextTick();

		expect(canConfirm.value).toBe(false);

		resolveCheck?.(await respondCompatible('', { body: { data: { candidates: [] } } }));

		await pending;
		await nextTick();
	});

	// Same two exclusions as the wizard mapping step, and for the same reasons: a hidden device is
	// already replaced by a virtual one, and the compatibility endpoint does not run
	// `assertSourceNotVirtual`, so a virtual source would preview clean here and then fail on save.
	it('excludes user-hidden and virtual devices from the source picker', () => {
		const { sourceDevicesOptions } = mountRemapDialog();

		const values = sourceDevicesOptions.value.map((option) => option.value);

		expect(values).toContain(NEW_SOURCE_DEVICE_ID);
		expect(values).not.toContain(HIDDEN_DEVICE_ID);
		expect(values).not.toContain(VIRTUAL_DEVICE_ID);
	});

	// A source property deleted and recreated on a part-split board orphans its projection, and the
	// board itself is system-hidden by then. With no admin unhide path, excluding it here would leave
	// the virtual device permanently offline with nothing able to repair it.
	it('still offers a system-hidden device, so an orphan on a split board can be repaired', () => {
		const { sourceDevicesOptions } = mountRemapDialog();

		expect(sourceDevicesOptions.value.map((option) => option.value)).toContain(SYSTEM_HIDDEN_DEVICE_ID);
	});

	it('asks for hidden devices so a system-hidden source survives the fetch', () => {
		mountRemapDialog();

		expect(devicesStore.fetch).toHaveBeenCalledWith({ hidden: DevicesModuleDevicesHiddenFilter.all });
	});

	// The property can vanish between the sources panel rendering the warning and the dialog actually
	// opening for it (someone else deletes it, or its device, in that window). `property` is read live
	// off the store rather than snapshotted, so this state is reachable at mount, not just mid-session.
	it('shows the property as gone and blocks confirm when it no longer exists', async () => {
		const { property, canConfirm, wrapper } = mountRemapDialog({ propertyId: uuid() });

		expect(property.value).toBeUndefined();
		expect(canConfirm.value).toBe(false);

		// el-dialog opens through a transition; its body is only in the accessible DOM once that
		// transition's first tick has run, which none of the assertions above depend on.
		await nextTick();

		expect(wrapper.find('[data-test-id="remap-property-gone"]').exists()).toBe(true);
	});

	// The other half of the same race: the property (or its device) is deleted *after* the dialog opens
	// but *before* confirm is clicked. The PATCH 404s, `edit()`'s own recovery path re-fetches the
	// property (also a 404) and throws — this asserts the dialog surfaces that rather than closing as
	// if nothing happened.
	it('surfaces the backend error and stays open when the property was deleted before confirming', async () => {
		const notFound = {
			data: undefined,
			error: { error: { details: [{ reason: 'Channel property not found' }] } },
			response: { status: 404 } as Response,
		};

		backendClient.PATCH.mockResolvedValueOnce(notFound);
		backendClient.GET.mockResolvedValueOnce(notFound);

		const { selectSource, confirm, confirmError, wrapper } = mountRemapDialog();

		await selectSource(NEW_SOURCE_PROPERTY_ID);
		await confirm();

		expect(confirmError.value).toBe('Channel property not found');
		expect(wrapper.emitted('remapped')).toBeFalsy();
		expect(wrapper.emitted('close')).toBeFalsy();
		expect(flashMessage.error).toHaveBeenCalledWith('Channel property not found');
	});

	it('emits close without confirming', async () => {
		const { wrapper } = mountRemapDialog();

		await wrapper.vm.onClose();

		expect(wrapper.emitted('close')).toBeTruthy();
		expect(backendClient.PATCH).not.toHaveBeenCalled();
	});
});
