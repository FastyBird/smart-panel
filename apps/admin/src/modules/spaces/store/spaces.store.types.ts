import type { Ref } from 'vue';

import type { SpaceType } from '../spaces.constants';

export interface ISpace {
	id: string;
	name: string;
	description: string | null;
	type: SpaceType;
	icon: string | null;
	displayOrder: number;
	primaryThermostatId: string | null;
	primaryTemperatureSensorId: string | null;
	createdAt: Date;
	updatedAt: Date | null;

	draft: boolean;
}

export interface ISpaceEditData {
	name: string;
	description?: string | null;
	type?: SpaceType;
	icon?: string | null;
	displayOrder?: number;
	primaryThermostatId?: string | null;
	primaryTemperatureSensorId?: string | null;
}

export interface ISpaceCreateData {
	name: string;
	description?: string | null;
	type?: SpaceType;
	icon?: string | null;
	displayOrder?: number;
	primaryThermostatId?: string | null;
	primaryTemperatureSensorId?: string | null;
}

export interface ISpacesStoreState {
	data: Ref<{ [key: ISpace['id']]: ISpace }>;
	semaphore: Ref<ISpacesStateSemaphore>;
	firstLoad: Ref<boolean>;
}

export interface ISpacesStateSemaphore {
	fetching: ISpacesFetching;
	creating: string[];
	updating: string[];
	deleting: string[];
}

export interface ISpacesFetching {
	items: boolean;
	item: string[];
}

export interface ISpacesStoreActions {
	firstLoadFinished: () => boolean;
	fetching: () => boolean;
	findById: (id: ISpace['id']) => ISpace | null;
	findAll: () => ISpace[];
	fetch: () => Promise<ISpace[]>;
	get: (payload: { id: ISpace['id'] }) => Promise<ISpace>;
	add: (payload: { id?: string; data: ISpaceCreateData }) => Promise<ISpace>;
	edit: (payload: { id: ISpace['id']; data: ISpaceEditData }) => Promise<ISpace>;
	save: (payload: { id: ISpace['id'] }) => Promise<ISpace>;
	remove: (payload: { id: ISpace['id'] }) => Promise<void>;
	set: (payload: { id: ISpace['id']; data: Partial<ISpace> }) => void;
	unset: (payload: { id: ISpace['id'] }) => void;
	onEvent: (payload: { id: ISpace['id']; data: Record<string, unknown> }) => void;
}

export type ISpacesStore = ISpacesStoreState & ISpacesStoreActions;
