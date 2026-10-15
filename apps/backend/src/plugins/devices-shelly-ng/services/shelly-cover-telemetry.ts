import { GuardedShellyRpcHandler } from './guarded-shelly-rpc';

/** A notification delta is a refresh trigger, never a synthesized full physical sample. */
export function coverDeltaNeedsRefresh(raw: Record<string, unknown>, id: number): boolean {
	if (['id', 'state', 'current_pos', 'pos_control'].every((field) => Object.hasOwn(raw, field))) return false;
	if (
		(Object.hasOwn(raw, 'id') && raw.id !== id) ||
		(Object.hasOwn(raw, 'state') &&
			(typeof raw.state !== 'string' || !['open', 'closed', 'opening', 'closing', 'stopped'].includes(raw.state))) ||
		(Object.hasOwn(raw, 'current_pos') &&
			(typeof raw.current_pos !== 'number' ||
				!Number.isFinite(raw.current_pos) ||
				raw.current_pos < 0 ||
				raw.current_pos > 100)) ||
		(Object.hasOwn(raw, 'pos_control') && raw.pos_control !== true) ||
		(Object.hasOwn(raw, 'errors') && raw.errors !== null && (!Array.isArray(raw.errors) || raw.errors.length > 0)) ||
		(Object.hasOwn(raw, 'tag') && raw.tag !== null && (typeof raw.tag !== 'string' || raw.tag.length > 20))
	)
		return false;
	return true;
}

/** One bounded in-flight full read per motor, coalesced without cached fields or command authority. */
export class ShellyCoverTelemetry {
	private readonly pending = new Map<string, { revision: number; current: () => boolean }>();
	constructor(
		private readonly rpc: GuardedShellyRpcHandler,
		private readonly emit: (
			key: string,
			raw: Record<string, unknown>,
			observedAt: Date,
			current: () => boolean,
			sourceCurrent: () => boolean,
		) => void,
	) {}
	refresh(key: string, revision: number, current: () => boolean, latest: () => number): void {
		const old = this.pending.get(key);
		if (old?.current()) {
			old.revision = revision;
			return;
		}
		const job = { revision, current };
		this.pending.set(key, job);
		void Promise.resolve().then(async () => {
			const sentRevision = job.revision;
			const observedAt = new Date();
			try {
				if (!current()) return;
				const raw = await this.rpc.withSendGuard(current, () =>
					this.rpc.request<unknown>('Cover.GetStatus', { id: Number(key.split(':')[1]) }),
				);
				if (current() && latest() === sentRevision)
					this.emit(
						key,
						raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {},
						observedAt,
						() => current() && latest() === sentRevision,
						current,
					);
			} catch {
				const invalidatedRevision = job.revision;
				if (current() && latest() === invalidatedRevision)
					this.emit(
						key,
						{ errors: ['source_unavailable'] },
						observedAt,
						() => current() && latest() === invalidatedRevision,
						current,
					);
			} finally {
				if (this.pending.get(key) === job) this.pending.delete(key);
				if (current() && job.revision !== sentRevision) this.refresh(key, job.revision, current, latest);
			}
		});
	}
}
