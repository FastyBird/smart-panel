import type { AutomationsSortBy, IAutomationsFilter } from '../../composables/types';
import type { IAutomation } from '../../store/automations.store.types';

export interface IListAutomationsProps {
	items: IAutomation[];
	allItems: IAutomation[];
	totalRows: number;
	filters: IAutomationsFilter;
	filtersActive: boolean;
	paginateSize: number;
	paginatePage: number;
	sortBy: AutomationsSortBy | undefined;
	sortDir: 'asc' | 'desc' | null;
	loading: boolean;
	loadFailed?: boolean;
	updating: IAutomation['id'][];
}
