import type { IMcpClientsSortBy } from '../composables/types';
import type { IMcpClient } from '../schemas/client.types';

export interface IMcpClientsTableProps {
	items: IMcpClient[];
	totalRows: number;
	sortBy: IMcpClientsSortBy | undefined;
	sortDir: 'asc' | 'desc' | null;
	loading: boolean;
	filtersActive: boolean;
	tableHeight?: number;
}
