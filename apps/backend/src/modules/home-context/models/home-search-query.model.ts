import { HomeSearchCandidateCapability, HomeSearchEntityKind, HomeSearchProfile } from '../home-context.constants';

export interface HomeEntitySearchQuery {
	profile: HomeSearchProfile;
	query: string;
	kinds?: HomeSearchEntityKind[];
	spaceId?: string;
	categories?: string[];
	candidateCapability?: HomeSearchCandidateCapability;
	limit?: number;
	/** Opaque by contract but untrusted; filters and visibility are always reapplied. */
	cursor?: string;
}
