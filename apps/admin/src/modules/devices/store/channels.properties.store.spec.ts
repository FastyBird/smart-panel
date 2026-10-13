import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesVirtualPluginValueOrigin,
} from '../../../openapi.constants';
import {
	DEVICES_HOME_ASSISTANT_TYPE,
	DEVICE_NO_ENTITY,
	ENTITY_NO_ATTRIBUTE,
} from '../../../plugins/devices-home-assistant/devices-home-assistant.constants';
import {
	HomeAssistantChannelPropertySchema,
	HomeAssistantChannelPropertyUpdateReqSchema,
} from '../../../plugins/devices-home-assistant/store/channels.properties.store.schemas';
import { DEVICES_VIRTUAL_TYPE } from '../../../plugins/devices-virtual/devices-virtual.constants';
import {
	VirtualChannelPropertySchema,
	VirtualChannelPropertyUpdateReqSchema,
} from '../../../plugins/devices-virtual/store/channels.properties.store.schemas';
import { DevicesValidationException } from '../devices.exceptions';

import { useChannelsProperties } from './channels.properties.store';
import { ChannelPropertySchema } from './channels.properties.store.schemas';
import type {
	IChannelPropertyRes,
	IChannelsPropertiesOnEventActionPayload,
	IChannelsPropertiesSetActionPayload,
} from './channels.properties.store.types';
import { transformChannelPropertyResponse } from './channels.properties.transformers';

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
	PATCH: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: vi.fn(() => 'Some error'),
	};
});

const getPluginElement = vi.hoisted(() => vi.fn());

// The plugin registry always answers "no element for this type" — this spec exercises the default
// `ChannelPropertySchema` path, per the task brief.
vi.mock('../composables/useChannelsPropertiesPlugins', () => ({
	useChannelsPropertiesPlugins: () => ({
		getElement: getPluginElement,
	}),
}));

const channelId = uuid();
const propertyId = uuid();

const rawResponse = (overrides: Partial<IChannelPropertyRes> = {}): IChannelPropertyRes => ({
	id: propertyId,
	type: 'some-property',
	channel: channelId,
	category: DevicesModuleChannelPropertyCategory.generic,
	identifier: null,
	name: 'Some channel property',
	permissions: [DevicesModuleChannelPropertyPermissions.ro],
	data_type: DevicesModuleChannelPropertyDataType.string,
	format: null,
	invalid: -1,
	step: null,
	value: { value: 'Some value', last_updated: null },
	created_at: '2024-03-01T12:00:00Z',
	updated_at: null,
	...overrides,
});

describe('ChannelsProperties Store', () => {
	let store: ReturnType<typeof useChannelsProperties>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useChannelsProperties();

		vi.clearAllMocks();
		getPluginElement.mockReturnValue(undefined);
	});

	it('creates a new entry', () => {
		const data = transformChannelPropertyResponse(rawResponse(), ChannelPropertySchema);

		const result = store.set({ id: propertyId, data });

		expect(result.name).toBe('Some channel property');
		expect(store.findById(propertyId)?.name).toBe('Some channel property');
	});

	it('merges a partial update into an existing entry rather than replacing it wholesale', () => {
		const initial = transformChannelPropertyResponse(rawResponse(), ChannelPropertySchema);

		store.set({ id: propertyId, data: initial });

		// A caller supplying only a subset of fields — the merge branch must fill the rest from what
		// is already stored, not fail or drop them.
		const partialUpdate = {
			type: 'some-property',
			name: 'Renamed property',
		} as unknown as IChannelsPropertiesSetActionPayload['data'];

		const result = store.set({ id: propertyId, data: partialUpdate });

		expect(result.name).toBe('Renamed property');
		expect(result.identifier).toBe(initial.identifier);
		expect(result.permissions).toEqual(initial.permissions);
		expect(result.channel).toBe(initial.channel);
	});

	it('produces the same entry via onEvent as via set() with equivalently transformed data', () => {
		const dataFromTransform = transformChannelPropertyResponse(rawResponse(), ChannelPropertySchema);

		const viaSet = store.set({ id: propertyId, data: dataFromTransform });

		const otherId = uuid();
		const rawForEvent = rawResponse({ id: otherId });

		const eventPayload: IChannelsPropertiesOnEventActionPayload = {
			id: otherId,
			type: rawForEvent.type,
			data: rawForEvent,
		};

		const viaEvent = store.onEvent(eventPayload);

		expect(viaEvent).toEqual({ ...viaSet, id: otherId });
	});

	it('throws a validation exception for an invalid payload', () => {
		expect(() =>
			store.set({
				id: uuid(),
				data: { type: 'some-property' } as unknown as IChannelsPropertiesSetActionPayload['data'],
			})
		).toThrow(DevicesValidationException);
	});
});

