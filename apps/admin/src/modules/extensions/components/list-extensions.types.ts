import type { IExtensionsFilter } from '../composables/types';
import type { IExtension } from '../store/extensions.store.types';

export interface IListExtensionsProps {
	items: IExtension[];
	loading?: boolean;
	filtersActive?: boolean;
	filters: IExtensionsFilter;
	viewMode: 'table' | 'cards';
	sortBy?: 'name' | 'type' | 'kind' | 'enabled';
	sortDir?: 'asc' | 'desc' | null;
}
