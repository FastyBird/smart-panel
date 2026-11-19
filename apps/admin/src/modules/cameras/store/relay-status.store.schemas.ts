import { z } from 'zod';

import { CamerasModuleDataGo2rtcConfigMode, CamerasModuleDataRelayStatusReason, CamerasModuleDataRelayStatusState } from '../../../openapi.constants';

// The generated type marks `reason` as non-nullable, but the backend sends null while the relay runs.
export const RelayStatusSchema = z.object({
	relay: z.object({
		mode: z.nativeEnum(CamerasModuleDataGo2rtcConfigMode),
		state: z.nativeEnum(CamerasModuleDataRelayStatusState),
		reason: z.nativeEnum(CamerasModuleDataRelayStatusReason).nullable(),
		version: z.string().nullable(),
	}),
	sessions: z.object({
		active: z.number(),
		max: z.number(),
		maxPerCamera: z.number(),
	}),
});
