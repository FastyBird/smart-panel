import type { z } from 'zod';

import type { HomeKitBridgeStatusSchema, HomeKitDeviceCandidateSchema } from './homekit-bridge.store.schemas';

export type IHomeKitBridgeStatus = z.infer<typeof HomeKitBridgeStatusSchema>;
export type IHomeKitDeviceCandidate = z.infer<typeof HomeKitDeviceCandidateSchema>;
