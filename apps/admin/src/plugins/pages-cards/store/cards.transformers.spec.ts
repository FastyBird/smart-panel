import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { DashboardValidationException } from '../../../modules/dashboard';

import type { ICardRes, ICardsAddActionPayload, ICardsEditActionPayload } from './cards.store.types';
import { transformCardCreateRequest, transformCardResponse, transformCardUpdateRequest } from './cards.transformers';

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

const cardId = uuid();
const pageId = uuid();

const validCardResponse: ICardRes = {
	id: cardId.toString(),
	page: pageId.toString(),
	title: 'Card title',
	order: 0,
	icon: 'test-icon',
	data_source: [],
	tiles: [],
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validCardCreatePayload: ICardsAddActionPayload['data'] = {
	title: 'Card title',
	order: 0,
	icon: null,
};

const validCardUpdatePayload: ICardsEditActionPayload['data'] = {
	title: 'Card title',
	order: 0,
};

describe('Cards Transformers', (): void => {
	describe('transformCardResponse', (): void => {
		it('should transform a valid card response', (): void => {
			const result = transformCardResponse(validCardResponse);

			expect(result).toEqual({
				id: cardId.toString(),
				title: 'Card title',
				order: 0,
				icon: 'test-icon',
				page: pageId.toString(),
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid card response', (): void => {
			expect(() => transformCardResponse({ ...validCardResponse, id: null } as unknown as ICardRes & { parent: 'page' })).toThrow(
				DashboardValidationException
			);
		});
	});

	describe('transformCardCreateRequest', (): void => {
		it('should transform a valid card create request', (): void => {
			const result = transformCardCreateRequest(validCardCreatePayload);

			expect(result).toEqual({
				title: 'Card title',
				order: 0,
				icon: null,
			});
		});

		it('should throw an error for an invalid card create request', (): void => {
			expect(() =>
				transformCardCreateRequest({ ...validCardCreatePayload, order: 'not-a-number' } as unknown as ICardsAddActionPayload['data'])
			).toThrow(DashboardValidationException);
		});
	});

	describe('transformCardUpdateRequest', (): void => {
		it('should transform a valid card update request', (): void => {
			const result = transformCardUpdateRequest(validCardUpdatePayload);

			expect(result).toEqual({
				title: 'Card title',
				order: 0,
			});
		});

		it('should throw an error for an invalid card update request', (): void => {
			expect(() =>
				transformCardUpdateRequest({
					...validCardUpdatePayload,
					order: 'not-a-number',
				} as unknown as ICardsEditActionPayload['data'])
			).toThrow(DashboardValidationException);
		});
	});
});
