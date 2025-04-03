import { DashboardException } from '../dashboard.exceptions';

import {
	CardDeviceChannelDataSourceResSchema,
	CardDeviceChannelDataSourceSchema,
	type DataSourceParentType,
	DeviceChannelDataSourceCreateReqSchema,
	DeviceChannelDataSourceUpdateReqSchema,
	type IDataSourcesEntitiesSchemas,
	PageDeviceChannelDataSourceResSchema,
	PageDeviceChannelDataSourceSchema,
	TileDeviceChannelDataSourceResSchema,
	TileDeviceChannelDataSourceSchema,
} from './dataSources.store.types';

const schemas: Record<DataSourceParentType, Record<string, IDataSourcesEntitiesSchemas>> = {
	page: {
		['device-channel']: {
			dataSource: PageDeviceChannelDataSourceSchema,
			createDataSourceReq: DeviceChannelDataSourceCreateReqSchema,
			updateDataSourceReq: DeviceChannelDataSourceUpdateReqSchema,
			dataSourceRes: PageDeviceChannelDataSourceResSchema,
		},
	},
	card: {
		['device-channel']: {
			dataSource: CardDeviceChannelDataSourceSchema,
			createDataSourceReq: DeviceChannelDataSourceCreateReqSchema,
			updateDataSourceReq: DeviceChannelDataSourceUpdateReqSchema,
			dataSourceRes: CardDeviceChannelDataSourceResSchema,
		},
	},
	tile: {
		['device-channel']: {
			dataSource: TileDeviceChannelDataSourceSchema,
			createDataSourceReq: DeviceChannelDataSourceCreateReqSchema,
			updateDataSourceReq: DeviceChannelDataSourceUpdateReqSchema,
			dataSourceRes: TileDeviceChannelDataSourceResSchema,
		},
	},
};

export const getDataSourcesSchemas = (parent: DataSourceParentType, type: string): IDataSourcesEntitiesSchemas => {
	if (!(parent in schemas) || !(type in schemas[parent])) {
		throw new DashboardException('For provided type and parent are not mapped schemas.');
	}

	return schemas[parent][type];
};