const response = (data: unknown) => ({ data: { data }, response: { status: 200 } });
const deferred = () => {
	let resolve!: (value: ReturnType<typeof response>) => void;
	const promise = new Promise<ReturnType<typeof response>>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('Channel property PATCH requests and snapshots', () => {
	let store: ReturnType<typeof useChannelsProperties>;
	beforeEach(() => {
		vi.clearAllMocks();
		getPluginElement.mockReturnValue(undefined);
		setActivePinia(createPinia());
		store = useChannelsProperties();
		store.set({ id: propertyId, data: transformChannelPropertyResponse(rawResponse(), ChannelPropertySchema) });
	});

	it('sends only caller metadata, preserving the cached value during optimistic edits', async () => {
		const pending = deferred();
		backendClient.PATCH.mockReturnValue(pending.promise);
		const edited = store.edit({ id: propertyId, channelId, data: { type: 'some-property', name: 'Renamed', step: '' as unknown as number } });
		expect(backendClient.PATCH.mock.calls[0]?.[1].body.data).toEqual({ type: 'some-property', name: 'Renamed' });
		expect(store.findById(propertyId)?.value?.value).toBe('Some value');
		pending.resolve(response(rawResponse({ name: 'Renamed' })));
		await edited;
	});

	it('keeps explicit constraint nulls and the adopted data type on the wire', async () => {
		backendClient.PATCH.mockResolvedValue(response(rawResponse()));
		await store.edit({
			id: propertyId,
			channelId,
			data: {
				type: 'some-property',
				dataType: DevicesModuleChannelPropertyDataType.float,
				format: null,
				step: null,
				invalid: null,
				identifier: undefined,
			},
		});
		expect(backendClient.PATCH.mock.calls[0]?.[1].body.data).toEqual({
			type: 'some-property',
			data_type: DevicesModuleChannelPropertyDataType.float,
			format: null,
			step: null,
			invalid: null,
		});
	});

	it.each([false, 0, 'command', null])('preserves an explicit value command %s', async (value) => {
		backendClient.PATCH.mockResolvedValue(response(rawResponse()));
		await store.edit({ id: propertyId, channelId, data: { type: 'some-property', value, step: null } });
		expect(backendClient.PATCH.mock.calls[0]?.[1].body.data).toEqual({ type: 'some-property', value, step: null });
	});

	it('still rejects an edit without the required step field', async () => {
		await expect(
			store.edit({ id: propertyId, channelId, data: { type: 'some-property', name: 'Renamed' } } as Parameters<typeof store.edit>[0])
		).rejects.toThrow(DevicesValidationException);
		expect(backendClient.PATCH).not.toHaveBeenCalled();
	});

	it('merges a draft edit then sends complete state through the create path', async () => {
		store.set({
			id: propertyId,
			data: { ...transformChannelPropertyResponse(rawResponse(), ChannelPropertySchema), draft: true } as Parameters<typeof store.set>[0]['data'],
		});
		await store.edit({ id: propertyId, channelId, data: { type: 'some-property', name: 'Draft title', step: null } });
		expect(backendClient.PATCH).not.toHaveBeenCalled();
		expect(store.findById(propertyId)?.format).toBeNull();
		backendClient.POST.mockResolvedValue(response(rawResponse({ name: 'Draft title' })));
		await store.save({ id: propertyId, channelId });
		expect(backendClient.POST.mock.calls[0]?.[1].body.data).toMatchObject({ name: 'Draft title', data_type: 'string', value: 'Some value' });
	});

	it('preserves a websocket value and metadata update while a snapshot is in flight', async () => {
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const fetched = store.fetch({ channelId });
		store.onEvent({ id: propertyId, type: 'some-property', data: rawResponse({ name: 'Socket title', value: { value: 'New value' } }) });
		pending.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(propertyId)).toMatchObject({ name: 'Socket title', value: { value: 'New value' } });
	});

	it('keeps quality-only events and unavailable clearing ahead of older REST snapshots', async () => {
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const fetched = store.fetch({ channelId });
		const snapshot = (quality: string, revision: number, value: string | null) =>
			rawResponse({
				value: {
					value,
					last_updated: null,
					producer: {
						quality,
						reasons: quality === 'good' ? [] : ['source_stale'],
						sampled_at: null,
						evaluated_at: '2026-10-13T10:00:00Z',
						expires_at: null,
						revision,
					},
				},
			} as unknown as Partial<IChannelPropertyRes>);
		store.onEvent({ id: propertyId, type: 'some-property', data: snapshot('degraded', 2, 'Some value') });
		expect(store.findById(propertyId)?.value?.producer?.quality).toBe('degraded');
		store.onEvent({ id: propertyId, type: 'some-property', data: snapshot('unavailable', 3, null) });
		pending.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(propertyId)?.value?.value).toBeNull();
		expect(store.findById(propertyId)?.value?.producer).toMatchObject({ quality: 'unavailable', revision: 3 });
	});

	it.each(['row', 'scope'])('keeps a %s deletion while its snapshot is in flight', async (kind) => {
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const fetched = store.fetch({ channelId });
		store.unset(kind === 'row' ? { id: propertyId } : { channelId });
		pending.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(propertyId)).toBeNull();
	});

	it('keeps optimistic edits while a snapshot is in flight', async () => {
		const snapshot = deferred();
		const update = deferred();
		backendClient.GET.mockReturnValue(snapshot.promise);
		backendClient.PATCH.mockReturnValue(update.promise);
		const fetched = store.fetch({ channelId });
		const edited = store.edit({ id: propertyId, channelId, data: { type: 'some-property', name: 'Optimistic', step: null } });
		snapshot.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(propertyId)?.name).toBe('Optimistic');
		update.resolve(response(rawResponse({ name: 'Optimistic' })));
		await edited;
	});

	it('does not let an older list response overwrite a newer individual read', async () => {
		const older = deferred();
		const newer = deferred();
		backendClient.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const fetched = store.fetch({ channelId });
		const read = store.get({ id: propertyId, channelId });
		newer.resolve(response(rawResponse({ name: 'New read' })));
		await read;
		older.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(propertyId)?.name).toBe('New read');
	});
});

