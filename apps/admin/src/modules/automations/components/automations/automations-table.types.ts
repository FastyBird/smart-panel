import type { AutomationsSortBy, IAutomationsFilter } from '../../composables/types';
import type { IAutomation } from '../../store/automations.store.types';

export interface IAutomationsTableProps {
	items: IAutomation[];
	totalRows: number;
	filters: IAutomationsFilter;
	filtersActive: boolean;
	tableHeight: number;
	loading: boolean;
	updating: IAutomation['id'][];
	sortBy: AutomationsSortBy | undefined;
	sortDir: 'asc' | 'desc' | null;
}
