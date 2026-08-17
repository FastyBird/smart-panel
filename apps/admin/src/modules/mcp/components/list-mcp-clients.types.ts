import type { IMcpClientsSortBy } from '../composables/types';
import type { IMcpClient } from '../schemas/client.types';

export interface IListMcpClientsProps {
	items: IMcpClient[];
	totalRows: number;
	sortBy: IMcpClientsSortBy | undefined;
	sortDir: 'asc' | 'desc' | null;
	paginateSize: number;
	paginatePage: number;
	loading: boolean;
	filtersActive: boolean;
}
