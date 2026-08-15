import { HomeContextProfile } from '../home-context.constants';

export interface HomeWritablePropertiesQuery {
	profile: HomeContextProfile;
}

export interface HomeTriggerTargetsQuery {
	profile: HomeContextProfile;
	includeScenes: boolean;
	includeSpaces: boolean;
}
