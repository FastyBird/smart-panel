import type { ComputedRef, Ref } from 'vue';

import type { ILogEntry } from '../../../system/store/logs-entries.store.types';
import type { IDevice } from '../../store/devices.store.types';

export interface IDeviceLogsProps {
	deviceId: IDevice['id'];
	live?: boolean;
	// Optional: pass composable data from parent to avoid duplicate fetches
	logs?: ComputedRef<ILogEntry[]>;
	hasMore?: Ref<boolean>;
	isLoading?: Ref<boolean>;
	fetchLogs?: () => Promise<void>;
	loadMoreLogs?: () => Promise<void>;
	refreshLogs?: () => Promise<void>;
}
