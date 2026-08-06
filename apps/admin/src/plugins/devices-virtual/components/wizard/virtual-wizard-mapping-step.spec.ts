import { computed, nextTick } from 'vue';

import { ElProgress } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IChannel, IChannelProperty, IDevice } from '../../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../../modules/devices/store/keys';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../../openapi.constants';
import { DEVICES_VIRTUAL_TYPE } from '../../devices-virtual.constants';

import type { IVirtualWizardMappingStepProps } from './virtual-wizard-mapping-step.types';
import VirtualWizardMappingStep from './virtual-wizard-mapping-step.vue';

const backendClient = {
	GET: vi.fn(),
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

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		// Interpolation params are appended so a test can assert on the numbers fed into the
		// progress string without depending on the English wording.
		t: (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
	}),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			// Keyed explicitly rather than falling through to a default, so asking for a store this
			// fixture does not provide fails loudly instead of quietly handing back the wrong one.
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

				throw new Error('Unexpected store requested by the mapping step');
			},
		}),
		useBackend: () => ({ client: backendClient }),
		useFlashMessage: () => flashMessage,
		useLogger: () => logger,
	};
});

// Source fixtures. The shape mirrors a four-relay device split across rooms: one physical device
// carrying a switcher channel and a power channel, plus a second device whose `on` is read-only —
// the source the backend refuses.
const DEVICE_RELAY = 'device-relay';
const DEVICE_SENSOR = 'device-sensor';
const DEVICE_HIDDEN = 'device-hidden';
const DEVICE_VIRTUAL = 'device-virtual';

const CHANNEL_SWITCHER = 'channel-switcher';
const CHANNEL_POWER = 'channel-power';
const CHANNEL_SENSOR = 'channel-sensor';
const CHANNEL_HIDDEN = 'channel-hidden';

const PROPERTY_ON = 'property-on';
const PROPERTY_POWER = 'property-power';
const PROPERTY_VOLTAGE = 'property-voltage';
const READ_ONLY_PROPERTY_ID = 'property-read-only';

const devices = [
	{ id: DEVICE_RELAY, name: 'Hall relay', type: 'shelly-ng', hidden: false, draft: false },
	{ id: DEVICE_SENSOR, name: 'Read-only sensor', type: 'shelly-ng', hidden: false, draft: false },
	{ id: DEVICE_HIDDEN, name: 'Hidden source', type: 'shelly-ng', hidden: true, draft: false },
	{ id: DEVICE_VIRTUAL, name: 'Existing virtual', type: DEVICES_VIRTUAL_TYPE, hidden: false, draft: false },
] as unknown as IDevice[];

const channels = [
	{ id: CHANNEL_SWITCHER, device: DEVICE_RELAY, name: 'Relay 2', category: DevicesModuleChannelCategory.switcher },
	{ id: CHANNEL_POWER, device: DEVICE_RELAY, name: 'Power 2', category: DevicesModuleChannelCategory.electrical_power },
	{ id: CHANNEL_SENSOR, device: DEVICE_SENSOR, name: 'Contact', category: DevicesModuleChannelCategory.switcher },
	{ id: CHANNEL_HIDDEN, device: DEVICE_HIDDEN, name: 'Hidden relay', category: DevicesModuleChannelCategory.switcher },
] as unknown as IChannel[];

const properties = [
	{
		id: PROPERTY_ON,
		channel: CHANNEL_SWITCHER,
		name: 'On',
		category: DevicesModuleChannelPropertyCategory.on,
		permissions: [DevicesModuleChannelPropertyPermissions.rw],
		dataType: DevicesModuleChannelPropertyDataType.bool,
	},
	{
		id: PROPERTY_POWER,
		channel: CHANNEL_POWER,
		name: 'Power',
		category: DevicesModuleChannelPropertyCategory.power,
		permissions: [DevicesModuleChannelPropertyPermissions.ro],
		dataType: DevicesModuleChannelPropertyDataType.float,
	},
	{
		id: PROPERTY_VOLTAGE,
		channel: CHANNEL_POWER,
		name: 'Voltage',
		category: DevicesModuleChannelPropertyCategory.voltage,
		permissions: [DevicesModuleChannelPropertyPermissions.ro],
		dataType: DevicesModuleChannelPropertyDataType.float,
	},
	{
		id: READ_ONLY_PROPERTY_ID,
		channel: CHANNEL_SENSOR,
		name: 'Contact state',
		category: DevicesModuleChannelPropertyCategory.on,
		permissions: [DevicesModuleChannelPropertyPermissions.ro],
		dataType: DevicesModuleChannelPropertyDataType.bool,
	},
] as unknown as IChannelProperty[];

