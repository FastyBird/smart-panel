import type { IProtectTestConnection } from '../store/protect.types';

import type { ProtectTestHint, ProtectTrustable } from './protect-config-form.utils';

export interface IProtectTestConnectionProps {
	/** The result of the current host, port and TLS mode only; the form hides a result of another target. */
	result: IProtectTestConnection | null;
	testing?: boolean;
	timedOut?: boolean;
	requestFailed?: boolean;
	/** The backend's reason for refusing the test request, shown under the generic sentence. Never the request itself. */
	requestFailedDetail?: string | null;
	/** Why the test cannot run, or null when it can. */
	hint?: ProtectTestHint | null;
	trustable?: ProtectTrustable;
}
