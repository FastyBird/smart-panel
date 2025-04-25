import type { IPagesFilter } from '../../composables/types';
import type { IPage } from '../../store/pages.store.types';

export interface IPagesTableColumnPluginProps {
	page: IPage;
	filters: IPagesFilter;
}
