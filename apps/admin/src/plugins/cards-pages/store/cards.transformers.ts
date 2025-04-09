import { camelToSnake, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../../../modules/dashboard';

import { CardCreateReqSchema, CardSchema, CardUpdateReqSchema } from './cards.store.schemas';
import type { ICard, ICardCreateReq, ICardRes, ICardUpdateReq, ICardsAddActionPayload, ICardsEditActionPayload } from './cards.store.types';

export const transformCardResponse = (response: ICardRes): ICard => {
	const parsedCard = CardSchema.safeParse(snakeToCamel(response));

	if (!parsedCard.success) {
		throw new DashboardValidationException('Failed to validate received card data.');
	}

	return parsedCard.data;
};

export const transformCardCreateRequest = (card: ICardsAddActionPayload['data']): ICardCreateReq => {
	const parsedRequest = CardCreateReqSchema.safeParse(camelToSnake(card));

	if (!parsedRequest.success) {
		throw new DashboardValidationException('Failed to validate create card request.');
	}

	return parsedRequest.data;
};

export const transformCardUpdateRequest = (card: ICardsEditActionPayload['data']): ICardUpdateReq => {
	const parsedRequest = CardUpdateReqSchema.safeParse(camelToSnake(card));

	if (!parsedRequest.success) {
		throw new DashboardValidationException('Failed to validate update card request.');
	}

	return parsedRequest.data;
};
