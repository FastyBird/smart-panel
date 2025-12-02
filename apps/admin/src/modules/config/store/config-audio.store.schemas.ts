import { type ZodType, z } from 'zod';

import { type components } from '../../../openapi';
import { ConfigModuleAudioType } from '../../../openapi.constants';

type ApiConfigAudio = components['schemas']['ConfigModuleDataAudio'];
type ApiConfigUpdateAudio = components['schemas']['ConfigModuleUpdateAudio'];

// STORE STATE
// ===========

export const ConfigAudioSchema = z.object({
	type: z.nativeEnum(ConfigModuleAudioType),
	speaker: z.boolean(),
	speakerVolume: z.number().min(0).max(100),
	microphone: z.boolean(),
	microphoneVolume: z.number().min(0).max(100),
});

export const ConfigAudioStateSemaphoreSchema = z.object({
	getting: z.boolean(),
	updating: z.boolean(),
});

// STORE ACTIONS
// =============

export const ConfigAudioOnEventActionPayloadSchema = z.object({
	data: z.object({}),
});

export const ConfigAudioSetActionPayloadSchema = z.object({
	data: z.object({
		speaker: z.boolean(),
		speakerVolume: z.number().min(0).max(100),
		microphone: z.boolean(),
		microphoneVolume: z.number().min(0).max(100),
	}),
});

export const ConfigAudioEditActionPayloadSchema = z.object({
	data: z.object({
		speaker: z.boolean(),
		speakerVolume: z.number().min(0).max(100),
		microphone: z.boolean(),
		microphoneVolume: z.number().min(0).max(100),
	}),
});

// BACKEND API
// ===========

export const ConfigAudioUpdateReqSchema: ZodType<ApiConfigUpdateAudio> = z.object({
	type: z.nativeEnum(ConfigModuleAudioType),
	speaker: z.boolean(),
	speaker_volume: z.number().min(0).max(100),
	microphone: z.boolean(),
	microphone_volume: z.number().min(0).max(100),
});

export const ConfigAudioResSchema: ZodType<ApiConfigAudio> = z.object({
	type: z.nativeEnum(ConfigModuleAudioType),
	speaker: z.boolean(),
	speaker_volume: z.number().min(0).max(100),
	microphone: z.boolean(),
	microphone_volume: z.number().min(0).max(100),
});
