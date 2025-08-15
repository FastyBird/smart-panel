import { UsersValidationException } from '../users.exceptions';

import { DisplayInstanceCreateReqSchema, DisplayInstanceSchema, DisplayInstanceUpdateReqSchema } from './displays-instances.store.schemas';
import type {
	IDisplayInstance,
	IDisplayInstanceCreateReq,
	IDisplayInstanceRes,
	IDisplayInstanceUpdateReq,
	IDisplaysInstancesAddActionPayload,
	IDisplaysInstancesEditActionPayload,
} from './displays-instances.store.types';

export const transformDisplayInstanceResponse = (response: IDisplayInstanceRes): IDisplayInstance => {
	const parsedDisplay = DisplayInstanceSchema.safeParse({
		id: response.id,
		uid: response.uid,
		mac: response.mac,
		version: response.version,
		build: response.build,
		user: response.user,
		displayProfile: response.display_profile,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});

	if (!parsedDisplay.success) {
		throw new UsersValidationException('Failed to validate received display instance data.');
	}

	return parsedDisplay.data;
};

export const transformDisplayInstanceCreateRequest = (
	display: IDisplaysInstancesAddActionPayload['data'] & { id?: string }
): IDisplayInstanceCreateReq => {
	const parsedRequest = DisplayInstanceCreateReqSchema.safeParse({
		id: display.id,
		uid: display.uid,
		mac: display.mac,
		version: display.version,
		build: display.build,
		user: display.user,
	});

	if (!parsedRequest.success) {
		throw new UsersValidationException('Failed to validate create display instance request.');
	}

	return parsedRequest.data;
};

export const transformDisplayInstanceUpdateRequest = (display: IDisplaysInstancesEditActionPayload['data']): IDisplayInstanceUpdateReq => {
	const parsedRequest = DisplayInstanceUpdateReqSchema.safeParse({
		version: display.version,
		build: display.build,
		display_profile: display.displayProfile,
	});

	if (!parsedRequest.success) {
		throw new UsersValidationException('Failed to validate update display instance request.');
	}

	return parsedRequest.data;
};
