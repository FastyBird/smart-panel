import type { ComputedRef, Ref } from 'vue';

import type { ILogEntry } from '../../../system/store/logs-entries.store.types';
import type { IDevice } from '../../store/devices.store.types';

// Base props (always required)
interface IDeviceLogsBaseProps {
	deviceId: IDevice['id'];
	live?: boolean;
}

// Standalone mode - component creates its own composable
interface IDeviceLogsStandaloneProps extends IDeviceLogsBaseProps {
	logs?: undefined;
}

// Shared mode - parent passes composable data to avoid duplicate fetches
interface IDeviceLogsSharedProps extends IDeviceLogsBaseProps {
	logs: ComputedRef<ILogEntry[]>;
	hasMore: Ref<boolean>;
	isLoading: Ref<boolean>;
	liveRef: Ref<boolean>;
	fetchLogs: () => Promise<void>;
	loadMoreLogs: () => Promise<void>;
	refreshLogs: () => Promise<void>;
}

export type IDeviceLogsProps = IDeviceLogsStandaloneProps | IDeviceLogsSharedProps;
