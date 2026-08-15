export class HomeCurrentStateCandidateMetadataError extends Error {
	readonly code = 'invalid_state_candidate_metadata';

	constructor(readonly propertyId: string) {
		super(`Home current-state candidate ${propertyId} is missing its channel or device metadata`);
		this.name = HomeCurrentStateCandidateMetadataError.name;
	}
}
