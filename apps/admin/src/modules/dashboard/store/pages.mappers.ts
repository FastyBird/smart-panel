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
	},
	['tiles']: {
		page: TilesPageSchema,
		createPageReq: TilesPageCreateReqSchema,
		updatePageReq: TilesPageUpdateReqSchema,
	},
	['device-detail']: {
		page: DeviceDetailPageSchema,
		createPageReq: DeviceDetailPageCreateReqSchema,
		updatePageReq: DeviceDetailPageUpdateReqSchema,
	},
};

export const getPagesSchemas = (type: string): IPagesEntitiesSchemas => {
	if (!(type in schemas)) {
		throw new DashboardException('For provided type are not mapped schemas.');
	}

	return schemas[type];
};
