import { type EffectScope, type Ref, effectScope, onScopeDispose, watch } from 'vue';

interface StatusSnapshot {
	epoch?: string;
	revision?: number;
	state: string;
}

interface StatusSource<T extends StatusSnapshot> {
	data: Ref<T | null>;
	semaphore: Ref<{ getting: boolean }>;
}

interface ReconciliationSession {
	scope: EffectScope;
	subscribers: number;
}

const sessions = new WeakMap<object, ReconciliationSession>();
const ACTIVE_RECONCILIATION_INTERVAL_MS = 5_000;

/**
 * Share private-status reconciliation between all mounted consumers of one provider store.
 * All subscribers for a store must supply refs to the same store state and an equivalent,
 * store-only operation predicate. The session retains the first subscriber's arguments until
 * the last subscriber leaves; they must not capture component-local state or lifecycle.
 */
export const useRemoteAccessStatusReconciliation = <T extends StatusSnapshot>(
	store: { get: () => Promise<unknown> },
	source: StatusSource<T>,
	hasOperation: () => boolean = () => false
): void => {
	let session = sessions.get(store);

	if (!session) {
		const scope = effectScope(true);
		session = { scope, subscribers: 0 };
		sessions.set(store, session);

		scope.run(() => {
			let lastReconciliation = Date.now();
			let reading = false;
			let pendingEvent = false;
			let disposed = false;
			let eventTimer: ReturnType<typeof setTimeout> | null = null;
			const cancelEventRead = (): void => {
				if (eventTimer !== null) clearTimeout(eventTimer);
				eventTimer = null;
			};
			const scheduleEventRead = (): void => {
				cancelEventRead();
				if (disposed || !pendingEvent || reading || source.semaphore.value.getting) return;
				eventTimer = setTimeout(
					() => {
						eventTimer = null;
						void reconcile();
					},
					Math.max(0, ACTIVE_RECONCILIATION_INTERVAL_MS - (Date.now() - lastReconciliation))
				);
			};
			const reconcile = async (): Promise<void> => {
				if (disposed || reading || source.semaphore.value.getting) return;
				const reconcilingEvent = pendingEvent;
				pendingEvent = false;
				cancelEventRead();
				reading = true;
				lastReconciliation = Date.now();
				try {
					await store.get();
				} catch {
					// Retry on the next bounded tick, including when the initial read failed.
					pendingEvent ||= reconcilingEvent;
				} finally {
					lastReconciliation = Date.now();
					reading = false;
					scheduleEventRead();
				}
			};

			// Login/setup pollers share the request budget and reset the cadence on completion.
			// The semaphore does not expose success, so retain queued events for one trailing read
			// after polling stops; failures must not postpone their metadata refresh to the fallback.
			watch(
				() => source.semaphore.value.getting,
				(getting) => {
					cancelEventRead();
					if (!getting) {
						lastReconciliation = Date.now();
						scheduleEventRead();
					}
				},
				{ flush: 'sync' }
			);

			// Every backend observation publishes a revision, even when the public state is unchanged.
			// Coalesce events behind the active cadence; GET commits and their matching echoes do not
			// queue another read. Explicit store refresh/action paths remain independent of this worker.
			watch(
				[() => source.data.value?.epoch, () => source.data.value?.revision],
				() => {
					if (reading || source.semaphore.value.getting) return;
					pendingEvent = true;
					scheduleEventRead();
				},
				{ flush: 'sync' }
			);
			const timer = setInterval(() => {
				const progressing = hasOperation() || ['connecting', 'pending-auth', 'pending-approval'].includes(source.data.value?.state ?? '');
				if (Date.now() - lastReconciliation >= (progressing || pendingEvent ? ACTIVE_RECONCILIATION_INTERVAL_MS : 30_000)) void reconcile();
			}, ACTIVE_RECONCILIATION_INTERVAL_MS);
			onScopeDispose(() => {
				disposed = true;
				clearInterval(timer);
				cancelEventRead();
			});
		});
	}

	const subscription = session;
	subscription.subscribers++;
	onScopeDispose(() => {
		if (--subscription.subscribers === 0) {
			subscription.scope.stop();
			sessions.delete(store);
		}
	});
};
