import { IDevicePropertyData } from '../platforms/device.platform';

import { PropertyCommandAdmissionSnapshot, PropertyCommandEffect } from './property-command-admission.registry.service';
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
		private readonly admission?: PropertyCommandAdmissionSnapshot,
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
		admission?: PropertyCommandAdmissionSnapshot,
	): PropertyCommandEntrySnapshot {
		return new PropertyCommandEntrySnapshot(windows, onDispose, saturated, admission);
	}

	/** Checks lifetime bounds, and captured ownership when a physical leaf is supplied. */
	isActive(update?: IDevicePropertyData): boolean {
		return (
			minted.has(this) &&
			!this.stopped &&
			!this.overflow &&
			(update
				? (this.admission?.isCurrent(update) ?? true)
				: (this.admission?.isRequestCurrent?.() ?? this.admission?.isCurrent() ?? true)) &&
			Date.now() < this.deadlineAt
		);
	}

	/** Validates captured ownership without extending the request lifetime. */
	async assertAllowed(update: IDevicePropertyData): Promise<void> {
		if (!this.isActive(update)) throw new Error('Command entry admission changed or expired');
		await this.admission?.assertAllowed(update);
	}

	isEffectActive(effect: PropertyCommandEffect): boolean {
		return this.isActive() && (!this.admission || this.admission.isEffectCurrent?.(effect) === true);
	}
	async assertEffectAllowed(effect: PropertyCommandEffect): Promise<void> {
		if (!this.isEffectActive(effect)) throw new Error('Command entry effect admission changed or is unsupported');
		await this.admission?.assertEffectAllowed?.(effect);
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
