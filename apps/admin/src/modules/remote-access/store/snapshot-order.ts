/** Publication revisions are comparable only within one backend process epoch. */
export interface SnapshotVersion {
	epoch?: string;
	revision?: number;
}

export interface SnapshotRequest {
	generation: number;
	sequence: number;
	epoch: string | null;
}

const MAX_RETIRED_EPOCHS = 32;
const MAX_BUFFERED_COMPONENTS = 32;

export const createSnapshotOrder = () => {
	let epoch: string | null = null;
	let generation = 0;
	let eventSequence = 0;
	let requireResync = false;
	const retired = new Set<string>();
	const revisions = new Map<string, number>();
	const buffered = new Map<string, { component: string; payload: Record<string, unknown> }>();

	const versioned = (value: SnapshotVersion): value is Required<SnapshotVersion> =>
		typeof value.epoch === 'string' && value.epoch.length > 0 && Number.isSafeInteger(value.revision) && value.revision! >= 0;

	const request = (): SnapshotRequest => ({ generation, epoch, sequence: eventSequence });
	const resync = (): void => {
		generation++;
	};
	const currentRequest = (ticket: SnapshotRequest): boolean => ticket.generation === generation;
	const establish = (snapshot: object, ticket?: SnapshotRequest): boolean => {
		const value = snapshot as SnapshotVersion;
		if (ticket && !currentRequest(ticket)) return false;
		if (!versioned(value)) return epoch === null;
		if (retired.has(value.epoch)) return false;
		if (value.epoch !== epoch) {
			// Only a current REST response establishes an epoch. Events cannot distinguish a
			// backend restart from an arbitrarily delayed event emitted by an older process.
			if (!ticket || ticket.epoch !== epoch) return false;
			if (epoch !== null) {
				if (retired.size < MAX_RETIRED_EPOCHS) retired.add(epoch);
				else requireResync = true;
			}
			epoch = value.epoch;
			revisions.clear();
		}
		return true;
	};
	const accept = (snapshot: object, component: string, ticket?: SnapshotRequest): boolean => {
		const value = snapshot as SnapshotVersion;
		if (!establish(value, ticket)) return false;
		if (!versioned(value)) return true;
		const previous = revisions.get(component);
		if (previous !== undefined && value.revision < previous) return false;
		revisions.set(component, value.revision);
		return true;
	};
	const event = (snapshot: object, component: string, payload: Record<string, unknown>, defer = false): 'accept' | 'buffer' | 'reject' => {
		const value = snapshot as SnapshotVersion;
		if (versioned(value) && retired.has(value.epoch)) return 'reject';
		if (versioned(value) && (value.epoch !== epoch || requireResync || defer)) {
			const key = JSON.stringify([value.epoch, component]);
			if (!buffered.has(key) && buffered.size >= MAX_BUFFERED_COMPONENTS) return 'reject';
			const previous = buffered.get(key)?.payload;
			if (!previous || Number(previous.revision) <= value.revision) buffered.set(key, { component, payload });
			eventSequence++;
			return 'buffer';
		}
		if (!accept(value, component)) return 'reject';
		eventSequence++;
		return 'accept';
	};
	const drain = (ticket?: SnapshotRequest): [string, Record<string, unknown>][] => {
		const result: [string, Record<string, unknown>][] = [...buffered.values()]
			.filter(({ payload }) => payload.epoch === epoch)
			.map(({ component, payload }) => [component, payload]);
		for (const [key, { payload }] of buffered) {
			if (payload.epoch === epoch || retired.has(String(payload.epoch)) || !ticket || ticket.sequence === eventSequence) buffered.delete(key);
		}
		// Once history capacity is exhausted, every unknown epoch still requires REST.
		requireResync = false;
		return result;
	};
	const action = (): { sequence: number; revision: number } => ({ sequence: eventSequence, revision: revisions.get('provider') ?? -1 });
	const actionCurrent = (stamp: { sequence: number; revision: number }, ticket: SnapshotRequest): boolean =>
		stamp.sequence === eventSequence && stamp.revision === (revisions.get('provider') ?? -1) && currentRequest(ticket) && ticket.epoch === epoch;

	return {
		request,
		resync,
		currentRequest,
		establish,
		accept,
		event,
		drain,
		action,
		actionCurrent,
		newerThan: (component: string, snapshot: SnapshotVersion): boolean =>
			snapshot.epoch === epoch && (revisions.get(component) ?? -1) > (snapshot.revision ?? -1),
		hasBuffered: () => buffered.size > 0,
	};
};
