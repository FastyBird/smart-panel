import type { operations } from '../../../openapi';

import type {
	IAnnouncement,
	IAnnouncementCreateData,
	IAnnouncementUpdateData,
} from './announcements.store.types';

export type ApiAnnouncement = NonNullable<
	operations['get-spaces-signage-info-panel-plugin-announcements']['responses']['200']['content']['application/json']['data']
>[number];

type ApiAnnouncementCreate =
	operations['create-spaces-signage-info-panel-plugin-announcement']['requestBody']['content']['application/json']['data'];

type ApiAnnouncementUpdate = NonNullable<
	operations['update-spaces-signage-info-panel-plugin-announcement']['requestBody']
>['content']['application/json']['data'];

export const transformAnnouncementResponse = (response: ApiAnnouncement): IAnnouncement => {
	return {
		id: response.id,
		spaceId: response.space_id,
		order: response.order ?? 0,
		title: response.title,
		body: response.body ?? null,
		icon: response.icon ?? null,
		activeFrom: response.active_from ? new Date(response.active_from) : null,
		activeUntil: response.active_until ? new Date(response.active_until) : null,
		priority: response.priority ?? 0,
		createdAt: new Date(response.created_at),
		updatedAt: response.updated_at ? new Date(response.updated_at) : null,
	};
};

export const transformAnnouncementCreateRequest = (
	data: IAnnouncementCreateData,
): ApiAnnouncementCreate => {
	return {
		title: data.title,
		body: data.body ?? undefined,
		icon: data.icon ?? undefined,
		order: data.order,
		priority: data.priority,
		active_from: data.activeFrom ? data.activeFrom.toISOString() : undefined,
		active_until: data.activeUntil ? data.activeUntil.toISOString() : undefined,
	} as ApiAnnouncementCreate;
};

export const transformAnnouncementUpdateRequest = (
	data: IAnnouncementUpdateData,
): ApiAnnouncementUpdate => {
	const payload: Record<string, unknown> = {};

	if (data.title !== undefined) payload.title = data.title;
	if (data.body !== undefined) payload.body = data.body;
	if (data.icon !== undefined) payload.icon = data.icon;
	if (data.order !== undefined) payload.order = data.order;
	if (data.priority !== undefined) payload.priority = data.priority;
	if ('activeFrom' in data) {
		payload.active_from = data.activeFrom ? data.activeFrom.toISOString() : null;
	}
	if ('activeUntil' in data) {
		payload.active_until = data.activeUntil ? data.activeUntil.toISOString() : null;
	}

	return payload as ApiAnnouncementUpdate;
};
