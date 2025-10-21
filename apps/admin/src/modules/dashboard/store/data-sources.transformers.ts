import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../dashboard.exceptions';

import { DataSourceCreateReqSchema, DataSourceSchema, DataSourceUpdateReqSchema } from './data-sources.store.schemas';
import type {
	IDataSource,
	IDataSourceCreateReq,
	IDataSourceRes,
	IDataSourceUpdateReq,
	IDataSourcesAddActionPayload,
	IDataSourcesEditActionPayload,
} from './data-sources.store.types';

export const transformDataSourceResponse = <T extends IDataSource = IDataSource>(response: IDataSourceRes, schema: typeof DataSourceSchema): T => {
	const parsedResponse = schema.safeParse(snakeToCamel(response));

	if (!parsedResponse.success) {
		logger.error('Schema validation failed with:', parsedResponse.error);

		throw new DashboardValidationException('Failed to validate received data source data.');
	}

	return parsedResponse.data as T;
};

export const transformDataSourceCreateRequest = <T extends IDataSourceCreateReq = IDataSourceCreateReq>(
	data: IDataSourcesAddActionPayload['data'],
	schema: typeof DataSourceCreateReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(data));

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new DashboardValidationException('Failed to validate create data source request.');
	}

	return parsedRequest.data as T;
};

export const transformDataSourceUpdateRequest = <T extends IDataSourceUpdateReq = IDataSourceUpdateReq>(
	data: IDataSourcesEditActionPayload['data'],
	schema: typeof DataSourceUpdateReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(data));

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new DashboardValidationException('Failed to validate update data source request.');
	}

	return parsedRequest.data as T;
};
