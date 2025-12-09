import { DisplaysValidationException } from '../displays.exceptions';

import { DisplayCreateReqSchema, DisplaySchema, DisplayUpdateReqSchema } from './displays.store.schemas';
import type { IDisplay, IDisplayCreateReq, IDisplayUpdateReq, IDisplaysAddActionPayload, IDisplaysEditActionPayload } from './displays.store.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transformDisplayResponse = (response: any): IDisplay => {
	const parsedDisplay = DisplaySchema.safeParse({
		id: response.id,
		macAddress: response.mac_address,
		name: response.name ?? null,
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
	const parsedRequest = DisplayUpdateReqSchema.safeParse({
		name: display.name,
		dark_mode: display.darkMode,
		brightness: display.brightness,
		screen_lock_duration: display.screenLockDuration,
		screen_saver: display.screenSaver,
		// Audio settings
		speaker: display.speaker,
		speaker_volume: display.speakerVolume,
		microphone: display.microphone,
		microphone_volume: display.microphoneVolume,
	});

	if (!parsedRequest.success) {
		throw new DisplaysValidationException('Failed to validate update display request.');
	}

	return parsedRequest.data;
};
