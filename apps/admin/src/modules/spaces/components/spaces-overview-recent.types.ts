import type { ISpace } from '../store/spaces.store.types';

export interface ISpacesOverviewRecentProps {
	spaces: ISpace[];
	loading?: boolean;
}
