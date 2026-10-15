import { CoverActionDispatchContext } from '../../../modules/devices/platforms/device.platform';
import { NativeCoverStatus, nativeCoverStatus } from '../contracts/cover-action.contract';

import { GuardedShellyRpcHandler } from './guarded-shelly-rpc';
import { ShellyCoverOrderingService } from './shelly-cover-ordering.service';

/** One pinned session per physical component. Unknown sent RPCs never become an invented drain barrier. */
export class ShellyCoverSession {
	private submitting = false;
	private uncertain = false;
	constructor(
		private readonly rpc: GuardedShellyRpcHandler,
		private readonly componentId: number,
		private readonly identityCurrent: () => boolean,
		private readonly ordering: ShellyCoverOrderingService,
		private readonly physicalIdentity: string,
	) {}
	identityIsCurrent(): boolean {
		return this.identityCurrent() && this.rpc.connected;
	}
	isReady(): boolean {
		return this.identityCurrent() && this.rpc.connected && !this.submitting && !this.uncertain;
	}
	async read(
		isCurrent: () => boolean,
		invalid?: (raw: Readonly<Record<string, unknown>>, observedAt: Date) => Promise<void>,
	): Promise<{ raw: NativeCoverStatus; observedAt: Date } | null> {
		if (!isCurrent() || !this.identityCurrent()) return null;
		const observedAt = new Date();
		const raw = await this.rpc.withSendGuard(
			() => isCurrent() && this.identityCurrent(),
			() => this.rpc.request<unknown>('Cover.GetStatus', { id: this.componentId }),
		);
		if (!isCurrent() || !this.identityCurrent()) return null;
		const validated = nativeCoverStatus(raw, this.componentId);
		if (validated && Object.hasOwn(validated, 'tag') && (validated.tag === null || typeof validated.tag === 'string'))
			return { raw: validated, observedAt };
		await invalid?.(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}, observedAt);
		return null;
	}
	async dispatch(
		action: 'open' | 'close' | 'stop',
		context: CoverActionDispatchContext,
		admit: (raw: NativeCoverStatus, observedAt: Date, preflightState: string) => Promise<boolean>,
		invalid?: (raw: Readonly<Record<string, unknown>>, observedAt: Date) => Promise<void>,
	): Promise<boolean> {
		if (!this.isReady() || !context.isCurrent()) return false;
		this.submitting = true;
		let preflight: Awaited<ReturnType<ShellyCoverSession['read']>>;
		try {
			preflight = await this.read(context.isCurrent, invalid);
			if (
				!preflight ||
				!Object.hasOwn(preflight.raw, 'tag') ||
				!(preflight.raw.tag === null || typeof preflight.raw.tag === 'string') ||
				!context.isCurrent()
			)
				return false;
			// Latch before submission; a timeout/rejection does not prove the device did not execute.
			const token = await this.ordering.reserve(this.physicalIdentity);
			if (!token) return false;
			if (!context.isCurrent()) {
				await this.ordering.settle(this.physicalIdentity, token);
				return false;
			} // no request submitted
			this.uncertain = true;
			const result = await this.rpc.withSendGuard(context.isCurrent, () =>
				this.rpc.request<unknown>(`Cover.${action === 'open' ? 'Open' : action === 'close' ? 'Close' : 'Stop'}`, {
					id: this.componentId,
					tag: context.tag,
				}),
			);
			if (result !== null) return false;
			await this.ordering.settle(this.physicalIdentity, token);
			this.uncertain = false; // matched successful RPC response establishes submission order, not physical completion
			if (!context.isCurrent()) return false;
			context.accepted();
		} catch {
			return false;
		} finally {
			this.submitting = false;
		}
		while (context.isCurrent() && this.identityCurrent()) {
			try {
				const status = await this.read(context.isCurrent, invalid);
				if (!context.isCurrent()) return false;
				if (status && (await admit(status.raw, status.observedAt, preflight.raw.state))) return true;
			} catch {
				return false;
			}
			await new Promise<void>((resolve) => setTimeout(resolve, 50));
		}
		return false;
	}
}
