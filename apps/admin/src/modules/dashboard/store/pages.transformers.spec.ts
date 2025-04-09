import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { DashboardValidationException } from '../dashboard.exceptions';

import { PageCreateReqSchema, PageSchema, PageUpdateReqSchema } from './pages.store.schemas';
import type { IPageRes, IPagesAddActionPayload, IPagesEditActionPayload } from './pages.store.types';
import { transformPageCreateRequest, transformPageResponse, transformPageUpdateRequest } from './pages.transformers';

const pageId = uuid();

const validPageResponse: IPageRes = {
	id: pageId.toString(),
	type: 'some-page',
	title: 'Page title',
	order: 0,
	icon: 'test',
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validPageCreatePayload: IPagesAddActionPayload['data'] = {
	type: 'some-page',
	title: 'Page title',
	order: 0,
	icon: null,
};

const validPageUpdatePayload: IPagesEditActionPayload['data'] = {
	type: 'some-page',
	title: 'Page title',
	order: 0,
};

describe('Pages Transformers', (): void => {
	describe('transformPageResponse', (): void => {
		it('should transform a valid page response', (): void => {
			const result = transformPageResponse(validPageResponse, PageSchema);

			expect(result).toEqual({
				id: pageId.toString(),
				type: 'some-page',
				title: 'Page title',
				order: 0,
				icon: 'test',
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid page response', (): void => {
			expect(() => transformPageResponse({ ...validPageResponse, id: null } as unknown as IPageRes, PageSchema)).toThrow(
				DashboardValidationException
			);
		});
	});

	describe('transformPageCreateRequest', (): void => {
		it('should transform a valid page create request', (): void => {
			const result = transformPageCreateRequest(validPageCreatePayload, PageCreateReqSchema);

			expect(result).toEqual({
				type: 'some-page',
				title: 'Page title',
				order: 0,
				icon: null,
			});
		});

		it('should throw an error for an invalid page create request', (): void => {
			expect(() =>
				transformPageCreateRequest({ ...validPageCreatePayload, type: undefined } as unknown as IPagesAddActionPayload['data'], PageCreateReqSchema)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformPageUpdateRequest', (): void => {
		it('should transform a valid page update request', (): void => {
			const result = transformPageUpdateRequest(validPageUpdatePayload, PageUpdateReqSchema);

			expect(result).toEqual({
				type: 'some-page',
				title: 'Page title',
				order: 0,
			});
		});

		it('should throw an error for an invalid page update request', (): void => {
			expect(() =>
				transformPageUpdateRequest(
					{
						...validPageUpdatePayload,
						type: undefined,
					} as unknown as IPagesEditActionPayload['data'],
					PageUpdateReqSchema
				)
			).toThrow(DashboardValidationException);
		});
	});
});
