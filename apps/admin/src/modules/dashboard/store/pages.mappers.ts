import { DashboardException } from '../dashboard.exceptions';

import {
	CardsPageCreateReqSchema,
	CardsPageResSchema,
	CardsPageSchema,
	CardsPageUpdateReqSchema,
	DeviceDetailPageCreateReqSchema,
	DeviceDetailPageResSchema,
	DeviceDetailPageSchema,
	DeviceDetailPageUpdateReqSchema,
	type IPagesEntitiesSchemas,
	TilesPageCreateReqSchema,
	TilesPageResSchema,
	TilesPageSchema,
	TilesPageUpdateReqSchema,
} from './pages.store.types';

const schemas: Record<string, IPagesEntitiesSchemas> = {
	['cards']: {
		page: CardsPageSchema,
		createPageReq: CardsPageCreateReqSchema,
		updatePageReq: CardsPageUpdateReqSchema,
		pageRes: CardsPageResSchema,
	},
	['tiles']: {
		page: TilesPageSchema,
		createPageReq: TilesPageCreateReqSchema,
		updatePageReq: TilesPageUpdateReqSchema,
		pageRes: TilesPageResSchema,
	},
	['device-detail']: {
		page: DeviceDetailPageSchema,
		createPageReq: DeviceDetailPageCreateReqSchema,
		updatePageReq: DeviceDetailPageUpdateReqSchema,
		pageRes: DeviceDetailPageResSchema,
	},
};

export const getPagesSchemas = (type: string): IPagesEntitiesSchemas => {
	if (!(type in schemas)) {
		throw new DashboardException('For provided type are not mapped schemas.');
	}

	return schemas[type];
};
