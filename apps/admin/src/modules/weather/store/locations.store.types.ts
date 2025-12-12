import type { Ref } from 'vue';

import type { Store } from 'pinia';
import type { z } from 'zod';

import type {
	WeatherLocationSchema,
	WeatherLocationsStateSemaphoreSchema,
	WeatherLocationsOnEventActionPayloadSchema,
	WeatherLocationsSetActionPayloadSchema,
	WeatherLocationsUnsetActionPayloadSchema,
	WeatherLocationsGetActionPayloadSchema,
	WeatherLocationsAddActionPayloadSchema,
	WeatherLocationsEditActionPayloadSchema,
	WeatherLocationsSaveActionPayloadSchema,
	WeatherLocationsRemoveActionPayloadSchema,
	WeatherLocationResSchema,
	WeatherLocationCreateReqSchema,
	WeatherLocationUpdateReqSchema,
	WeatherLocationAddFormSchema,
	WeatherLocationEditFormSchema,
} from './locations.store.schemas';

// STORE STATE
// ===========

export type IWeatherLocation = z.infer<typeof WeatherLocationSchema>;

export type IWeatherLocationsStateSemaphore = z.infer<typeof WeatherLocationsStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type IWeatherLocationsOnEventActionPayload = z.infer<typeof WeatherLocationsOnEventActionPayloadSchema>;

export type IWeatherLocationsSetActionPayload = z.infer<typeof WeatherLocationsSetActionPayloadSchema>;

export type IWeatherLocationsUnsetActionPayload = z.infer<typeof WeatherLocationsUnsetActionPayloadSchema>;

export type IWeatherLocationsGetActionPayload = z.infer<typeof WeatherLocationsGetActionPayloadSchema>;

export type IWeatherLocationsAddActionPayload = z.infer<typeof WeatherLocationsAddActionPayloadSchema>;

export type IWeatherLocationsEditActionPayload = z.infer<typeof WeatherLocationsEditActionPayloadSchema>;

export type IWeatherLocationsSaveActionPayload = z.infer<typeof WeatherLocationsSaveActionPayloadSchema>;

export type IWeatherLocationsRemoveActionPayload = z.infer<typeof WeatherLocationsRemoveActionPayloadSchema>;

// BACKEND API
// ===========

export type IWeatherLocationRes = z.infer<typeof WeatherLocationResSchema>;

export type IWeatherLocationCreateReq = z.infer<typeof WeatherLocationCreateReqSchema>;

export type IWeatherLocationUpdateReq = z.infer<typeof WeatherLocationUpdateReqSchema>;

// FORMS
// =====

export type IWeatherLocationAddForm = z.infer<typeof WeatherLocationAddFormSchema>;

export type IWeatherLocationEditForm = z.infer<typeof WeatherLocationEditFormSchema>;

// STORE
// =====

export interface IWeatherLocationsStoreState {
	data: Ref<Record<IWeatherLocation['id'], IWeatherLocation>>;
	semaphore: Ref<IWeatherLocationsStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface IWeatherLocationsStoreGetters {
	firstLoadFinished: () => boolean;
	getting: (id: IWeatherLocation['id']) => boolean;
	fetching: () => boolean;
	findAll: () => IWeatherLocation[];
	findById: (id: IWeatherLocation['id']) => IWeatherLocation | null;
}

export interface IWeatherLocationsStoreActions {
	onEvent: (payload: IWeatherLocationsOnEventActionPayload) => IWeatherLocation;
	set: (payload: IWeatherLocationsSetActionPayload) => IWeatherLocation;
	unset: (payload: IWeatherLocationsUnsetActionPayload) => void;
	get: (payload: IWeatherLocationsGetActionPayload) => Promise<IWeatherLocation>;
	fetch: () => Promise<IWeatherLocation[]>;
	add: (payload: IWeatherLocationsAddActionPayload) => Promise<IWeatherLocation>;
	edit: (payload: IWeatherLocationsEditActionPayload) => Promise<IWeatherLocation>;
	save: (payload: IWeatherLocationsSaveActionPayload) => Promise<IWeatherLocation>;
	remove: (payload: IWeatherLocationsRemoveActionPayload) => Promise<boolean>;
}

export type WeatherLocationsStoreSetup = IWeatherLocationsStoreState & IWeatherLocationsStoreGetters & IWeatherLocationsStoreActions;

export type WeatherLocationsStore = Store<'weather_module-locations', WeatherLocationsStoreSetup>;
