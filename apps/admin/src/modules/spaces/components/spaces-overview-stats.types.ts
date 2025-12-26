import type { ISpace } from '../store/spaces.store.types';

export interface ISpacesOverviewStatsProps {
	spaces: ISpace[];
	loading?: boolean;
}
