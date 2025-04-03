import { camelToSnake, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../dashboard.exceptions';

import {
	type ITileBase,
	type ITileCreateBaseReq,
	type ITileRes,
	type ITileUpdateBaseReq,
	type ITilesAddActionPayload,
	type ITilesEditActionPayload,
	TileBaseSchema,
	TileCreateBaseReqSchema,
	type TileParentType,
	TileUpdateBaseReqSchema,
} from './tiles.store.types';

export const transformTileResponse = <T extends ITileBase = ITileBase>(
	response: ITileRes & { parent: TileParentType },
	schema: typeof TileBaseSchema
): T => {
	const parsed = schema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new DashboardValidationException('Failed to validate received tile data.');
	}

	return parsed.data as T;
};

export const transformTileCreateRequest = <T extends ITileCreateBaseReq = ITileCreateBaseReq>(
	property: ITilesAddActionPayload['data'],
	schema: typeof TileCreateBaseReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(property));

	if (!parsedRequest.success) {
		throw new DashboardValidationException('Failed to validate create tile request.');
	}

	return parsedRequest.data as T;
};

export const transformTileUpdateRequest = <T extends ITileUpdateBaseReq = ITileUpdateBaseReq>(
	property: ITilesEditActionPayload['data'],
	schema: typeof TileUpdateBaseReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(property));

	if (!parsedRequest.success) {
		throw new DashboardValidationException('Failed to validate update tile request.');
	}

	return parsedRequest.data as T;
};
