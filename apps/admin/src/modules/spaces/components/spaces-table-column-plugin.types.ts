import type { ISpacesFilter } from '../composables/types';
import type { ISpace } from '../store/spaces.store.types';

export interface ISpacesTableColumnPluginProps {
	space: ISpace;
	filters?: ISpacesFilter;
}
