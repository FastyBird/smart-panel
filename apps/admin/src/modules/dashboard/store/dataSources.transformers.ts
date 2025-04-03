import { camelToSnake, snakeToCamel } from '../../../common';
import { DashboardValidationException } from '../dashboard.exceptions';

import {
	DataSourceBaseSchema,
	DataSourceCreateBaseReqSchema,
	type DataSourceParentType,
	DataSourceUpdateBaseReqSchema,
	type IDataSourceBase,
	type IDataSourceCreateBaseReq,
	type IDataSourceRes,
	type IDataSourceUpdateBaseReq,
	type IDataSourcesAddActionPayload,
	type IDataSourcesEditActionPayload,
} from './dataSources.store.types';

export const transformDataSourceResponse = <T extends IDataSourceBase = IDataSourceBase>(
	response: IDataSourceRes & { parent: DataSourceParentType },
	schema: typeof DataSourceBaseSchema
): T => {
	const parsed = schema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new DashboardValidationException('Failed to validate received data source data.');
	}

	return parsed.data as T;
};

export const transformDataSourceCreateRequest = <T extends IDataSourceCreateBaseReq = IDataSourceCreateBaseReq>(
	property: IDataSourcesAddActionPayload['data'],
	schema: typeof DataSourceCreateBaseReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(property));

	if (!parsedRequest.success) {
		throw new DashboardValidationException('Failed to validate create data source request.');
	}

	return parsedRequest.data as T;
};

export const transformDataSourceUpdateRequest = <T extends IDataSourceUpdateBaseReq = IDataSourceUpdateBaseReq>(
	property: IDataSourcesEditActionPayload['data'],
	schema: typeof DataSourceUpdateBaseReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(property));

	if (!parsedRequest.success) {
		throw new DashboardValidationException('Failed to validate update data source request.');
	}

	return parsedRequest.data as T;
};