describe('Plugin channel property PATCH transformations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setActivePinia(createPinia());
	});

	it('passes virtual remap fields without replaying cached origin, value or unrelated metadata', async () => {
		getPluginElement.mockReturnValue({
			schemas: {
				channelPropertySchema: VirtualChannelPropertySchema,
				channelPropertyUpdateReqSchema: VirtualChannelPropertyUpdateReqSchema,
			},
		});
		const store = useChannelsProperties();
		const sourceProperty = uuid();
		const initial = { ...rawResponse({ type: DEVICES_VIRTUAL_TYPE }), value_origin: DevicesVirtualPluginValueOrigin.source, source_property: uuid() };
		store.set({ id: propertyId, data: transformChannelPropertyResponse(initial, VirtualChannelPropertySchema) });
		backendClient.PATCH.mockResolvedValue(response(initial));
		await store.edit({
			id: propertyId,
			channelId,
			data: {
				type: DEVICES_VIRTUAL_TYPE,
				sourceProperty,
				dataType: DevicesModuleChannelPropertyDataType.float,
				format: null,
				step: null,
				invalid: null,
			},
		} as Parameters<typeof store.edit>[0]);
		expect(backendClient.PATCH.mock.calls[0]?.[1].body.data).toEqual({
			type: DEVICES_VIRTUAL_TYPE,
			source_property: sourceProperty,
			data_type: DevicesModuleChannelPropertyDataType.float,
			format: null,
			step: null,
			invalid: null,
		});
	});

	it('omits absent Home Assistant fields and transforms explicitly supplied sentinels to null', async () => {
		getPluginElement.mockReturnValue({
			schemas: {
				channelPropertySchema: HomeAssistantChannelPropertySchema,
				channelPropertyUpdateReqSchema: HomeAssistantChannelPropertyUpdateReqSchema,
			},
		});
		const store = useChannelsProperties();
		const initial = {
			...rawResponse({ type: DEVICES_HOME_ASSISTANT_TYPE }),
			ha_entity_id: 'light.room',
			ha_attribute: 'brightness',
			ha_transformer: 'old',
		};
		store.set({ id: propertyId, data: transformChannelPropertyResponse(initial, HomeAssistantChannelPropertySchema) });
		backendClient.PATCH.mockResolvedValue(response(initial));
		await store.edit({ id: propertyId, channelId, data: { type: DEVICES_HOME_ASSISTANT_TYPE, name: 'Renamed', step: null } });
		expect(backendClient.PATCH.mock.calls[0]?.[1].body.data).toEqual({ type: DEVICES_HOME_ASSISTANT_TYPE, name: 'Renamed', step: null });
		await store.edit({
			id: propertyId,
			channelId,
			data: {
				type: DEVICES_HOME_ASSISTANT_TYPE,
				haEntityId: DEVICE_NO_ENTITY,
				haAttribute: ENTITY_NO_ATTRIBUTE,
				haTransformer: null,
				step: null,
			},
		} as Parameters<typeof store.edit>[0]);
		expect(backendClient.PATCH.mock.calls[1]?.[1].body.data).toEqual({
			type: DEVICES_HOME_ASSISTANT_TYPE,
			ha_entity_id: null,
			ha_attribute: null,
			ha_transformer: null,
			step: null,
		});
	});
});

