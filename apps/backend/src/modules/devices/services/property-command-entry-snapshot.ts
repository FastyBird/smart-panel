import { PropertyCommandWindowService } from './property-command-window.service';

const minted = new WeakSet<PropertyCommandEntrySnapshot>();

/** Server-owned request evidence, never a public request context or an ownership bypass. */
export class PropertyCommandEntrySnapshot {
	private readonly changed = new Set<string>();
	private readonly pending: ReadonlySet<string>;
	private readonly unsubscribe: () => void;
	private readonly timer?: NodeJS.Timeout;
	private stopped = false;
	private references = 1;
	private overflow = false;
	readonly deadlineAt = Date.now() + 30_000;

	private constructor(
		windows: PropertyCommandWindowService,
		private readonly onDispose: () => void,
		saturated: boolean,
	) {
		minted.add(this);
		if (saturated) {
			this.pending = new Set();
			this.unsubscribe = () => undefined;
			this.stopped = true;
			return;
		}
		const initial = windows.snapshotPendingProperties(2048);
		this.pending = initial.ids;
		this.overflow = saturated || initial.overflow;
		this.unsubscribe = windows.observeGeneration((id) => {
			if (this.overflow) return;
			if (!this.changed.has(id) && this.changed.size >= 2048) {
				this.overflow = true;
				return;
			}
			this.changed.add(id);
		});
		this.timer = setTimeout(() => {
			this.dispose();
		}, 30_000);
		this.timer.unref();
	}

	static capture(
		windows: PropertyCommandWindowService,
		onDispose: () => void,
		saturated = false,
	): PropertyCommandEntrySnapshot {
		return new PropertyCommandEntrySnapshot(windows, onDispose, saturated);
	}

	isActive(): boolean {
		return minted.has(this) && !this.stopped && !this.overflow && Date.now() < this.deadlineAt;
	}

	canPreservePower(id: string): boolean {
		return this.isActive() && !this.pending.has(id) && !this.changed.has(id);
	}

	retain(): boolean {
		if (!this.isActive()) return false;
		this.references++;
		return true;
	}

	release(): void {
		this.references = Math.max(0, this.references - 1);
		if (!this.references) this.dispose();
	}

	dispose(): void {
		if (this.stopped) return;
		this.stopped = true;
		this.unsubscribe();
		clearTimeout(this.timer);
		this.onDispose();
	}
}
