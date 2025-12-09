import type { IDisplay } from '../store/displays.store.types';

export interface IDisplaysTableProps {
	items: IDisplay[];
	totalRows: number;
	loading: boolean;
	filtersActive: boolean;
	tableHeight?: number;
	sortBy?: 'name' | 'version' | 'screenWidth' | 'createdAt';
	sortDir?: 'asc' | 'desc' | null;
}
