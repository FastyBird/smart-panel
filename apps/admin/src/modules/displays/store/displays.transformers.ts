import { DisplaysValidationException } from '../displays.exceptions';

import { DisplayCreateReqSchema, DisplaySchema, DisplayUpdateReqSchema } from './displays.store.schemas';
import type { IDisplay, IDisplayCreateReq, IDisplayRes, IDisplayUpdateReq, IDisplaysAddActionPayload, IDisplaysEditActionPayload } from './displays.store.types';

export const transformDisplayResponse = (response: IDisplayRes): IDisplay => {
	const parsedDisplay = DisplaySchema.safeParse({
		id: response.id,
		macAddress: response.mac_address,
		name: response.name ?? null, // Handle undefined by converting to null
		version: response.version,
		build: response.build ?? null,
		screenWidth: response.screen_width ?? 0,
		screenHeight: response.screen_height ?? 0,
		pixelRatio: response.pixel_ratio ?? 1,
		unitSize: response.unit_size ?? 8,
		rows: response.rows ?? 12,
		cols: response.cols ?? 24,
		darkMode: response.dark_mode ?? false,
		brightness: response.brightness ?? 100,
		screenLockDuration: response.screen_lock_duration ?? 30,
		screenSaver: response.screen_saver ?? true,
		// Audio capabilities
		audioOutputSupported: response.audio_output_supported ?? false,
		audioInputSupported: response.audio_input_supported ?? false,
		// Audio settings
		speaker: response.speaker ?? false,
		speakerVolume: response.speaker_volume ?? 50,
		microphone: response.microphone ?? false,
		microphoneVolume: response.microphone_volume ?? 50,
		createdAt: response.created_at,
		updatedAt: response.updated_at ?? null,
	});

	if (!parsedDisplay.success) {
		throw new DisplaysValidationException('Failed to validate received display data.');
	}

	return parsedDisplay.data;
};

export const transformDisplayCreateRequest = (display: IDisplaysAddActionPayload['data'] & { id?: string }): IDisplayCreateReq => {
	const parsedRequest = DisplayCreateReqSchema.safeParse({
		mac_address: display.macAddress,
		version: display.version,
		build: display.build ?? undefined, // Convert null to undefined
		screen_width: display.screenWidth,
		screen_height: display.screenHeight,
		pixel_ratio: display.pixelRatio,
		unit_size: display.unitSize,
		rows: display.rows,
		cols: display.cols,
	});

	if (!parsedRequest.success) {
		throw new DisplaysValidationException('Failed to validate create display request.');
	}

	return parsedRequest.data;
};

export const transformDisplayUpdateRequest = (display: IDisplaysEditActionPayload['data']): IDisplayUpdateReq => {
	const baseData: Record<string, unknown> = {
		name: display.name,
		unit_size: display.unitSize,
		rows: display.rows,
		cols: display.cols,
		dark_mode: display.darkMode,
		brightness: display.brightness,
		screen_lock_duration: display.screenLockDuration,
		screen_saver: display.screenSaver,
	};

	// Only include audio settings if they are defined (i.e., display supports audio)
	if (display.speaker !== undefined) {
		baseData.speaker = display.speaker;
	}
	if (display.speakerVolume !== undefined) {
		baseData.speaker_volume = display.speakerVolume;
	}
	if (display.microphone !== undefined) {
		baseData.microphone = display.microphone;
	}
	if (display.microphoneVolume !== undefined) {
		baseData.microphone_volume = display.microphoneVolume;
	}

	const parsedRequest = DisplayUpdateReqSchema.safeParse(baseData);

	if (!parsedRequest.success) {
		throw new DisplaysValidationException('Failed to validate update display request.');
	}

	return parsedRequest.data;
};
