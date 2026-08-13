import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';

export type IHomeAssistantWizardCandidateStatus = 'ready' | 'needs_attention' | 'already_registered' | 'unsupported' | 'failed';

export interface IHomeAssistantWizardCandidate {
	key: string;
	kind: 'device' | 'helper';
	sourceId: string;
	name: string;
	manufacturer: string | null;
	model: string | null;
	status: IHomeAssistantWizardCandidateStatus;
	suggestedCategory: DevicesModuleDeviceCategory | null;
	previewChannelCount: number;
	entityCount: number;
	warningCount: number;
	adoptedDeviceId: string | null;
	error: string | null;
}

export interface IHomeAssistantWizardSession {
	id: string;
	startedAt: string;
	candidates: IHomeAssistantWizardCandidate[];
}

export interface IHomeAssistantWizardAdoptionResult {
	key: string;
	name: string;
	status: 'created' | 'failed';
	error: string | null;
}
