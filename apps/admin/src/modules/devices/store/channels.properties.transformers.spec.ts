import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi.constants';
import { DevicesValidationException } from '../devices.exceptions';

import { ChannelPropertyCreateReqSchema, ChannelPropertySchema, ChannelPropertyUpdateReqSchema } from './channels.properties.store.schemas';
import type {
	IChannelPropertyRes,
	IChannelsPropertiesAddActionPayload,
	IChannelsPropertiesEditActionPayload,
} from './channels.properties.store.types';
import {
	transformChannelPropertyCreateRequest,
	transformChannelPropertyResponse,
	transformChannelPropertyUpdateRequest,
} from './channels.properties.transformers';
import type { IChannel } from './channels.store.types';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const channelId = uuid();
const channelPropertyId = uuid();

const validChannelResponse: IChannelPropertyRes = {
	id: channelPropertyId.toString(),
	type: 'some-property',
	channel: channelId.toString(),
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
	updated_at: '2024-03-02T12:00:00Z',
};

const validChannelCreatePayload: IChannelsPropertiesAddActionPayload['data'] & { channel: IChannel['id'] } = {
	type: 'some-property',
	channel: channelId.toString(),
	category: DevicesModuleChannelPropertyCategory.generic,
	identifier: null,
	name: 'Channel property name',
	permissions: [DevicesModuleChannelPropertyPermissions.ro],
	dataType: DevicesModuleChannelPropertyDataType.string,
	format: null,
	invalid: -1,
	step: null,
	value: 'Some value',
};

const validChannelUpdatePayload: IChannelsPropertiesEditActionPayload['data'] = {
	type: 'some-property',
	name: 'Channel property title',
	step: null,
};

describe('Channels Transformers', (): void => {
	describe('transformChannelPropertyResponse', (): void => {
		it('should transform a valid channel property response', (): void => {
			const result = transformChannelPropertyResponse(validChannelResponse, ChannelPropertySchema);

			expect(result).toEqual({
				id: channelPropertyId.toString(),
				channel: channelId.toString(),
				type: 'some-property',
				category: DevicesModuleChannelPropertyCategory.generic,
				identifier: null,
				name: 'Some channel property',
				permissions: [DevicesModuleChannelPropertyPermissions.ro],
				dataType: DevicesModuleChannelPropertyDataType.string,
				unit: null,
				format: null,
				invalid: -1,
				step: null,
				value: { value: 'Some value', lastUpdated: null, trend: null },
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid channel property response', (): void => {
			expect(() =>
				transformChannelPropertyResponse({ ...validChannelResponse, id: null } as unknown as IChannelPropertyRes, ChannelPropertySchema)
			).toThrow(DevicesValidationException);
		});
	});

	describe('transformChannelPropertyCreateRequest', (): void => {
		it('should transform a valid channel property create request', (): void => {
			const result = transformChannelPropertyCreateRequest(validChannelCreatePayload, ChannelPropertyCreateReqSchema);

			expect(result).toEqual({
				type: 'some-property',
				category: DevicesModuleChannelPropertyCategory.generic,
				identifier: null,
				name: 'Channel property name',
				permissions: [DevicesModuleChannelPropertyPermissions.ro],
				data_type: DevicesModuleChannelPropertyDataType.string,
				format: null,
				invalid: -1,
				step: null,
				value: 'Some value',
			});
		});

		it('should throw an error for an invalid channel property create request', (): void => {
			expect(() =>
				transformChannelPropertyCreateRequest(
					{ ...validChannelCreatePayload, type: undefined } as unknown as IChannelsPropertiesAddActionPayload['data'],
					ChannelPropertyCreateReqSchema
				)
			).toThrow(DevicesValidationException);
		});
	});

	describe('transformChannelPropertyUpdateRequest', (): void => {
		it('should transform a valid channel property update request', (): void => {
			const result = transformChannelPropertyUpdateRequest(validChannelUpdatePayload, ChannelPropertyUpdateReqSchema);

			expect(result).toEqual({
				type: 'some-property',
				name: 'Channel property title',
				step: null,
			});
		});

		it('should throw an error for an invalid channel property update request', (): void => {
			expect(() =>
				transformChannelPropertyUpdateRequest(
					{
						...validChannelUpdatePayload,
						type: undefined,
					} as unknown as IChannelsPropertiesEditActionPayload['data'],
					ChannelPropertyUpdateReqSchema
				)
			).toThrow(DevicesValidationException);
		});
	});
});

describe('transformChannelPropertyUpdateRequest omissions', () => {
	it('does not let schema defaults fill omitted PATCH fields', () => {
		const schema = ChannelPropertyUpdateReqSchema.and(
			z.object({
				name: z.string().nullable().default(null),
			})
		);
		expect(
			transformChannelPropertyUpdateRequest({ type: 'some-type', step: null } as Parameters<typeof transformChannelPropertyUpdateRequest>[0], schema)
		).toEqual({ type: 'some-type', step: null });
	});
});

describe('Property producer response compatibility', () => {
	it.each([false, 0, 'legacy', null])('accepts legacy scalar or null value %s', (value) => {
		const result = transformChannelPropertyResponse({ ...validChannelResponse, value } as unknown as IChannelPropertyRes, ChannelPropertySchema);
		expect(result.value?.value ?? null).toBe(value);
	});

	it.each(['good', 'degraded', 'unavailable'])('preserves %s producer metadata and ignores unknown fields', (quality) => {
		const producer = {
			quality,
			reasons: quality === 'good' ? [] : ['source_stale'],
			sampled_at: null,
			evaluated_at: '2026-10-13T10:00:00Z',
			expires_at: null,
			revision: 4,
			future_field: true,
		};
		const result = transformChannelPropertyResponse(
			{
				...validChannelResponse,
				value: { value: quality === 'unavailable' ? null : 21, last_updated: null, producer },
			} as unknown as IChannelPropertyRes,
			ChannelPropertySchema
		);
		expect(result.value).toEqual({
			value: quality === 'unavailable' ? null : 21,
			lastUpdated: null,
			trend: null,
			producer: { quality, reasons: producer.reasons, sampledAt: null, evaluatedAt: producer.evaluated_at, expiresAt: null, revision: 4 },
		});
	});
});
