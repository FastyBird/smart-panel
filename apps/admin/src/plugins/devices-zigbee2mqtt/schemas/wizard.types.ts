import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export type IZ2mWizardDeviceStatus = 'ready' | 'unsupported' | 'already_registered' | 'failed';

export interface IZ2mWizardPermitJoin {
	active: boolean;
	expiresAt: string | null;
	remainingSeconds: number;
}

export interface IZ2mWizardDevice {
	ieeeAddress: string;
	friendlyName: string;
	manufacturer: string | null;
	model: string | null;
	description: string | null;
	status: IZ2mWizardDeviceStatus;
	categories: DevicesModuleDeviceCategory[];
	suggestedCategory: DevicesModuleDeviceCategory | null;
	previewChannelCount: number;
	previewChannelIdentifiers: string[];
	registeredDeviceId: string | null;
	registeredDeviceName: string | null;
	registeredDeviceCategory: DevicesModuleDeviceCategory | null;
	error: string | null;
	lastSeenAt: string;
}

export interface IZ2mWizardSession {
	id: string;
	bridgeOnline: boolean;
	startedAt: string;
	permitJoin: IZ2mWizardPermitJoin;
	devices: IZ2mWizardDevice[];
}

export interface IZ2mWizardAdoptionResult {
	ieeeAddress: string;
	name: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
}

export interface IZ2mWizardAdoptDevice {
	ieeeAddress: string;
	name: string;
	category: DevicesModuleDeviceCategory;
}
