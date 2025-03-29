import type { IDevicesFilter } from '../../composables';
import type { IDevice } from '../../store';

export interface IDevicesTableColumnStateProps {
	device: IDevice;
	filters: IDevicesFilter;
}
