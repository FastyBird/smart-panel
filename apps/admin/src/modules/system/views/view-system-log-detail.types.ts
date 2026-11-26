import type { ILogEntry } from '../store/logs-entries.store.types';

export interface IViewSystemLogDetailProps {
	/** The route param */
	id: ILogEntry['id'];
	/** In the right pane of the logs rather than on a page of its own */
	inPane?: boolean;
}
