import { camelToSnake, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../dashboard.exceptions';

import {
	type IPageBase,
	type IPageCreateBaseReq,
	type IPageRes,
	type IPageUpdateBaseReq,
	type IPagesAddActionPayload,
	type IPagesEditActionPayload,
	PageBaseSchema,
	PageCreateBaseReqSchema,
	PageUpdateBaseReqSchema,
} from './pages.store.types';

export const transformPageResponse = <T extends IPageBase = IPageBase>(response: IPageRes, schema: typeof PageBaseSchema): T => {
	const parsed = schema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new DashboardValidationException('Failed to validate received page data.');
	}

	return parsed.data as T;
};

export const transformPageCreateRequest = <T extends IPageCreateBaseReq = IPageCreateBaseReq>(
	property: IPagesAddActionPayload['data'],
	schema: typeof PageCreateBaseReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(property));

	if (!parsed.success) {
		throw new DashboardValidationException('Failed to validate create page request.');
	}

	return parsed.data as T;
};

export const transformPageUpdateRequest = <T extends IPageUpdateBaseReq = IPageUpdateBaseReq>(
	property: IPagesEditActionPayload['data'],
	schema: typeof PageUpdateBaseReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(property));

	if (!parsed.success) {
		throw new DashboardValidationException('Failed to validate update page request.');
	}

	return parsed.data as T;
};
