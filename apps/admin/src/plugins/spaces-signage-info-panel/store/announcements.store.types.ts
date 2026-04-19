import type { Ref } from 'vue';

import type { ISpace } from '../../../modules/spaces';

export interface IAnnouncement {
	id: string;
	spaceId: ISpace['id'];
	order: number;
	title: string;
	body: string | null;
	icon: string | null;
	activeFrom: Date | null;
	activeUntil: Date | null;
	priority: number;
	createdAt: Date;
	updatedAt: Date | null;
}

export interface IAnnouncementCreateData {
	title: string;
	body?: string | null;
	icon?: string | null;
	order?: number;
	activeFrom?: Date | null;
	activeUntil?: Date | null;
	priority?: number;
}

export interface IAnnouncementUpdateData {
	title?: string;
	body?: string | null;
	icon?: string | null;
	order?: number;
	activeFrom?: Date | null;
	activeUntil?: Date | null;
	priority?: number;
}

export interface IReorderEntry {
	id: IAnnouncement['id'];
	order: number;
}

export interface IAnnouncementsState {
	data: Ref<{ [key: IAnnouncement['id']]: IAnnouncement }>;
	fetching: Ref<ISpace['id'][]>;
	saving: Ref<IAnnouncement['id'][]>;
}

export interface IAnnouncementsActions {
	fetch: (spaceId: ISpace['id']) => Promise<IAnnouncement[]>;
	listForSpace: (spaceId: ISpace['id']) => IAnnouncement[];
	create: (spaceId: ISpace['id'], data: IAnnouncementCreateData) => Promise<IAnnouncement>;
	update: (
		spaceId: ISpace['id'],
		id: IAnnouncement['id'],
		data: IAnnouncementUpdateData,
	) => Promise<IAnnouncement>;
	remove: (spaceId: ISpace['id'], id: IAnnouncement['id']) => Promise<void>;
	reorder: (spaceId: ISpace['id'], items: IReorderEntry[]) => Promise<IAnnouncement[]>;
	onEvent: (announcement: IAnnouncement) => void;
	unset: (id: IAnnouncement['id']) => void;
}

export type AnnouncementsStoreSetup = IAnnouncementsState & IAnnouncementsActions;
