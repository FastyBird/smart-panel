import { HomeSearchEntityKind, HomeSearchProfile } from '../home-context.constants';

export interface HomeEntitySearchQuery {
	profile: HomeSearchProfile;
	query: string;
	kinds?: HomeSearchEntityKind[];
	spaceId?: string;
	categories?: string[];
	limit?: number;
}
