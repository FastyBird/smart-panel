import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { DashboardDeviceChannelDataSourceType } from '../../../openapi';
import { DashboardValidationException } from '../dashboard.exceptions';

import {
	DeviceChannelDataSourceCreateReqSchema,
	DeviceChannelDataSourceUpdateReqSchema,
	type IDataSourcesAddActionPayload,
	type IDataSourcesEditActionPayload,
	type IPageDeviceChannelDataSourceRes,
	PageDeviceChannelDataSourceSchema,
} from './dataSources.store.types';
import { transformDataSourceCreateRequest, transformDataSourceResponse, transformDataSourceUpdateRequest } from './dataSources.transformers';

const dsId = uuid();
const pageId = uuid();

const deviceId = uuid();
const channelId = uuid();
const propertyId = uuid();

const validDataSourceResponse: IPageDeviceChannelDataSourceRes & { parent: 'page' } = {
	id: dsId.toString(),
	type: DashboardDeviceChannelDataSourceType.device_channel,
	device: deviceId.toString(),
	channel: channelId.toString(),
	property: propertyId.toString(),
	icon: 'test',
	page: pageId.toString(),
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
	parent: 'page',
};

const validDataSourceCreatePayload: IDataSourcesAddActionPayload['data'] = {
	type: DashboardDeviceChannelDataSourceType.device_channel,
	icon: null,
	device: deviceId.toString(),
	channel: channelId.toString(),
	property: propertyId.toString(),
};

const validDataSourceUpdatePayload: IDataSourcesEditActionPayload['data'] = {
	type: DashboardDeviceChannelDataSourceType.device_channel,
	device: deviceId.toString(),
	channel: channelId.toString(),
	property: propertyId.toString(),
};

describe('DataSources Transformers', (): void => {
	describe('transformDataSourceResponse', (): void => {
		it('should transform a valid data source response', (): void => {
			const result = transformDataSourceResponse(validDataSourceResponse, PageDeviceChannelDataSourceSchema);

			expect(result).toEqual({
				id: dsId.toString(),
				type: DashboardDeviceChannelDataSourceType.device_channel,
				device: deviceId.toString(),
				channel: channelId.toString(),
				property: propertyId.toString(),
				icon: 'test',
				page: pageId.toString(),
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid data source response', (): void => {
			expect(() =>
				transformDataSourceResponse(
					{ ...validDataSourceResponse, id: null } as unknown as IPageDeviceChannelDataSourceRes & { parent: 'page' },
					PageDeviceChannelDataSourceSchema
				)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformDataSourceCreateRequest', (): void => {
		it('should transform a valid data source create request', (): void => {
			const result = transformDataSourceCreateRequest(validDataSourceCreatePayload, DeviceChannelDataSourceCreateReqSchema);

			expect(result).toEqual({
				type: DashboardDeviceChannelDataSourceType.device_channel,
				icon: null,
				device: deviceId.toString(),
				channel: channelId.toString(),
				property: propertyId.toString(),
			});
		});

		it('should throw an error for an invalid data source create request', (): void => {
			expect(() =>
				transformDataSourceCreateRequest(
					{ ...validDataSourceCreatePayload, type: 'invalid-type' } as unknown as IDataSourcesAddActionPayload['data'],
					DeviceChannelDataSourceCreateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformDataSourceUpdateRequest', (): void => {
		it('should transform a valid data source update request', (): void => {
			const result = transformDataSourceUpdateRequest(validDataSourceUpdatePayload, DeviceChannelDataSourceUpdateReqSchema);

			expect(result).toEqual({
				type: DashboardDeviceChannelDataSourceType.device_channel,
				device: deviceId.toString(),
				channel: channelId.toString(),
				property: propertyId.toString(),
			});
		});

		it('should throw an error for an invalid data source update request', (): void => {
			expect(() =>
				transformDataSourceUpdateRequest(
					{
						...validDataSourceUpdatePayload,
						type: 'invalid-type',
					} as unknown as IDataSourcesEditActionPayload['data'],
					DeviceChannelDataSourceUpdateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});
});
