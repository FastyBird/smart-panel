import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { DashboardValidationException } from '../dashboard.exceptions';

import { TileCreateReqSchema, TileSchema, TileUpdateReqSchema } from './tiles.store.schemas';
import type { ITileRes, ITilesAddActionPayload, ITilesEditActionPayload } from './tiles.store.types';
import { transformTileCreateRequest, transformTileResponse, transformTileUpdateRequest } from './tiles.transformers';

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

const tileId = uuid();
const pageId = uuid();

const validTileResponse: ITileRes = {
	id: tileId.toString(),
	type: 'some-tile',
	parent: {
		type: 'page',
		id: pageId,
	},
	row: 0,
	col: 0,
	row_span: 0,
	col_span: 0,
	hidden: false,
	data_source: [],
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validTileCreatePayload: ITilesAddActionPayload['data'] = {
	type: 'some-tile',
	parent: {
		type: 'page',
		id: pageId,
	},
	row: 0,
	col: 0,
	rowSpan: 0,
	colSpan: 0,
	hidden: false,
};

const validTileUpdatePayload: ITilesEditActionPayload['data'] = {
	type: 'some-tile',
	parent: {
		type: 'page',
		id: pageId,
	},
	row: 0,
	col: 0,
};

describe('Tiles Transformers', (): void => {
	describe('transformTileResponse', (): void => {
		it('should transform a valid tile response', (): void => {
			const result = transformTileResponse(validTileResponse, TileSchema);

			expect(result).toEqual({
				id: tileId.toString(),
				type: 'some-tile',
				parent: {
					type: 'page',
					id: pageId,
				},
				row: 0,
				col: 0,
				rowSpan: 0,
				colSpan: 0,
				hidden: false,
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid tile response', (): void => {
			expect(() => transformTileResponse({ ...validTileResponse, id: null } as unknown as ITileRes & { parent: 'page' }, TileSchema)).toThrow(
				DashboardValidationException
			);
		});
	});

	describe('transformTileCreateRequest', (): void => {
		it('should transform a valid tile create request', (): void => {
			const result = transformTileCreateRequest(validTileCreatePayload, TileCreateReqSchema);

			expect(result).toEqual({
				type: 'some-tile',
				parent: {
					type: 'page',
					id: pageId,
				},
				row: 0,
				col: 0,
				row_span: 0,
				col_span: 0,
				hidden: false,
			});
		});

		it('should throw an error for an invalid tile create request', (): void => {
			expect(() =>
				transformTileCreateRequest({ ...validTileCreatePayload, parent: undefined } as unknown as ITilesAddActionPayload['data'], TileCreateReqSchema)
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformTileUpdateRequest', (): void => {
		it('should transform a valid tile update request', (): void => {
			const result = transformTileUpdateRequest(validTileUpdatePayload, TileUpdateReqSchema);

			expect(result).toEqual({
				type: 'some-tile',
				row: 0,
				col: 0,
			});
		});
	});
});
