import type { ISpace } from '../store/spaces.store.types';

export interface ISpacesOverviewCategoriesProps {
	spaces: ISpace[];
	loading?: boolean;
}
