import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
	DevicesModuleDeviceConnectionStatus,
	DevicesModuleDeviceHiddenBy,
} from '../../../openapi.constants';

import { useChannelsControls } from './channels.controls.store';
import { useChannelsProperties } from './channels.properties.store';
import { useChannels } from './channels.store';
import type { IChannelRes } from './channels.store.types';
import { useDevicesControls } from './devices.controls.store';
import { useDevices } from './devices.store';
import { DeviceSchema } from './devices.store.schemas';
import type { IDeviceRes } from './devices.store.types';
import { transformDeviceResponse } from './devices.transformers';
import { channelsControlsStoreKey, channelsPropertiesStoreKey, channelsStoreKey, devicesControlsStoreKey } from './keys';

const client = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };
const stores = new Map<symbol, unknown>();
vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client }),
	useLogger: () => ({ error: vi.fn() }),
	injectStoresManager: () => ({ getStore: (key: symbol) => stores.get(key) }),
}));
vi.mock('../composables/useDevicesPlugins', () => ({ useDevicesPlugins: () => ({ getElement: () => undefined }) }));
vi.mock('../composables/useChannelsPlugins', () => ({ useChannelsPlugins: () => ({ getElement: () => undefined }) }));
vi.mock('../composables/useChannelsPropertiesPlugins', () => ({ useChannelsPropertiesPlugins: () => ({ getElement: () => undefined }) }));

const deviceId = uuid();
const channelId = uuid();
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
const rawDeviceControl = { id: uuid(), device: deviceId, name: 'Old device control', created_at: '2024-03-01T12:00:00Z', updated_at: null };
const rawControl = { id: controlId, channel: channelId, name: 'Old control', created_at: '2024-03-01T12:00:00Z', updated_at: null };
const rawChannel: IChannelRes = {
	id: channelId,
	device: deviceId,
	type: 'some-channel',
	category: DevicesModuleChannelCategory.generic,
	identifier: null,
	name: 'Channel',
	description: null,
	parent: null,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: null,
	controls: [rawControl],
	properties: [rawProperty],
};
const rawDevice = (overrides: Partial<IDeviceRes> = {}): IDeviceRes =>
	({
		id: deviceId,
		type: 'some-device',
		category: DevicesModuleDeviceCategory.generic,
		identifier: null,
		name: 'Device',
		description: null,
		enabled: true,
		hidden: false,
		hidden_by: null,
		room_id: null,
		zone_ids: [],
		status: { online: false, status: DevicesModuleDeviceConnectionStatus.unknown, last_changed: null },
		created_at: '2024-03-01T12:00:00Z',
		updated_at: null,
		controls: [rawDeviceControl],
		channels: [rawChannel],
		...overrides,
	}) as IDeviceRes;
