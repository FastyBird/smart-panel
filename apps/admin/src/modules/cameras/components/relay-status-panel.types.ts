import type { IRelayStatus } from '../store/relay-status.store.types';

export interface IRelayStatusPanelProps {
	status: IRelayStatus | null;
	/** The status could not be refreshed, so it is only the last known one. */
	stale?: boolean;
}
