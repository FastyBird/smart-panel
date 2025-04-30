import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi';
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

const channelId = uuid();
const channelPropertyId = uuid();

const validChannelResponse: IChannelPropertyRes = {
	id: channelPropertyId.toString(),
	type: 'some-property',
	channel: channelId.toString(),
	category: DevicesModuleChannelPropertyCategory.generic,
	name: 'Some channel property',
	permissions: [DevicesModuleChannelPropertyPermissions.ro],
	data_type: DevicesModuleChannelPropertyData_type.string,
	unit: 'N/A',
	format: null,
	invalid: -1,
	step: null,
	value: 'Some value',
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validChannelCreatePayload: IChannelsPropertiesAddActionPayload['data'] & { channel: IChannel['id'] } = {
	type: 'some-property',
	channel: channelId.toString(),
	category: DevicesModuleChannelPropertyCategory.generic,
	name: 'Channel property name',
	permissions: [DevicesModuleChannelPropertyPermissions.ro],
	dataType: DevicesModuleChannelPropertyData_type.string,
	unit: 'N/A',
	format: null,
	invalid: -1,
	step: null,
	value: 'Some value',
};

const validChannelUpdatePayload: IChannelsPropertiesEditActionPayload['data'] = {
	type: 'some-property',
	name: 'Channel property title',
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
				name: 'Some channel property',
				permissions: [DevicesModuleChannelPropertyPermissions.ro],
				dataType: DevicesModuleChannelPropertyData_type.string,
				unit: 'N/A',
				format: null,
				invalid: -1,
				step: null,
				value: 'Some value',
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
				name: 'Channel property name',
				permissions: [DevicesModuleChannelPropertyPermissions.ro],
				data_type: DevicesModuleChannelPropertyData_type.string,
				unit: 'N/A',
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
