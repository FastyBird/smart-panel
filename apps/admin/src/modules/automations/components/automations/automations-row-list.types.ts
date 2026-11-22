import type { IAutomation } from '../../store/automations.store.types';

export interface IAutomationsRowListProps {
	items: IAutomation[];
	loading: boolean;
	loadFailed?: boolean;
	/** The list is empty because of the filters, not because there are no automations */
	filtersActive: boolean;
	/** Automations whose Enabled switch is being saved */
	updating: IAutomation['id'][];
	/** Automations being exported right now */
	exporting?: IAutomation['id'][];
}
