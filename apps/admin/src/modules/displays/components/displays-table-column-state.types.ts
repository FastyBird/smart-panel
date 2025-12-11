import type { IDisplay } from '../store/displays.store.types';

import type { IDisplaysFilter } from '../composables/types';

export interface IDisplaysTableColumnStateProps {
	display: IDisplay;
	filters: IDisplaysFilter;
}
