import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type {
	IZ2mWizardAdoptDevice,
	IZ2mWizardAdoptionResult,
	IZ2mWizardDevice,
	IZ2mWizardDeviceStatus,
	IZ2mWizardSession,
} from '../schemas/wizard.types';

// ============================================================================
// API Response Shapes
// ============================================================================

interface ApiWizardPermitJoin {
	active: boolean;
	expiresAt?: string | null;
	remainingSeconds: number;
}

interface ApiWizardDevice {
	ieeeAddress: string;
	friendlyName: string;
	manufacturer?: string | null;
	model?: string | null;
	description?: string | null;
	status: string;
	suggestedCategory?: string | null;
	previewChannelCount: number;
	previewChannelIdentifiers?: string[];
	registeredDeviceId?: string | null;
	registeredDeviceName?: string | null;
	registeredDeviceCategory?: string | null;
	error?: string | null;
	lastSeenAt: string;
}

export interface ApiWizardSession {
	id: string;
	bridgeOnline: boolean;
	startedAt: string;
	permitJoin: ApiWizardPermitJoin;
	devices: ApiWizardDevice[];
}

interface ApiWizardAdoptionResult {
	ieeeAddress: string;
	name: string;
	status: string;
	error?: string | null;
}

export interface ApiWizardAdoption {
	results: ApiWizardAdoptionResult[];
}

// ============================================================================
// Response Transformers
// ============================================================================

const transformWizardDevice = (device: ApiWizardDevice): IZ2mWizardDevice => ({
	ieeeAddress: device.ieeeAddress,
	friendlyName: device.friendlyName,
	manufacturer: device.manufacturer ?? null,
	model: device.model ?? null,
	description: device.description ?? null,
	status: device.status as IZ2mWizardDeviceStatus,
	suggestedCategory: (device.suggestedCategory ?? null) as DevicesModuleDeviceCategory | null,
	previewChannelCount: device.previewChannelCount,
	previewChannelIdentifiers: device.previewChannelIdentifiers ?? [],
	registeredDeviceId: device.registeredDeviceId ?? null,
	registeredDeviceName: device.registeredDeviceName ?? null,
	registeredDeviceCategory: (device.registeredDeviceCategory ?? null) as DevicesModuleDeviceCategory | null,
	error: device.error ?? null,
	lastSeenAt: device.lastSeenAt,
});

export const transformWizardSessionResponse = (raw: ApiWizardSession): IZ2mWizardSession => ({
	id: raw.id,
	bridgeOnline: raw.bridgeOnline,
	startedAt: raw.startedAt,
	permitJoin: {
		active: raw.permitJoin.active,
		expiresAt: raw.permitJoin.expiresAt ?? null,
		remainingSeconds: raw.permitJoin.remainingSeconds,
	},
	devices: raw.devices.map(transformWizardDevice),
});

export const transformWizardAdoptionResponse = (raw: ApiWizardAdoption): IZ2mWizardAdoptionResult[] =>
	raw.results.map((result) => ({
		ieeeAddress: result.ieeeAddress,
		name: result.name,
		status: result.status as IZ2mWizardAdoptionResult['status'],
		error: result.error ?? null,
	}));

// ============================================================================
// Request Transformers
// ============================================================================

interface ApiWizardAdoptRequestData {
	devices: Array<{
		ieeeAddress: string;
		name: string;
		category: string;
	}>;
}

export interface ApiWizardAdoptRequest {
	data: ApiWizardAdoptRequestData;
}

export const transformWizardAdoptRequest = (devices: IZ2mWizardAdoptDevice[]): ApiWizardAdoptRequest => ({
	data: {
		devices: devices.map((device) => ({
			ieeeAddress: device.ieeeAddress,
			name: device.name,
			category: device.category,
		})),
	},
});