describe('property mutation confirmations and recovery', () => {
	let store: ReturnType<typeof useChannelsProperties>;
	beforeEach(() => {
		vi.clearAllMocks();
		getPluginElement.mockReturnValue(undefined);
		setActivePinia(createPinia());
		store = useChannelsProperties();
		store.set({ id: propertyId, data: transformChannelPropertyResponse(rawResponse(), ChannelPropertySchema) });
	});
	it.each(['socket', 'deletion'])('keeps a newer %s after a PATCH confirmation', async (kind) => {
		const pending = deferred();
		backendClient.PATCH.mockReturnValue(pending.promise);
		const edited = store.edit({ id: propertyId, channelId, data: { type: 'some-property', name: 'Optimistic', step: null } });
		if (kind === 'socket')
			store.onEvent({ id: propertyId, type: 'some-property', data: rawResponse({ name: 'Newest socket', value: { value: 'new' } }) });
		else store.unset({ id: propertyId });
		pending.resolve(response(rawResponse({ name: 'Old confirmation' })));
		await edited;
		expect(store.findById(propertyId)?.name ?? null).toBe(kind === 'socket' ? 'Newest socket' : null);
		if (kind === 'socket') expect(store.findById(propertyId)?.value?.value).toBe('new');
	});
	it('does not fetch rollback state over a newer socket update', async () => {
		const pending = deferred();
		backendClient.PATCH.mockReturnValue(pending.promise);
		const edited = store.edit({ id: propertyId, channelId, data: { type: 'some-property', name: 'Optimistic', step: null } });
		const rejected = expect(edited).rejects.toThrow();
		store.onEvent({ id: propertyId, type: 'some-property', data: rawResponse({ name: 'Newest socket' }) });
		pending.resolve({ data: undefined, error: {}, response: { status: 400 } } as unknown as ReturnType<typeof response>);
		await rejected;
		expect(backendClient.GET).not.toHaveBeenCalled();
		expect(store.findById(propertyId)?.name).toBe('Newest socket');
	});
	it('drains an older pending GET and fetches fresh rollback state', async () => {
		const older = deferred();
		backendClient.GET.mockReturnValueOnce(older.promise).mockResolvedValueOnce(response(rawResponse({ name: 'Fresh recovery' })));
		const originalRead = store.get({ id: propertyId, channelId });
		backendClient.PATCH.mockResolvedValue({ data: undefined, error: {}, response: { status: 400 } });
		const edited = store.edit({ id: propertyId, channelId, data: { type: 'some-property', name: 'Optimistic', step: null } });
		const rejected = expect(edited).rejects.toThrow();
		older.resolve(response(rawResponse()));
		await originalRead;
		await rejected;
		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect(store.findById(propertyId)?.name).toBe('Fresh recovery');
	});
});

describe('property create/save response revisions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getPluginElement.mockReturnValue(undefined);
		setActivePinia(createPinia());
	});
	it.each(['add', 'save'])('keeps a newer socket row when an older %s response lands', async (action) => {
		const store = useChannelsProperties();
		const pending = deferred();
		backendClient.POST.mockReturnValue(pending.promise);
		if (action === 'save')
			store.set({
				id: propertyId,
				data: { ...transformChannelPropertyResponse(rawResponse(), ChannelPropertySchema), draft: true } as Parameters<typeof store.set>[0]['data'],
			});
		const write =
			action === 'save'
				? store.save({ id: propertyId, channelId })
				: store.add({
						id: propertyId,
						channelId,
						draft: false,
						data: {
							type: 'some-property',
							name: 'Created',
							category: DevicesModuleChannelPropertyCategory.generic,
							permissions: [DevicesModuleChannelPropertyPermissions.ro],
							dataType: DevicesModuleChannelPropertyDataType.string,
							format: null,
							invalid: null,
							step: null,
							value: 'old',
						},
					});
		store.onEvent({ id: propertyId, type: 'some-property', data: rawResponse({ name: 'Newest socket' }) });
		pending.resolve(response(rawResponse({ name: 'Old confirmation' })));
		await write;
		expect(store.findById(propertyId)?.name).toBe('Newest socket');
	});
});
