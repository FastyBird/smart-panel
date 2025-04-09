import { camelToSnake, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../dashboard.exceptions';

import { DataSourceCreateReqSchema, DataSourceSchema, DataSourceUpdateReqSchema } from './dataSources.store.schemas';
import type {
	IDataSource,
	IDataSourceCreateReq,
	IDataSourceRes,
	IDataSourceUpdateReq,
	IDataSourcesAddActionPayload,
	IDataSourcesEditActionPayload,
} from './dataSources.store.types';

export const transformDataSourceResponse = <T extends IDataSource = IDataSource>(response: IDataSourceRes, schema: typeof DataSourceSchema): T => {
	const parsedResponse = schema.safeParse(snakeToCamel(response));

	if (!parsedResponse.success) {
		console.error('Schema validation failed with:', parsedResponse.error);

		throw new DashboardValidationException('Failed to validate received data source data.');
	}

	return parsedResponse.data as T;
};

export const transformDataSourceCreateRequest = <T extends IDataSourceCreateReq = IDataSourceCreateReq>(
	property: IDataSourcesAddActionPayload['data'],
	schema: typeof DataSourceCreateReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(property));

	if (!parsedRequest.success) {
		console.error('Schema validation failed with:', parsedRequest.error);

		throw new DashboardValidationException('Failed to validate create data source request.');
	}

	return parsedRequest.data as T;
};

export const transformDataSourceUpdateRequest = <T extends IDataSourceUpdateReq = IDataSourceUpdateReq>(
	property: IDataSourcesEditActionPayload['data'],
	schema: typeof DataSourceUpdateReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(property));

	if (!parsedRequest.success) {
		console.error('Schema validation failed with:', parsedRequest.error);

		throw new DashboardValidationException('Failed to validate update data source request.');
	}

	return parsedRequest.data as T;
};
