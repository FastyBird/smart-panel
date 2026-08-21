import { createPinia, setActivePinia } from 'pinia';

import { v4 as uuid } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi.constants';
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

// The plugin registry always answers "no element for this type" — this spec exercises the default
// `ChannelPropertySchema` path, per the task brief.
vi.mock('../composables/useChannelsPropertiesPlugins', () => ({
	useChannelsPropertiesPlugins: () => ({
		getElement: () => undefined,
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
