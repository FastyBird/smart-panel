import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { DashboardDeviceDetailPageType } from '../../../openapi';
import { DashboardValidationException } from '../dashboard.exceptions';

import { DeviceDetailPageCreateReqSchema, DeviceDetailPageSchema, DeviceDetailPageUpdateReqSchema } from './pages.store.schemas';
import type { IDeviceDetailPageRes, IPagesAddActionPayload, IPagesEditActionPayload } from './pages.store.types';
import { transformPageCreateRequest, transformPageResponse, transformPageUpdateRequest } from './pages.transformers';

const pageId = uuid();

const deviceId = uuid();

const validPageResponse: IDeviceDetailPageRes & { parent: 'page' } = {
	id: pageId.toString(),
	type: DashboardDeviceDetailPageType.device_detail,
	title: 'Page title',
	order: 0,
	icon: 'test',
	device: deviceId.toString(),
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
	parent: 'page',
};

const validPageCreatePayload: IPagesAddActionPayload['data'] = {
	type: DashboardDeviceDetailPageType.device_detail,
	title: 'Page title',
	order: 0,
	icon: null,
	device: deviceId.toString(),
};

const validPageUpdatePayload: IPagesEditActionPayload['data'] = {
	type: DashboardDeviceDetailPageType.device_detail,
	title: 'Page title',
	order: 0,
	device: deviceId.toString(),
};

describe('Pages Transformers', (): void => {
	describe('transformPageResponse', (): void => {
		it('should transform a valid page response', (): void => {
			const result = transformPageResponse(validPageResponse, DeviceDetailPageSchema);

			expect(result).toEqual({
				id: pageId.toString(),
				type: DashboardDeviceDetailPageType.device_detail,
				title: 'Page title',
				order: 0,
				icon: 'test',
				device: deviceId.toString(),
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid page response', (): void => {
			expect(() =>
				transformPageResponse({ ...validPageResponse, id: null } as unknown as IDeviceDetailPageRes & { parent: 'page' }, DeviceDetailPageSchema)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformPageCreateRequest', (): void => {
		it('should transform a valid page create request', (): void => {
			const result = transformPageCreateRequest(validPageCreatePayload, DeviceDetailPageCreateReqSchema);

			expect(result).toEqual({
				type: DashboardDeviceDetailPageType.device_detail,
				title: 'Page title',
				order: 0,
				icon: null,
				device: deviceId.toString(),
			});
		});

		it('should throw an error for an invalid page create request', (): void => {
			expect(() =>
				transformPageCreateRequest(
					{ ...validPageCreatePayload, type: 'invalid-type' } as unknown as IPagesAddActionPayload['data'],
					DeviceDetailPageCreateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformPageUpdateRequest', (): void => {
		it('should transform a valid page update request', (): void => {
			const result = transformPageUpdateRequest(validPageUpdatePayload, DeviceDetailPageUpdateReqSchema);

			expect(result).toEqual({
				type: DashboardDeviceDetailPageType.device_detail,
				title: 'Page title',
				order: 0,
				device: deviceId.toString(),
			});
		});

		it('should throw an error for an invalid page update request', (): void => {
			expect(() =>
				transformPageUpdateRequest(
					{
						...validPageUpdatePayload,
						type: 'invalid-type',
					} as unknown as IPagesEditActionPayload['data'],
					DeviceDetailPageUpdateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});
});
