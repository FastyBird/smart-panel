import type {
	DevicesHomeAssistantPluginWizardAdoptionSchema,
	DevicesHomeAssistantPluginWizardSessionSchema,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';
import type { IHomeAssistantWizardAdoptionResult, IHomeAssistantWizardCandidate, IHomeAssistantWizardSession } from '../schemas/wizard.types';

export const transformWizardSessionResponse = (raw: DevicesHomeAssistantPluginWizardSessionSchema): IHomeAssistantWizardSession => ({
	id: raw.id,
	startedAt: raw.startedAt,
	candidates: raw.candidates.map(
		(candidate): IHomeAssistantWizardCandidate => ({
			key: candidate.key,
			kind: candidate.kind,
			sourceId: candidate.sourceId,
			name: candidate.name,
			manufacturer: candidate.manufacturer ?? null,
			model: candidate.model ?? null,
			status: candidate.status,
			suggestedCategory: (candidate.suggestedCategory ?? null) as DevicesModuleDeviceCategory | null,
			previewChannelCount: candidate.previewChannelCount,
			entityCount: candidate.entityCount,
			warningCount: candidate.warningCount,
			adoptedDeviceId: candidate.adoptedDeviceId ?? null,
			error: candidate.error ?? null,
		})
	),
});

export const transformWizardAdoptionResponse = (raw: DevicesHomeAssistantPluginWizardAdoptionSchema): IHomeAssistantWizardAdoptionResult[] =>
	raw.results.map((result) => ({
		key: result.key,
		name: result.name,
		status: result.status,
		error: result.error ?? null,
	}));

export const transformWizardAdoptRequest = (keys: string[]): { data: { keys: string[] } } => ({
	data: { keys },
});
