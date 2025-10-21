import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../dashboard.exceptions';

import { PageCreateReqSchema, PageSchema, PageUpdateReqSchema } from './pages.store.schemas';
import type { IPage, IPageCreateReq, IPageRes, IPageUpdateReq, IPagesAddActionPayload, IPagesEditActionPayload } from './pages.store.types';

export const transformPageResponse = <T extends IPage = IPage>(response: IPageRes, schema: typeof PageSchema): T => {
	const parsed = schema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DashboardValidationException('Failed to validate received page data.');
	}

	return parsed.data as T;
};

export const transformPageCreateRequest = <T extends IPageCreateReq = IPageCreateReq>(
	data: IPagesAddActionPayload['data'],
	schema: typeof PageCreateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DashboardValidationException('Failed to validate create page request.');
	}

	return parsed.data as T;
};

export const transformPageUpdateRequest = <T extends IPageUpdateReq = IPageUpdateReq>(
	data: IPagesEditActionPayload['data'],
	schema: typeof PageUpdateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DashboardValidationException('Failed to validate update page request.');
	}

	return parsed.data as T;
};
