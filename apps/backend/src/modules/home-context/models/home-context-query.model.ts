import { HomeContextProfile } from '../home-context.constants';

export type { HomeContextProfile } from '../home-context.constants';

export interface HomeSnapshotQuery {
	spaceId?: string;
	profile: HomeContextProfile;
}
