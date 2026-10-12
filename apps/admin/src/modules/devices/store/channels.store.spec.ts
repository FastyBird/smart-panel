import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi.constants';

import { useChannelsControls } from './channels.controls.store';
import { useChannelsProperties } from './channels.properties.store';
import { useChannels } from './channels.store';
import { ChannelSchema } from './channels.store.schemas';
import type { IChannelRes } from './channels.store.types';
import { transformChannelResponse } from './channels.transformers';
import { channelsControlsStoreKey, channelsPropertiesStoreKey } from './keys';

const backendClient = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };
const relationStore = { firstLoad: [] as string[], set: vi.fn(), unset: vi.fn(), captureReadSnapshot: () => relationStore.set };
const childStores = new Map<symbol, unknown>();

vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client: backendClient }),
	useLogger: () => ({ error: vi.fn() }),
	injectStoresManager: () => ({ getStore: (key: symbol) => childStores.get(key) ?? relationStore }),
}));
vi.mock('../composables/useChannelsPlugins', () => ({ useChannelsPlugins: () => ({ getElement: () => undefined }) }));
vi.mock('../composables/useChannelsPropertiesPlugins', () => ({ useChannelsPropertiesPlugins: () => ({ getElement: () => undefined }) }));

const deviceId = uuid();
const channelId = uuid();
const rawResponse = (overrides: Partial<IChannelRes> = {}): IChannelRes => ({
	id: channelId,
	device: deviceId,
	type: 'some-channel',
	category: DevicesModuleChannelCategory.generic,
	identifier: 'stale-identifier',
	name: 'Channel',
	description: 'Cached description',
	parent: null,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: null,
	controls: [],
	properties: [],
	...overrides,
});
const response = (data: unknown) => ({ data: { data }, response: { status: 200 } });
const deferred = () => {
	let resolve!: (value: ReturnType<typeof response>) => void;
	const promise = new Promise<ReturnType<typeof response>>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('Channels Store snapshots and PATCH requests', () => {
	let store: ReturnType<typeof useChannels>;
	beforeEach(() => {
		vi.clearAllMocks();
		childStores.clear();
		setActivePinia(createPinia());
		store = useChannels();
		store.set({ id: channelId, data: transformChannelResponse(rawResponse(), ChannelSchema) });
	});

	it.each([undefined, deviceId])('sends only the supplied fields for device scope %s', async (scope) => {
		backendClient.PATCH.mockResolvedValue(response(rawResponse({ name: 'Renamed' })));
		await store.edit({ id: channelId, deviceId: scope, data: { type: 'some-channel', name: 'Renamed' } });
		expect(backendClient.PATCH.mock.calls[0]?.[1].body.data).toEqual({ type: 'some-channel', name: 'Renamed' });
	});

	it('preserves explicit null while omitting undefined metadata', async () => {
		backendClient.PATCH.mockResolvedValue(response(rawResponse({ description: null })));
		await store.edit({ id: channelId, data: { type: 'some-channel', description: null, identifier: undefined } });
		expect(backendClient.PATCH.mock.calls[0]?.[1].body.data).toEqual({ type: 'some-channel', description: null });
	});

	it('merges edits into drafts and saves a complete create request', async () => {
		store.set({
			id: channelId,
			data: { ...transformChannelResponse(rawResponse(), ChannelSchema), draft: true } as Parameters<typeof store.set>[0]['data'],
		});
		await store.edit({ id: channelId, data: { type: 'some-channel', name: 'Draft title' } });
		expect(backendClient.PATCH).not.toHaveBeenCalled();
		expect(store.findById(channelId)?.description).toBe('Cached description');
		backendClient.POST.mockResolvedValue(response(rawResponse({ name: 'Draft title' })));
		await store.save({ id: channelId, deviceId });
		expect(backendClient.POST.mock.calls[0]?.[1].body.data).toMatchObject({ name: 'Draft title', identifier: 'stale-identifier' });
	});

	it('keeps socket updates and skips relation hydration for their stale snapshots', async () => {
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const fetched = store.fetch({ deviceId });
		store.onEvent({ id: channelId, type: 'some-channel', data: rawResponse({ name: 'Socket title' }) });
		pending.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(channelId)?.name).toBe('Socket title');
		expect(relationStore.set).not.toHaveBeenCalled();
	});

	it.each(['row', 'scope'])('does not restore a %s deletion made during fetch', async (kind) => {
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const fetched = store.fetch({ deviceId });
		store.unset(kind === 'row' ? { id: channelId } : { deviceId });
		pending.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(channelId)).toBeNull();
	});

	it('keeps optimistic edits made during fetch', async () => {
		const snapshot = deferred();
		const update = deferred();
		backendClient.GET.mockReturnValue(snapshot.promise);
		backendClient.PATCH.mockReturnValue(update.promise);
		const fetched = store.fetch({ deviceId });
		const edited = store.edit({ id: channelId, data: { type: 'some-channel', name: 'Optimistic' } });
		snapshot.resolve(response([rawResponse()]));
		await fetched;
		expect(store.findById(channelId)?.name).toBe('Optimistic');
		update.resolve(response(rawResponse({ name: 'Optimistic' })));
		await edited;
	});

	it('does not let an older overlapping fetch regress a newer scoped response', async () => {
		const older = deferred();
		const newer = deferred();
		backendClient.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const all = store.fetch();
		const scoped = store.fetch({ deviceId });
		newer.resolve(response([rawResponse({ name: 'New snapshot' })]));
		await scoped;
		older.resolve(response([rawResponse()]));
		await all;
		expect(store.findById(channelId)?.name).toBe('New snapshot');
	});

	it('fences individual reads against newer list responses', async () => {
		const older = deferred();
		const newer = deferred();
		backendClient.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const read = store.get({ id: channelId });
		const fetched = store.fetch({ deviceId });
		newer.resolve(response([rawResponse({ name: 'New list' })]));
		await fetched;
		older.resolve(response(rawResponse()));
		await read;
		expect(store.findById(channelId)?.name).toBe('New list');
	});
});

