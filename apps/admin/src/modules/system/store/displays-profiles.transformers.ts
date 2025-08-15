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

export const transformDisplayProfileResponse = (response: IDisplayProfileRes): IDisplayProfile => {
	const parsedDisplay = DisplayProfileSchema.safeParse({
		id: response.id,
		uid: response.uid,
		screenWidth: response.screen_width,
		screenHeight: response.screen_height,
		pixelRatio: response.pixel_ratio,
		unitSize: response.unit_size,
		rows: response.rows,
		cols: response.cols,
		primary: response.primary,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
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
		id: display.id,
		uid: display.uid,
		screen_width: display.screenWidth,
		screen_height: display.screenHeight,
		pixel_ratio: display.pixelRatio,
		unit_size: display.unitSize,
		rows: display.rows,
		cols: display.cols,
		primary: display.primary,
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
		primary: display.primary,
	});

	if (!parsedRequest.success) {
		throw new SystemValidationException('Failed to validate update display profile request.');
	}

	return parsedRequest.data;
};
