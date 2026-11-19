import type { Ref } from 'vue';

import { z } from 'zod';

import { CameraProfileSchema, CameraSchema, CamerasGetActionPayloadSchema, CamerasStateSemaphoreSchema } from './cameras.store.schemas';

// STORE STATE
// ===========

export type ICameraProfile = z.infer<typeof CameraProfileSchema>;

export type ICamera = z.infer<typeof CameraSchema>;

export type ICamerasStateSemaphore = z.infer<typeof CamerasStateSemaphoreSchema>;

// STORE ACTIONS
// =============

export type ICamerasGetActionPayload = z.infer<typeof CamerasGetActionPayloadSchema>;

// STORE
// =====

export interface ICamerasStoreState {
	data: Ref<{ [deviceId: ICamera['deviceId']]: ICamera }>;
	semaphore: Ref<ICamerasStateSemaphore>;
}

export interface ICamerasStoreActions {
	fetch: () => Promise<ICamera[]>;
	get: (payload: ICamerasGetActionPayload) => Promise<ICamera>;
	findAll: () => ICamera[];
	findById: (deviceId: ICamera['deviceId']) => ICamera | null;
	isLoaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export type CamerasStoreSetup = ICamerasStoreState & ICamerasStoreActions;
