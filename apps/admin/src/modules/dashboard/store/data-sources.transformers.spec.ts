import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { DashboardValidationException } from '../dashboard.exceptions';

import { DataSourceCreateReqSchema, DataSourceSchema, DataSourceUpdateReqSchema } from './data-sources.store.schemas';
import type { IDataSourceRes, IDataSourcesAddActionPayload, IDataSourcesEditActionPayload } from './data-sources.store.types';
import { transformDataSourceCreateRequest, transformDataSourceResponse, transformDataSourceUpdateRequest } from './data-sources.transformers';

const dsId = uuid();
const parentId = uuid();

const validDataSourceResponse: IDataSourceRes = {
	id: dsId.toString(),
	type: 'some-datasource',
	parent: {
		type: 'page',
		id: parentId.toString(),
	},
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validDataSourceCreatePayload: IDataSourcesAddActionPayload['data'] = {
	type: 'some-datasource',
	parent: {
		type: 'page',
		id: parentId.toString(),
	},
};

const validDataSourceUpdatePayload: IDataSourcesEditActionPayload['data'] = {
	type: 'some-datasource',
	parent: {
		type: 'page',
		id: parentId.toString(),
	},
};

describe('DataSources Transformers', (): void => {
	describe('transformDataSourceResponse', (): void => {
		it('should transform a valid data source response', (): void => {
			const result = transformDataSourceResponse(validDataSourceResponse, DataSourceSchema);

			expect(result).toEqual({
				id: dsId.toString(),
				type: 'some-datasource',
				parent: {
					type: 'page',
					id: parentId.toString(),
				},
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid data source response', (): void => {
			expect(() =>
				transformDataSourceResponse({ ...validDataSourceResponse, id: null } as unknown as IDataSourceRes & { parent: 'page' }, DataSourceSchema)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformDataSourceCreateRequest', (): void => {
		it('should transform a valid data source create request', (): void => {
			const result = transformDataSourceCreateRequest(validDataSourceCreatePayload, DataSourceCreateReqSchema);

			expect(result).toEqual({
				type: 'some-datasource',
				parent: {
					type: 'page',
					id: parentId.toString(),
				},
			});
		});

		it('should throw an error for an invalid data source create request', (): void => {
			expect(() =>
				transformDataSourceCreateRequest(
					{ ...validDataSourceCreatePayload, type: undefined } as unknown as IDataSourcesAddActionPayload['data'],
					DataSourceCreateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformDataSourceUpdateRequest', (): void => {
		it('should transform a valid data source update request', (): void => {
			const result = transformDataSourceUpdateRequest(validDataSourceUpdatePayload, DataSourceUpdateReqSchema);

			expect(result).toEqual({
				type: 'some-datasource',
			});
		});

		it('should throw an error for an invalid data source update request', (): void => {
			expect(() =>
				transformDataSourceUpdateRequest(
					{
						...validDataSourceUpdatePayload,
						type: undefined,
					} as unknown as IDataSourcesEditActionPayload['data'],
					DataSourceUpdateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});
});
