import { z } from 'zod';

export const HomeKitBridgeStatusSchema = z.object({
	running: z.boolean(),
	paired: z.boolean(),
	pairedClientsCount: z.number(),
	bridgeName: z.string(),
	port: z.number(),
	pincode: z.string(),
	username: z.string(),
	setupUri: z.string(),
	qrCodeDataUri: z.string(),
	exposedDevicesCount: z.number(),
});

export const HomeKitDeviceCandidateSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	category: z.string(),
	roomName: z.string().nullable().optional(),
	roomId: z.string().uuid().nullable().optional(),
	isCompatible: z.boolean(),
	suggestedServiceType: z.string().nullable().optional(),
	isMapped: z.boolean(),
	channelsCount: z.number(),
});

export const HomeKitCandidatesListSchema = z.array(HomeKitDeviceCandidateSchema);
