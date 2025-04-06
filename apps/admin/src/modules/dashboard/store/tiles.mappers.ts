import { DashboardException } from '../dashboard.exceptions';

import {
	CardDayWeatherTileSchema,
	CardDevicePreviewTileSchema,
	CardForecastWeatherTileSchema,
	CardTimeTileSchema,
	DayWeatherTileCreateReqSchema,
	DayWeatherTileUpdateReqSchema,
	DevicePreviewTileCreateReqSchema,
	DevicePreviewTileUpdateReqSchema,
	ForecastWeatherTileCreateReqSchema,
	ForecastWeatherTileUpdateReqSchema,
	PageDayWeatherTileSchema,
	PageDevicePreviewTileSchema,
	PageForecastWeatherTileSchema,
	PageTimeTileSchema,
	TimeTileCreateReqSchema,
	TimeTileUpdateReqSchema,
} from './tiles.store.schemas';
import type { ITilesEntitiesSchemas, TileParentType } from './tiles.store.types';

const schemas: Record<TileParentType, Record<string, ITilesEntitiesSchemas>> = {
	page: {
		['device-preview']: {
			tile: PageDevicePreviewTileSchema,
			createTileReq: DevicePreviewTileCreateReqSchema,
			updateTileReq: DevicePreviewTileUpdateReqSchema,
		},
		['clock']: {
			tile: PageTimeTileSchema,
			createTileReq: TimeTileCreateReqSchema,
			updateTileReq: TimeTileUpdateReqSchema,
		},
		['weather-day']: {
			tile: PageDayWeatherTileSchema,
			createTileReq: DayWeatherTileCreateReqSchema,
			updateTileReq: DayWeatherTileUpdateReqSchema,
		},
		['weather-forecast']: {
			tile: PageForecastWeatherTileSchema,
			createTileReq: ForecastWeatherTileCreateReqSchema,
			updateTileReq: ForecastWeatherTileUpdateReqSchema,
		},
	},
	card: {
		['device-preview']: {
			tile: CardDevicePreviewTileSchema,
			createTileReq: DevicePreviewTileCreateReqSchema,
			updateTileReq: DevicePreviewTileUpdateReqSchema,
		},
		['clock']: {
			tile: CardTimeTileSchema,
			createTileReq: TimeTileCreateReqSchema,
			updateTileReq: TimeTileUpdateReqSchema,
		},
		['weather-day']: {
			tile: CardDayWeatherTileSchema,
			createTileReq: DayWeatherTileCreateReqSchema,
			updateTileReq: DayWeatherTileUpdateReqSchema,
		},
		['weather-forecast']: {
			tile: CardForecastWeatherTileSchema,
			createTileReq: ForecastWeatherTileCreateReqSchema,
			updateTileReq: ForecastWeatherTileUpdateReqSchema,
		},
	},
};

export const getTilesSchemas = (parent: TileParentType, type: string): ITilesEntitiesSchemas => {
	if (!(parent in schemas) || !(type in schemas[parent])) {
		throw new DashboardException('For provided type and parent are not mapped schemas.');
	}

	return schemas[parent][type];
};
