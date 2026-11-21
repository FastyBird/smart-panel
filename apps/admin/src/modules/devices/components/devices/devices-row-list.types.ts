import type { IDevice } from '../../store/devices.store.types';

export interface IDevicesRowListProps {
	items: IDevice[];
	loading: boolean;
	/** The list is empty because of the filters, not because there are no devices */
	filtersActive: boolean;
}
