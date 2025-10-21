import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { DevicesModuleChannelCategory } from '../../../openapi';
import { DevicesValidationException } from '../devices.exceptions';

import { ChannelCreateReqSchema, ChannelSchema, ChannelUpdateReqSchema } from './channels.store.schemas';
import type { IChannelRes, IChannelsAddActionPayload, IChannelsEditActionPayload } from './channels.store.types';
import { transformChannelCreateRequest, transformChannelResponse, transformChannelUpdateRequest } from './channels.transformers';
import type { IDevice } from './devices.store.types';

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

const deviceId = uuid();
const channelId = uuid();

const validChannelResponse: IChannelRes = {
	id: channelId.toString(),
	type: 'some-channel',
	device: deviceId.toString(),
	category: DevicesModuleChannelCategory.generic,
	identifier: null,
	name: 'Some channel',
	description: 'With description',
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
	controls: [],
	properties: [],
};

const validChannelCreatePayload: IChannelsAddActionPayload['data'] & { device: IDevice['id'] } = {
	type: 'some-channel',
	device: deviceId.toString(),
	category: DevicesModuleChannelCategory.generic,
	name: 'Channel name',
};

const validChannelUpdatePayload: IChannelsEditActionPayload['data'] = {
	type: 'some-channel',
	name: 'Channel title',
};

describe('Channels Transformers', (): void => {
	describe('transformChannelResponse', (): void => {
		it('should transform a valid channel response', (): void => {
			const result = transformChannelResponse(validChannelResponse, ChannelSchema);

			expect(result).toEqual({
				id: channelId.toString(),
				type: 'some-channel',
				device: deviceId.toString(),
				category: DevicesModuleChannelCategory.generic,
				identifier: null,
				name: 'Some channel',
				description: 'With description',
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid channel response', (): void => {
			expect(() => transformChannelResponse({ ...validChannelResponse, id: null } as unknown as IChannelRes, ChannelSchema)).toThrow(
				DevicesValidationException
			);
		});
	});

	describe('transformChannelCreateRequest', (): void => {
		it('should transform a valid channel create request', (): void => {
			const result = transformChannelCreateRequest(validChannelCreatePayload, ChannelCreateReqSchema);

			expect(result).toEqual({
				type: 'some-channel',
				device: deviceId.toString(),
				category: DevicesModuleChannelCategory.generic,
				name: 'Channel name',
			});
		});

		it('should throw an error for an invalid channel create request', (): void => {
			expect(() =>
				transformChannelCreateRequest(
					{ ...validChannelCreatePayload, type: undefined } as unknown as IChannelsAddActionPayload['data'],
					ChannelCreateReqSchema
				)
			).toThrow(DevicesValidationException);
		});
	});

	describe('transformChannelUpdateRequest', (): void => {
		it('should transform a valid channel update request', (): void => {
			const result = transformChannelUpdateRequest(validChannelUpdatePayload, ChannelUpdateReqSchema);

			expect(result).toEqual({
				type: 'some-channel',
				name: 'Channel title',
			});
		});

		it('should throw an error for an invalid channel update request', (): void => {
			expect(() =>
				transformChannelUpdateRequest(
					{
						...validChannelUpdatePayload,
						type: undefined,
					} as unknown as IChannelsEditActionPayload['data'],
					ChannelUpdateReqSchema
				)
			).toThrow(DevicesValidationException);
		});
	});
});
