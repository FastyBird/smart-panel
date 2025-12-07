import { SystemValidationException } from '../system.exceptions';

import { DisplayProfileCreateReqSchema, DisplayProfileSchema, DisplayProfileUpdateReqSchema } from './displays-profiles.store.schemas';
import type {
	IDisplayProfile,
	IDisplayProfileCreateReq,
	IDisplayProfileRes,
	IDisplayProfileUpdateReq,
	IDisplaysProfilesAddActionPayload,
	IDisplaysProfilesEditActionPayload,
} from './displays-profiles.store.types';

// Note: Display profiles have been consolidated into the DisplaysModule
// The transformer now maps from the unified Display entity

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transformDisplayProfileResponse = (response: any): IDisplayProfile => {
	const parsedDisplay = DisplayProfileSchema.safeParse({
		id: response.id,
		uid: response.id, // Using ID as UID for backward compatibility
		screenWidth: response.screen_width,
		screenHeight: response.screen_height,
		pixelRatio: response.pixel_ratio,
		unitSize: response.unit_size,
		rows: response.rows,
		cols: response.cols,
		primary: false, // Primary flag no longer exists, default to false
		createdAt: response.created_at,
		updatedAt: response.updated_at ?? null,
	});

	if (!parsedDisplay.success) {
		throw new SystemValidationException('Failed to validate received display profile data.');
	}

	return parsedDisplay.data;
};

export const transformDisplayProfileCreateRequest = (
	display: IDisplaysProfilesAddActionPayload['data'] & { id?: string }
): IDisplayProfileCreateReq => {
	const parsedRequest = DisplayProfileCreateReqSchema.safeParse({
		mac_address: display.uid || '', // Using UID as mac_address for backward compatibility
		version: '1.0.0', // Default version since it's required
		screen_width: display.screenWidth,
		screen_height: display.screenHeight,
		pixel_ratio: display.pixelRatio,
		unit_size: display.unitSize,
		rows: display.rows,
		cols: display.cols,
	});

	if (!parsedRequest.success) {
		throw new SystemValidationException('Failed to validate create display profile request.');
	}

	return parsedRequest.data;
};

export const transformDisplayProfileUpdateRequest = (display: IDisplaysProfilesEditActionPayload['data']): IDisplayProfileUpdateReq => {
	const parsedRequest = DisplayProfileUpdateReqSchema.safeParse({
		unit_size: display.unitSize,
		rows: display.rows,
		cols: display.cols,
	});

	if (!parsedRequest.success) {
		throw new SystemValidationException('Failed to validate update display profile request.');
	}

	return parsedRequest.data;
};
