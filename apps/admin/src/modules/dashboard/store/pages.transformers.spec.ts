import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { DashboardValidationException } from '../dashboard.exceptions';

import { PageCreateReqSchema, PageSchema, PageUpdateReqSchema } from './pages.store.schemas';
import type { IPageRes, IPagesAddActionPayload, IPagesEditActionPayload } from './pages.store.types';
import { transformPageCreateRequest, transformPageResponse, transformPageUpdateRequest } from './pages.transformers';

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

const pageId = uuid();
const displayId = uuid();

const validPageResponse: IPageRes = {
	id: pageId,
	type: 'some-page',
	title: 'Page title',
	order: 0,
	show_top_bar: true,
	icon: 'test',
	displays: [displayId],
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
	data_source: [],
};

const validPageCreatePayload: IPagesAddActionPayload['data'] = {
	type: 'some-page',
	title: 'Page title',
	order: 0,
	showTopBar: true,
	icon: null,
	displays: [displayId],
};

const validPageUpdatePayload: IPagesEditActionPayload['data'] = {
	type: 'some-page',
	title: 'Page title',
	order: 0,
	showTopBar: true,
};

describe('Pages Transformers', (): void => {
	describe('transformPageResponse', (): void => {
		it('should transform a valid page response', (): void => {
			const result = transformPageResponse(validPageResponse, PageSchema);

			expect(result).toEqual({
				id: pageId,
				type: 'some-page',
				title: 'Page title',
				order: 0,
				showTopBar: true,
				icon: 'test',
				displays: [displayId],
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
				show_top_bar: true,
				icon: null,
				displays: [displayId],
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
				show_top_bar: true,
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