describe('channel parent snapshots share child read fences', () => {
	let store: ReturnType<typeof useChannels>;
	let properties: ReturnType<typeof useChannelsProperties>;
	let controls: ReturnType<typeof useChannelsControls>;
	const propertyId = uuid();
	const controlId = uuid();
	const rawProperty = {
		id: propertyId,
		channel: channelId,
		type: 'some-property',
		category: DevicesModuleChannelPropertyCategory.generic,
		identifier: null,
		name: 'Old property',
		permissions: [DevicesModuleChannelPropertyPermissions.ro],
		data_type: DevicesModuleChannelPropertyDataType.string,
		format: null,
		invalid: null,
		step: null,
		value: { value: 'old' },
		created_at: '2024-03-01T12:00:00Z',
		updated_at: null,
	};
	const rawControl = { id: controlId, channel: channelId, name: 'Old control', created_at: '2024-03-01T12:00:00Z', updated_at: null };
	const channel = () => rawResponse({ properties: [rawProperty], controls: [rawControl] });
	beforeEach(() => {
		vi.clearAllMocks();
		setActivePinia(createPinia());
		properties = useChannelsProperties();
		controls = useChannelsControls();
		childStores.set(channelsPropertiesStoreKey, properties);
		childStores.set(channelsControlsStoreKey, controls);
		store = useChannels();
	});

	it.each(['get', 'fetch'])('preserves child socket rows while the parent %s applies its unchanged channel', async (action) => {
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const read = action === 'get' ? store.get({ id: channelId }) : store.fetch({ deviceId });
		properties.onEvent({ id: propertyId, type: 'some-property', data: { ...rawProperty, name: 'Socket property', value: { value: 'new' } } });
		controls.onEvent({ id: controlId, data: { ...rawControl, name: 'Socket control' } });
		pending.resolve(response(action === 'get' ? channel() : [channel()]));
		await read;
		expect(store.findById(channelId)).not.toBeNull();
		expect(properties.findById(propertyId)).toMatchObject({ name: 'Socket property', value: { value: 'new' } });
		expect(controls.findById(controlId)?.name).toBe('Socket control');
	});

	it.each(['get', 'fetch'])('does not restore child rows deleted during a parent %s', async (action) => {
		properties.onEvent({ id: propertyId, type: 'some-property', data: rawProperty });
		controls.onEvent({ id: controlId, data: rawControl });
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const read = action === 'get' ? store.get({ id: channelId }) : store.fetch({ deviceId });
		properties.unset({ id: propertyId });
		controls.unset({ id: controlId });
		pending.resolve(response(action === 'get' ? channel() : [channel()]));
		await read;
		expect(properties.findById(propertyId)).toBeNull();
		expect(controls.findById(controlId)).toBeNull();
	});

	it('preserves whole-child-scope deletion even for rows that had not been cached', async () => {
		const pending = deferred();
		backendClient.GET.mockReturnValue(pending.promise);
		const read = store.fetch({ deviceId });
		properties.unset({ channelId });
		controls.unset({ channelId });
		pending.resolve(response([channel()]));
		await read;
		expect(properties.findById(propertyId)).toBeNull();
		expect(controls.findById(controlId)).toBeNull();
	});

	it.each(['property', 'control'])('does not overwrite a newer direct %s read from an older parent snapshot', async (kind) => {
		const older = deferred();
		const newer = deferred();
		backendClient.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const parentRead = store.fetch({ deviceId });
		const child = kind === 'property' ? properties : controls;
		const id = kind === 'property' ? propertyId : controlId;
		const raw = kind === 'property' ? rawProperty : rawControl;
		const childRead = child.get({ id, channelId });
		newer.resolve(response({ ...raw, name: 'New direct read' }));
		await childRead;
		older.resolve(response([channel()]));
		await parentRead;
		expect(child.findById(id)?.name).toBe('New direct read');
	});

	it.each(['property', 'control'])('does not let an old direct %s list regress a newer embedded snapshot', async (kind) => {
		const older = deferred();
		const newer = deferred();
		backendClient.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const child = kind === 'property' ? properties : controls;
		const id = kind === 'property' ? propertyId : controlId;
		const raw = kind === 'property' ? rawProperty : rawControl;
		const childRead = child.fetch({ channelId });
		const parentRead = store.fetch({ deviceId });
		newer.resolve(
			response([rawResponse({ properties: [{ ...rawProperty, name: 'New snapshot' }], controls: [{ ...rawControl, name: 'New snapshot' }] })])
		);
		await parentRead;
		older.resolve(response([raw]));
		await childRead;
		expect(child.findById(id)?.name).toBe('New snapshot');
	});
});

