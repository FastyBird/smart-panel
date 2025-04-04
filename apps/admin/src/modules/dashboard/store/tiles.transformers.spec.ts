import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { DashboardDevicePreviewTileType } from '../../../openapi';
import { DashboardValidationException } from '../dashboard.exceptions';

import {
	DevicePreviewTileCreateReqSchema,
	DevicePreviewTileUpdateReqSchema,
	type IPageDevicePreviewTileRes,
	type ITilesAddActionPayload,
	type ITilesEditActionPayload,
	PageDevicePreviewTileSchema,
} from './tiles.store.types';
import { transformTileCreateRequest, transformTileResponse, transformTileUpdateRequest } from './tiles.transformers';

const tileId = uuid();
const pageId = uuid();

const deviceId = uuid();

const validTileResponse: IPageDevicePreviewTileRes & { parent: 'page' } = {
	id: tileId.toString(),
	type: DashboardDevicePreviewTileType.device_preview,
	row: 0,
	col: 0,
	row_span: 0,
	col_span: 0,
	device: deviceId.toString(),
	icon: 'test',
	page: pageId.toString(),
	data_source: [],
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
	parent: 'page',
};

const validTileCreatePayload: ITilesAddActionPayload['data'] = {
	type: DashboardDevicePreviewTileType.device_preview,
	row: 0,
	col: 0,
	rowSpan: 0,
	colSpan: 0,
	icon: null,
	device: deviceId.toString(),
};

const validTileUpdatePayload: ITilesEditActionPayload['data'] = {
	type: DashboardDevicePreviewTileType.device_preview,
	row: 0,
	col: 0,
	device: deviceId.toString(),
};

describe('Tiles Transformers', (): void => {
	describe('transformTileResponse', (): void => {
		it('should transform a valid tile response', (): void => {
			const result = transformTileResponse(validTileResponse, PageDevicePreviewTileSchema);

			expect(result).toEqual({
				id: tileId.toString(),
				type: DashboardDevicePreviewTileType.device_preview,
				row: 0,
				col: 0,
				rowSpan: 0,
				colSpan: 0,
				device: deviceId.toString(),
				icon: 'test',
				page: pageId.toString(),
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid tile response', (): void => {
			expect(() =>
				transformTileResponse(
					{ ...validTileResponse, id: null } as unknown as IPageDevicePreviewTileRes & { parent: 'page' },
					PageDevicePreviewTileSchema
				)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformTileCreateRequest', (): void => {
		it('should transform a valid tile create request', (): void => {
			const result = transformTileCreateRequest(validTileCreatePayload, DevicePreviewTileCreateReqSchema);

			expect(result).toEqual({
				type: DashboardDevicePreviewTileType.device_preview,
				row: 0,
				col: 0,
				row_span: 0,
				col_span: 0,
				icon: null,
				device: deviceId.toString(),
			});
		});

		it('should throw an error for an invalid tile create request', (): void => {
			expect(() =>
				transformTileCreateRequest(
					{ ...validTileCreatePayload, type: 'invalid-type' } as unknown as ITilesAddActionPayload['data'],
					DevicePreviewTileCreateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformTileUpdateRequest', (): void => {
		it('should transform a valid tile update request', (): void => {
			const result = transformTileUpdateRequest(validTileUpdatePayload, DevicePreviewTileUpdateReqSchema);

			expect(result).toEqual({
				type: DashboardDevicePreviewTileType.device_preview,
				row: 0,
				col: 0,
				device: deviceId.toString(),
			});
		});

		it('should throw an error for an invalid tile update request', (): void => {
			expect(() =>
				transformTileUpdateRequest(
					{
						...validTileUpdatePayload,
						type: 'invalid-type',
					} as unknown as ITilesEditActionPayload['data'],
					DevicePreviewTileUpdateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});
});
