import type { IExtension } from '../store/extensions.store.types';

export interface IExtensionsTableProps {
	items: IExtension[];
	totalRows: number;
	loading?: boolean;
	filtersActive?: boolean;
	tableHeight?: number;
	sortBy?: 'name' | 'type' | 'kind' | 'enabled';
	sortDir?: 'asc' | 'desc' | null;
}
