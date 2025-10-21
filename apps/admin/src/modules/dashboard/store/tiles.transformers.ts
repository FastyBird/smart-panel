import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../dashboard.exceptions';

import { TileCreateReqSchema, TileSchema, TileUpdateReqSchema } from './tiles.store.schemas';
import type { ITile, ITileCreateReq, ITileRes, ITileUpdateReq, ITilesAddActionPayload, ITilesEditActionPayload } from './tiles.store.types';

export const transformTileResponse = <T extends ITile = ITile>(response: ITileRes, schema: typeof TileSchema): T => {
	const parsedResponse = schema.safeParse(snakeToCamel(response));

	if (!parsedResponse.success) {
		logger.error('Schema validation failed with:', parsedResponse.error);

		throw new DashboardValidationException('Failed to validate received tile data.');
	}

	return parsedResponse.data as T;
};

export const transformTileCreateRequest = <T extends ITileCreateReq = ITileCreateReq>(
	data: ITilesAddActionPayload['data'],
	schema: typeof TileCreateReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(data));

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new DashboardValidationException('Failed to validate create tile request.');
	}

	return parsedRequest.data as T;
};

export const transformTileUpdateRequest = <T extends ITileUpdateReq = ITileUpdateReq>(
	data: ITilesEditActionPayload['data'],
	schema: typeof TileUpdateReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(data));

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new DashboardValidationException('Failed to validate update tile request.');
	}

	return parsedRequest.data as T;
};