describe('channel mutation confirmation and recovery', () => {
	let store: ReturnType<typeof useChannels>;
	beforeEach(() => {
		vi.clearAllMocks();
		childStores.clear();
		setActivePinia(createPinia());
		store = useChannels();
		store.set({ id: channelId, data: transformChannelResponse(rawResponse(), ChannelSchema) });
	});
	it.each(['socket', 'deletion'])('keeps a newer %s after a PATCH confirmation', async (kind) => {
		const pending = deferred();
		backendClient.PATCH.mockReturnValue(pending.promise);
		const edited = store.edit({ id: channelId, data: { type: 'some-channel', name: 'Optimistic' } });
		if (kind === 'socket') store.onEvent({ id: channelId, type: 'some-channel', data: rawResponse({ name: 'Newest socket' }) });
		else store.unset({ id: channelId });
		pending.resolve(response(rawResponse({ name: 'Old confirmation' })));
		await edited;
		expect(store.findById(channelId)?.name ?? null).toBe(kind === 'socket' ? 'Newest socket' : null);
	});

	it('does not fetch rollback state over a newer socket update', async () => {
		const pending = deferred();
		backendClient.PATCH.mockReturnValue(pending.promise);
		const edited = store.edit({ id: channelId, data: { type: 'some-channel', name: 'Optimistic' } });
		const rejected = expect(edited).rejects.toThrow();
		store.onEvent({ id: channelId, type: 'some-channel', data: rawResponse({ name: 'Newest socket' }) });
		pending.resolve({ data: undefined, error: {}, response: { status: 400 } } as unknown as ReturnType<typeof response>);
		await rejected;
		expect(backendClient.GET).not.toHaveBeenCalled();
		expect(store.findById(channelId)?.name).toBe('Newest socket');
	});

	it('drains an older pending GET and fetches fresh rollback state', async () => {
		const older = deferred();
		backendClient.GET.mockReturnValueOnce(older.promise).mockResolvedValueOnce(response(rawResponse({ name: 'Fresh recovery' })));
		const originalRead = store.get({ id: channelId });
		backendClient.PATCH.mockResolvedValue({ data: undefined, error: {}, response: { status: 400 } });
		const edited = store.edit({ id: channelId, data: { type: 'some-channel', name: 'Optimistic' } });
		const rejected = expect(edited).rejects.toThrow();
		older.resolve(response(rawResponse({ name: 'Old pending read' })));
		await originalRead;
		await rejected;
		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect(store.findById(channelId)?.name).toBe('Fresh recovery');
	});
});

describe('channel create/save response revisions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		childStores.clear();
		setActivePinia(createPinia());
	});
	it.each(['add', 'save'])('keeps a newer socket row when an older %s response lands', async (action) => {
		const store = useChannels();
		const pending = deferred();
		backendClient.POST.mockReturnValue(pending.promise);
		if (action === 'save')
			store.set({
				id: channelId,
				data: { ...transformChannelResponse(rawResponse(), ChannelSchema), draft: true } as Parameters<typeof store.set>[0]['data'],
			});
		const write =
			action === 'save'
				? store.save({ id: channelId, deviceId })
				: store.add({
						id: channelId,
						deviceId,
						draft: false,
						data: { type: 'some-channel', name: 'Created', category: DevicesModuleChannelCategory.generic },
					});
		store.onEvent({ id: channelId, type: 'some-channel', data: rawResponse({ name: 'Newest socket' }) });
		pending.resolve(response(rawResponse({ name: 'Old confirmation' })));
		await write;
		expect(store.findById(channelId)?.name).toBe('Newest socket');
	});
});