const devicesStore = {
	findAll: (): IDevice[] => devices,
	findById: (id: string): IDevice | null => devices.find((device) => device.id === id) ?? null,
	fetch: vi.fn(async () => devices),
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

// The real report echoes the triple it was evaluated for; the wizard needs that echo to match a
// report back to the slot that asked for it, so the fixtures carry it rather than the bare
// `{ compatible, reason }` pair.
const report = (
	specChannel: DevicesModuleChannelCategory,
	specProperty: DevicesModuleChannelPropertyCategory,
	sourceProperty: string,
	compatible: boolean,
	reason?: string
): Record<string, unknown> => ({
	spec_channel: specChannel,
	spec_property: specProperty,
	source_property: sourceProperty,
	compatible,
	...(compatible ? {} : { reason }),
});

const respondWith = (reports: Record<string, unknown>[]): { data: { data: Record<string, unknown>[] }; error: undefined; response: Response } => ({
	data: { data: reports },
	error: undefined,
	response: { status: 200 } as Response,
});

// The backend answers one report per candidate, in request order, echoing each candidate's triple.
// Mirroring that here (rather than a hand-written fixture) keeps a test from passing on a response
// that could not correspond to the request it was sent.
const respondCompatible = async (
	_path: string,
	options: {
		body: {
			data: {
				candidates: { spec_channel: DevicesModuleChannelCategory; spec_property: DevicesModuleChannelPropertyCategory; source_property: string }[];
			};
		};
	}
): Promise<ReturnType<typeof respondWith>> =>
	respondWith(
		options.body.data.candidates.map((candidate) => report(candidate.spec_channel, candidate.spec_property, candidate.source_property, true))
	);

const PERMISSION_MISMATCH = `Source property id=${READ_ONLY_PROPERTY_ID} permissions [ro] do not satisfy required permission(s) [rw]`;

const mountMappingStep = (props: Partial<IVirtualWizardMappingStepProps> = {}) => {
	const wrapper = mount(VirtualWizardMappingStep, {
		props: {
			category: DevicesModuleDeviceCategory.lighting,
			modelValue: [],
			...props,
		},
	});

	// The component keys errors by slot key (`<channel>.<property>`), because a bare property
	// category is not unique across a category's channels — `fault` and `active` appear on several.
	// These tests only ever touch slots whose property category is unique within `lighting`, so the
	// helper re-keys by property category to keep the assertions readable.
	const bySpecProperty = (): Record<string, string> =>
		Object.fromEntries(
			wrapper.vm.slots
				.filter((slot) => typeof wrapper.vm.errors[slot.key] === 'string')
				.map((slot) => [slot.specProperty, wrapper.vm.errors[slot.key] as string])
		);

	const slotFor = (specProperty: DevicesModuleChannelPropertyCategory): string => {
		const slot = wrapper.vm.slots.find((entry) => entry.specProperty === specProperty);

		if (!slot) {
			throw new Error(`No slot for spec property '${specProperty}'`);
		}

		return slot.key;
	};

	const selectSource = async (specProperty: DevicesModuleChannelPropertyCategory, sourcePropertyId: string | null): Promise<void> => {
		await wrapper.vm.selectSource(slotFor(specProperty), sourcePropertyId);

		await nextTick();
	};

	// The rendered bar, not just the numbers behind it: "reports itself complete" is something the user
	// sees, and a green 100% bar says it just as loudly as `isValid` does.
	const progressBar = () => wrapper.findComponent(ElProgress);

	return {
		wrapper,
		slots: computed(() => wrapper.vm.slots),
		groups: computed(() => wrapper.vm.groups),
		errors: computed(bySpecProperty),
		progress: computed(() => wrapper.vm.progress),
		isValid: computed(() => wrapper.vm.isValid),
		sourceDevicesOptions: computed(() => wrapper.vm.sourceDevicesOptions),
		progressBar,
		slotFor,
		selectSource,
		applyChannel: wrapper.vm.applyChannel,
	};
};

const mapping = (
	specChannel: DevicesModuleChannelCategory,
	specProperty: DevicesModuleChannelPropertyCategory,
	sourceProperty: string | null
): { specChannel: DevicesModuleChannelCategory; specProperty: DevicesModuleChannelPropertyCategory; sourceProperty: string | null } => ({
	specChannel,
	specProperty,
	sourceProperty,
});

describe('VirtualWizardMappingStep', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		backendClient.POST.mockImplementation(respondCompatible);
	});

	it('lists every required slot for the chosen category', () => {
		const { slots } = mountMappingStep();

		expect(slots.value.filter((slot) => slot.required).map((slot) => slot.specProperty)).toContain('on');
	});

	it('blocks a source the backend reports incompatible', async () => {
		backendClient.POST.mockResolvedValue(
			respondWith([
				report(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID, false, PERMISSION_MISMATCH),
			])
		);

		const { selectSource, errors, isValid } = mountMappingStep();

		await selectSource(DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID);

		expect(errors.value.on).toContain('permissions [ro] do not satisfy required permission(s) [rw]');
		// The backend's reason is the only thing telling the user why, so it is shown verbatim.
		expect(errors.value.on).toBe(PERMISSION_MISMATCH);
		// Hard block: an incompatible mapping must not let the wizard advance.
		expect(isValid.value).toBe(false);
	});

	it('excludes the device_information slots from mapping', () => {
		const { slots } = mountMappingStep();

		expect(slots.value.map((slot) => slot.specChannel)).not.toContain('device_information');
	});

	it('treats a required property of an optional channel as an optional slot', () => {
		const { slots } = mountMappingStep();

		const illuminance = slots.value.find(
			(slot) =>
				slot.specChannel === DevicesModuleChannelCategory.illuminance && slot.specProperty === DevicesModuleChannelPropertyCategory.illuminance
		);

		expect(illuminance?.propertyRequired).toBe(true);
		expect(illuminance?.channelRequired).toBe(false);
		expect(illuminance?.required).toBe(false);
	});

	it('sends one non-empty candidate carrying the spec triple per selection', async () => {
		const { selectSource } = mountMappingStep();

		await selectSource(DevicesModuleChannelPropertyCategory.on, PROPERTY_ON);

		expect(backendClient.POST).toHaveBeenCalledTimes(1);

		const [path, options] = (backendClient.POST as Mock).mock.calls[0] as [string, { body: { data: Record<string, unknown> } }];

		expect(path).toBe('/plugins/devices-virtual/devices/compatibility');
		expect(options.body.data).toEqual({
			category: DevicesModuleDeviceCategory.lighting,
			candidates: [
				{
					spec_channel: DevicesModuleChannelCategory.light,
					spec_property: DevicesModuleChannelPropertyCategory.on,
					source_property: PROPERTY_ON,
				},
			],
		});
	});

	it('records a compatible selection and reports the step complete', async () => {
		const { wrapper, selectSource, errors, progress, isValid } = mountMappingStep();

		expect(progress.value.requiredFilled).toBe(0);

		await selectSource(DevicesModuleChannelPropertyCategory.on, PROPERTY_ON);

		expect(errors.value.on).toBeUndefined();
		expect(progress.value.requiredFilled).toBe(progress.value.requiredTotal);
		expect(isValid.value).toBe(true);

		const emitted = wrapper.emitted('update:modelValue');

		expect(emitted).toBeTruthy();

		const mappings = emitted?.[emitted.length - 1]?.[0] as { specChannel: string; specProperty: string; sourceProperty: string | null }[];

		expect(mappings).toContainEqual({
			specChannel: DevicesModuleChannelCategory.light,
			specProperty: DevicesModuleChannelPropertyCategory.on,
			sourceProperty: PROPERTY_ON,
		});
	});

	it('discards an in-flight result whose slot has since been given a different source', async () => {
		let resolveStale: ((value: unknown) => void) | undefined;

		backendClient.POST.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveStale = resolve;
				})
		).mockResolvedValueOnce(respondWith([report(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_ON, true)]));

		const { selectSource, errors } = mountMappingStep();

		const stale = selectSource(DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID);

		await selectSource(DevicesModuleChannelPropertyCategory.on, PROPERTY_ON);

		resolveStale?.(
			respondWith([
				report(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID, false, PERMISSION_MISMATCH),
			])
		);

		await stale;
		await nextTick();

		expect(errors.value.on).toBeUndefined();
	});

	it('drops the error and the progress credit when a mapping is cleared', async () => {
		const { selectSource, progress, isValid } = mountMappingStep();

		await selectSource(DevicesModuleChannelPropertyCategory.on, PROPERTY_ON);

		expect(progress.value.requiredFilled).toBe(1);

		// An optional slot must not be credited against the required total, or the indicator would
		// report the step finished while a required slot is still empty.
		await selectSource(DevicesModuleChannelPropertyCategory.brightness, PROPERTY_ON);

		expect(progress.value.requiredTotal).toBe(1);
		expect(progress.value.requiredFilled).toBe(1);

		await selectSource(DevicesModuleChannelPropertyCategory.on, null);

		expect(progress.value.requiredFilled).toBe(0);
		expect(progress.value.remaining.map((slot) => slot.specProperty)).toContain(DevicesModuleChannelPropertyCategory.on);
		expect(isValid.value).toBe(false);
	});

	it('fills only the slots a source channel covers and checks them in one batch', async () => {
		const { wrapper, applyChannel } = mountMappingStep();

		await applyChannel(DevicesModuleChannelCategory.electrical_power, CHANNEL_POWER);

		await nextTick();

		expect(backendClient.POST).toHaveBeenCalledTimes(1);

		const [, options] = (backendClient.POST as Mock).mock.calls[0] as [string, { body: { data: { candidates: Record<string, string>[] } } }];

		// The source channel carries `power` and `voltage` only; the remaining electrical_power slots
		// are left untouched rather than half-filled or cleared.
		expect(options.body.data.candidates).toEqual([
			{
				spec_channel: DevicesModuleChannelCategory.electrical_power,
				spec_property: DevicesModuleChannelPropertyCategory.power,
				source_property: PROPERTY_POWER,
			},
			{
				spec_channel: DevicesModuleChannelCategory.electrical_power,
				spec_property: DevicesModuleChannelPropertyCategory.voltage,
				source_property: PROPERTY_VOLTAGE,
			},
		]);

		const emitted = wrapper.emitted('update:modelValue');
		const mappings = emitted?.[emitted.length - 1]?.[0] as { specChannel: string; specProperty: string; sourceProperty: string | null }[];

		const filled = mappings.filter((mapping) => mapping.specChannel === DevicesModuleChannelCategory.electrical_power && mapping.sourceProperty);

		expect(filled).toHaveLength(2);
	});

	it('never calls the endpoint with an empty candidate list', async () => {
		const { applyChannel } = mountMappingStep();

		// `light` has no property category in common with the power channel, so nothing gets filled.
		await applyChannel(DevicesModuleChannelCategory.light, CHANNEL_POWER);

		expect(backendClient.POST).not.toHaveBeenCalled();
	});

	it('does not offer a hidden or a virtual device as a source', () => {
		const { sourceDevicesOptions } = mountMappingStep();

		const values = sourceDevicesOptions.value.map((option) => option.value);

		expect(values).toContain(DEVICE_RELAY);
		expect(values).not.toContain(DEVICE_HIDDEN);
		expect(values).not.toContain(DEVICE_VIRTUAL);
	});

	it('blocks the step when the compatibility check itself fails', async () => {
		backendClient.POST.mockResolvedValue({ data: undefined, error: { error: { details: [{ reason: 'Source property does not exist' }] } } });

		const { selectSource, errors, isValid } = mountMappingStep();

		await selectSource(DevicesModuleChannelPropertyCategory.on, PROPERTY_ON);

		expect(errors.value.on).toBe('Source property does not exist');
		expect(isValid.value).toBe(false);
	});

	// `device_information` is filtered out of the expansion, and for five of the 32 categories —
	// `switcher`, `generic`, `sensor`, `terminal`, `game_console` — it is the *only* required channel.
	// Their required set is therefore empty, so "nothing outstanding" is true from the first render and
	// must not be read as "finished". `switcher` is the flagship case: splitting a four-relay device
	// into per-room switches is what the whole feature exists for, and it is not a blocked category.
	describe('a category whose required set is empty once device_information is filtered out', () => {
		const SWITCHER_ON_SLOT = `${DevicesModuleChannelCategory.switcher}.${DevicesModuleChannelPropertyCategory.on}`;

		it('has no required slot at all, and nothing outstanding', () => {
			const { progress } = mountMappingStep({ category: DevicesModuleDeviceCategory.switcher });

			expect(progress.value.requiredTotal).toBe(0);
			expect(progress.value.remaining).toHaveLength(0);
		});

		it('is not valid before anything has been mapped', () => {
			const { wrapper, isValid } = mountMappingStep({ category: DevicesModuleDeviceCategory.switcher });

			// A virtual device that borrows no property is never valid, whatever its category's spec
			// says — otherwise the wizard would go on to build a device that borrows nothing.
			expect(isValid.value).toBe(false);
			expect(wrapper.emitted('update:valid')?.[0]?.[0]).toBe(false);
		});

		it('does not render a completed progress bar before anything has been mapped', () => {
			const { wrapper, progressBar } = mountMappingStep({ category: DevicesModuleDeviceCategory.switcher });

			expect(progressBar().props('percentage')).toBe(0);
			expect(progressBar().props('status')).not.toBe('success');

			// "0 of 0 required properties mapped" reads as finished, so this category says what it needs
			// instead.
			expect(wrapper.get('[data-test-id="mapping-progress"]').text()).toContain('devicesVirtualPlugin.wizard.mapping.noRequired');
		});

		it('becomes valid and complete as soon as one property is mapped', async () => {
			const { wrapper, isValid, progressBar } = mountMappingStep({ category: DevicesModuleDeviceCategory.switcher });

			await wrapper.vm.selectSource(SWITCHER_ON_SLOT, PROPERTY_ON);

			await nextTick();

			expect(isValid.value).toBe(true);
			expect(progressBar().props('percentage')).toBe(100);
			expect(progressBar().props('status')).toBe('success');
		});
	});

	describe('when the category changes', () => {
		it('clears the mappings, the errors and the pickers left by the previous category', async () => {
			backendClient.POST.mockResolvedValue(
				respondWith([
					report(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID, false, PERMISSION_MISMATCH),
				])
			);

			const { wrapper, selectSource, errors, progress, isValid } = mountMappingStep();

			await selectSource(DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID);

			expect(errors.value.on).toBe(PERMISSION_MISMATCH);

			await wrapper.setProps({ category: DevicesModuleDeviceCategory.window_covering });

			await nextTick();

			// The old category's slots do not exist any more, so anything keyed by them would be
			// unreachable state that blocks the step with nothing on screen to fix.
			expect(wrapper.vm.errors).toEqual({});
			expect(wrapper.vm.checking).toEqual({});
			expect(wrapper.vm.pickers).toEqual({});
			expect(progress.value.requiredTotal).toBeGreaterThan(0);
			expect(progress.value.requiredFilled).toBe(0);
			expect(isValid.value).toBe(false);
		});

		it('drops a verdict still in flight for the previous category', async () => {
			let resolveStale: ((value: unknown) => void) | undefined;

			backendClient.POST.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveStale = resolve;
					})
			);

			const { wrapper, selectSource } = mountMappingStep();

			const stale = selectSource(DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID);

			await wrapper.setProps({ category: DevicesModuleDeviceCategory.window_covering });

			await nextTick();

			resolveStale?.(
				respondWith([
					report(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID, false, PERMISSION_MISMATCH),
				])
			);

			await stale;
			await nextTick();

			// `light.on` is not a slot of `window_covering`, so this verdict could only ever have pinned
			// an error nothing could clear.
			expect(wrapper.vm.errors).toEqual({});
			expect(wrapper.vm.checking).toEqual({});
		});
	});

	describe('when the wizard shell replaces the mapping list', () => {
		it('adopts the supplied mappings and drops the ones it replaced', async () => {
			const { wrapper, selectSource, progress } = mountMappingStep();

			await selectSource(DevicesModuleChannelPropertyCategory.brightness, PROPERTY_ON);

			await wrapper.setProps({ modelValue: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_ON)] });

			await nextTick();

			const emitted = wrapper.emitted('update:modelValue');
			const emittedMappings = emitted?.[emitted.length - 1]?.[0] as { specChannel: string; specProperty: string; sourceProperty: string | null }[];

			expect(emittedMappings.filter((entry) => entry.sourceProperty !== null)).toEqual([
				mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_ON),
			]);
			expect(progress.value.requiredFilled).toBe(1);

			// Presentational, but re-derived rather than kept: a picker still pointing at the replaced
			// source's channel would offer a property list not containing the mapping it is showing.
			expect(wrapper.vm.pickers[`${DevicesModuleChannelCategory.light}.${DevicesModuleChannelPropertyCategory.on}`]).toEqual({
				device: DEVICE_RELAY,
				channel: CHANNEL_SWITCHER,
			});
		});

		it('ignores the echo of its own emit', async () => {
			const { wrapper, selectSource, progress } = mountMappingStep();

			await selectSource(DevicesModuleChannelPropertyCategory.on, PROPERTY_ON);

			const emitted = wrapper.emitted('update:modelValue');
			const emittedMappings = emitted?.[emitted.length - 1]?.[0] as { specChannel: string; specProperty: string; sourceProperty: string | null }[];
			const emitCount = emitted?.length ?? 0;

			await wrapper.setProps({ modelValue: emittedMappings });

			await nextTick();

			// Adopting its own emit would clear and re-add every selection, which would emit again — a
			// loop between the step and the shell that owns the state.
			expect(progress.value.requiredFilled).toBe(1);
			expect(wrapper.emitted('update:modelValue')?.length).toBe(emitCount);
		});

		it('clears an error left against a mapping that is no longer in the list', async () => {
			backendClient.POST.mockResolvedValue(
				respondWith([
					report(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID, false, PERMISSION_MISMATCH),
				])
			);

			const { wrapper, selectSource, errors, isValid } = mountMappingStep();

			await selectSource(DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID);

			expect(errors.value.on).toBe(PERMISSION_MISMATCH);
			expect(isValid.value).toBe(false);

			await wrapper.setProps({ modelValue: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_ON)] });

			await nextTick();

			// The refused source is gone, so its error has to go with it. Left behind it would block the
			// step forever: the slot's property select now holds nothing, and Element Plus only draws the
			// clear affordance when there is a value, so nothing on screen could clear it.
			expect(errors.value.on).toBeUndefined();
			expect(isValid.value).toBe(true);
		});

		it('drops a verdict still in flight for a selection it replaced', async () => {
			let resolveStale: ((value: unknown) => void) | undefined;

			backendClient.POST.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveStale = resolve;
					})
			);

			const { wrapper, selectSource, errors, isValid } = mountMappingStep();

			const stale = selectSource(DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID);

			await wrapper.setProps({ modelValue: [mapping(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, PROPERTY_ON)] });

			await nextTick();

			resolveStale?.(
				respondWith([
					report(DevicesModuleChannelCategory.light, DevicesModuleChannelPropertyCategory.on, READ_ONLY_PROPERTY_ID, false, PERMISSION_MISMATCH),
				])
			);

			await stale;
			await nextTick();

			expect(errors.value.on).toBeUndefined();
			expect(isValid.value).toBe(true);
		});
	});
});
