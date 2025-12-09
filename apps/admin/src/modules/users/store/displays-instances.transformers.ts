import { UsersValidationException } from '../users.exceptions';

import { DisplayInstanceCreateReqSchema, DisplayInstanceSchema, DisplayInstanceUpdateReqSchema } from './displays-instances.store.schemas';
import type {
	IDisplayInstance,
	IDisplayInstanceCreateReq,
	IDisplayInstanceUpdateReq,
	IDisplaysInstancesAddActionPayload,
	IDisplaysInstancesEditActionPayload,
} from './displays-instances.store.types';

// Note: Display instances have been consolidated into the DisplaysModule
// The transformer now maps from the unified Display entity

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transformDisplayInstanceResponse = (response: any): IDisplayInstance => {
	const parsedDisplay = DisplayInstanceSchema.safeParse({
		id: response.id,
		uid: response.id, // Using ID as UID for backward compatibility
		mac: response.mac_address, // Field renamed
		version: response.version,
		build: response.build || '',
		user: '', // User no longer tied to display
		displayProfile: null, // Display profile no longer a separate entity
		createdAt: response.created_at,
		updatedAt: response.updated_at ?? null,
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
		mac_address: display.mac, // Field renamed
		version: display.version,
		build: display.build,
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
	});

	if (!parsedRequest.success) {
		throw new UsersValidationException('Failed to validate update display instance request.');
	}

	return parsedRequest.data;
};