const response = (data: unknown) => ({ data: { data }, response: { status: 200 } });
const deferred = () => {
	let resolve!: (value: ReturnType<typeof response>) => void;
	const promise = new Promise<ReturnType<typeof response>>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('device snapshots hydrate real child stores safely', () => {
	let devices: ReturnType<typeof useDevices>;
	let channels: ReturnType<typeof useChannels>;
	let properties: ReturnType<typeof useChannelsProperties>;
	let controls: ReturnType<typeof useChannelsControls>;
	let deviceControls: ReturnType<typeof useDevicesControls>;
	beforeEach(() => {
		vi.clearAllMocks();
		stores.clear();
		setActivePinia(createPinia());
		properties = useChannelsProperties();
		controls = useChannelsControls();
		stores.set(channelsPropertiesStoreKey, properties);
		stores.set(channelsControlsStoreKey, controls);
		channels = useChannels();
		stores.set(channelsStoreKey, channels);
		deviceControls = useDevicesControls();
		stores.set(devicesControlsStoreKey, deviceControls);
		devices = useDevices();
	});
	const start = (action: string) => (action === 'get' ? devices.get({ id: deviceId }) : devices.fetch());
	const answer = (action: string) => response(action === 'fetch' ? [rawDevice()] : rawDevice());

	it.each(['get', 'fetch'])('preserves property-only and control-only socket events while device %s applies', async (action) => {
		const pending = deferred();
		client.GET.mockReturnValue(pending.promise);
		const read = start(action);
		properties.onEvent({ id: propertyId, type: 'some-property', data: { ...rawProperty, name: 'Newest property', value: { value: 'new' } } });
		controls.onEvent({ id: controlId, data: { ...rawControl, name: 'Newest control' } });
		pending.resolve(answer(action));
		await read;
		expect(devices.findById(deviceId)).not.toBeNull();
		expect(channels.findById(channelId)).not.toBeNull();
		expect(properties.findById(propertyId)).toMatchObject({ name: 'Newest property', value: { value: 'new' } });
		expect(controls.findById(controlId)?.name).toBe('Newest control');
	});

	it.each(['get', 'fetch'])('does not hydrate children of a channel deleted during device %s', async (action) => {
		channels.onEvent({ id: channelId, type: 'some-channel', data: rawChannel });
		const pending = deferred();
		client.GET.mockReturnValue(pending.promise);
		const read = start(action);
		channels.unset({ id: channelId });
		pending.resolve(answer(action));
		await read;
		expect(channels.findById(channelId)).toBeNull();
		expect(properties.findById(propertyId)).toBeNull();
		expect(controls.findById(controlId)).toBeNull();
	});

	it.each(['get', 'fetch'])('preserves deletion of an uncached channel scope during device %s', async (action) => {
		const pending = deferred();
		client.GET.mockReturnValue(pending.promise);
		const read = start(action);
		channels.unset({ deviceId });
		pending.resolve(answer(action));
		await read;
		expect(channels.findById(channelId)).toBeNull();
		expect(properties.findById(propertyId)).toBeNull();
		expect(controls.findById(controlId)).toBeNull();
	});

	it.each(['get', 'fetch'])('preserves deletion of uncached children during device %s', async (action) => {
		const pending = deferred();
		client.GET.mockReturnValue(pending.promise);
		const read = start(action);
		properties.unset({ channelId });
		controls.unset({ channelId });
		pending.resolve(answer(action));
		await read;
		expect(channels.findById(channelId)).not.toBeNull();
		expect(properties.findById(propertyId)).toBeNull();
		expect(controls.findById(controlId)).toBeNull();
	});

	it.each(['hidden', 'deleted'])('keeps a device %s during GET and skips its descendants', async (kind) => {
		const pending = deferred();
		client.GET.mockReturnValue(pending.promise);
		const read = devices.get({ id: deviceId });
		if (kind === 'hidden')
			devices.onEvent({ id: deviceId, type: 'some-device', data: rawDevice({ hidden: true, hidden_by: DevicesModuleDeviceHiddenBy.system }) });
		else devices.unset({ id: deviceId });
		pending.resolve(response(rawDevice()));
		await read;
		expect(devices.findById(deviceId)?.hidden ?? null).toBe(kind === 'hidden' ? true : null);
		expect(channels.findById(channelId)).toBeNull();
		expect(properties.findById(propertyId)).toBeNull();
	});

	it.each(['old-get-first', 'new-fetch-first'])('a newer fetch wins against an older GET in order %s', async (order) => {
		const older = deferred();
		const newer = deferred();
		client.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const read = devices.get({ id: deviceId });
		const list = devices.fetch();
		if (order === 'old-get-first') {
			older.resolve(response(rawDevice({ name: 'Old GET' })));
			await read;
		}
		newer.resolve(response([rawDevice({ name: 'New fetch' })]));
		await list;
		if (order === 'new-fetch-first') {
			older.resolve(response(rawDevice({ name: 'Old GET' })));
			await read;
		}
		expect(devices.findById(deviceId)?.name).toBe('New fetch');
	});

	it.each(['old-get-first', 'new-fetch-first'])('a newer empty fetch keeps an old GET evicted in order %s', async (order) => {
		const older = deferred();
		const newer = deferred();
		client.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const read = devices.get({ id: deviceId });
		const list = devices.fetch();
		if (order === 'old-get-first') {
			older.resolve(response(rawDevice()));
			await read;
		}
		newer.resolve(response([]));
		await list;
		if (order === 'new-fetch-first') {
			older.resolve(response(rawDevice()));
			await read;
		}
		expect(devices.findById(deviceId)).toBeNull();
	});

	it.each(['new-get-first', 'old-fetch-first'])('preserves a genuinely newer GET against an older empty fetch in order %s', async (order) => {
		const older = deferred();
		const newer = deferred();
		client.GET.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
		const list = devices.fetch();
		const read = devices.get({ id: deviceId });
		if (order === 'new-get-first') {
			newer.resolve(response(rawDevice({ name: 'New GET' })));
			await read;
		}
		older.resolve(response([]));
		await list;
		if (order === 'old-fetch-first') {
			newer.resolve(response(rawDevice({ name: 'New GET' })));
			await read;
		}
		expect(devices.findById(deviceId)?.name).toBe('New GET');
	});

	it.each(['add', 'save'])('captures child snapshots before a device %s request', async (action) => {
		const pending = deferred();
		client.POST.mockReturnValue(pending.promise);
		if (action === 'save')
			devices.set({
				id: deviceId,
				data: { ...transformDeviceResponse(rawDevice(), DeviceSchema), draft: true } as Parameters<typeof devices.set>[0]['data'],
			});
		const write =
			action === 'save'
				? devices.save({ id: deviceId })
				: devices.add({ id: deviceId, draft: false, data: { type: 'some-device', category: DevicesModuleDeviceCategory.generic, name: 'Created' } });
		properties.onEvent({ id: propertyId, type: 'some-property', data: { ...rawProperty, name: 'Newest property' } });
		pending.resolve(response(rawDevice()));
		await write;
		expect(properties.findById(propertyId)?.name).toBe('Newest property');
	});
	for (const action of ['get', 'fetch', 'add', 'save']) {
		it.each(['socket', 'row', 'scope'])(`device ${action} preserves a newer device-control %s mutation`, async (mutation) => {
			const pending = deferred();
			client.GET.mockReturnValue(pending.promise);
			client.POST.mockReturnValue(pending.promise);
			if (action === 'save')
				devices.set({
					id: deviceId,
					data: { ...transformDeviceResponse(rawDevice(), DeviceSchema), draft: true } as Parameters<typeof devices.set>[0]['data'],
				});
			const work =
				action === 'add'
					? devices.add({ id: deviceId, draft: false, data: { type: 'some-device', category: DevicesModuleDeviceCategory.generic, name: 'Created' } })
					: action === 'save'
						? devices.save({ id: deviceId })
						: start(action);
			if (mutation === 'socket') deviceControls.onEvent({ id: rawDeviceControl.id, data: { ...rawDeviceControl, name: 'Newest device control' } });
			else if (mutation === 'row') deviceControls.unset({ id: rawDeviceControl.id });
			else deviceControls.unset({ deviceId });
			pending.resolve(answer(action));
			await work;
			expect(deviceControls.findById(rawDeviceControl.id)?.name ?? null).toBe(mutation === 'socket' ? 'Newest device control' : null);
			expect(deviceControls.firstLoadFinished(deviceId)).toBe(true);
		});
	}

	for (const parentFirst of [true, false]) {
		for (const directKind of ['get', 'fetch']) {
			it.each(['older-first', 'newer-first'])(
				`orders parent and direct ${directKind} snapshots with parentFirst=${parentFirst}, %s`,
				async (order) => {
					const parent = deferred();
					const direct = deferred();
					client.GET.mockImplementation((path: string) => (path.includes('/controls') ? direct.promise : parent.promise));
					const parentRead = () => devices.get({ id: deviceId });
					const directRead = () =>
						directKind === 'get' ? deviceControls.get({ id: rawDeviceControl.id, deviceId }) : deviceControls.fetch({ deviceId });
					const older = parentFirst ? parentRead() : directRead();
					const newer = parentFirst ? directRead() : parentRead();
					const resolveParent = () => parent.resolve(response(rawDevice({ controls: [{ ...rawDeviceControl, name: 'Parent' }] })));
					const resolveDirect = () =>
						direct.resolve(response(directKind === 'get' ? { ...rawDeviceControl, name: 'Direct' } : [{ ...rawDeviceControl, name: 'Direct' }]));
					if (order === 'older-first') {
						(parentFirst ? resolveParent : resolveDirect)();
						await older;
					}
					(parentFirst ? resolveDirect : resolveParent)();
					await newer;
					if (order === 'newer-first') {
						(parentFirst ? resolveParent : resolveDirect)();
						await older;
					}
					expect(deviceControls.findById(rawDeviceControl.id)?.name).toBe(parentFirst ? 'Direct' : 'Parent');
				}
			);
		}
	}
});
