import type { ComputedRef } from 'vue';

import type {
	ICloudflareTunnelPrivilegedSetup,
	ICloudflareTunnelRequirement,
	ICloudflareTunnelSetupJob,
	ICloudflareTunnelSetupProgress,
	ICloudflareTunnelStatus,
} from '../store/cloudflare-tunnel-status.store.types';

export interface IUseCloudflareTunnelStatus {
	status: ComputedRef<ICloudflareTunnelStatus | null>;
	requirements: ComputedRef<ICloudflareTunnelRequirement[]>;
	setup: ComputedRef<ICloudflareTunnelSetupJob | null>;
	privilegedSetup: ComputedRef<ICloudflareTunnelPrivilegedSetup | null>;
	isLoading: ComputedRef<boolean>;
	isResetting: ComputedRef<boolean>;
	fetchStatus: () => Promise<void>;
	reset: () => Promise<ICloudflareTunnelStatus>;
}

export interface IUseCloudflareTunnelSetup {
	progress: ComputedRef<ICloudflareTunnelSetupProgress | null>;
	isInstalling: ComputedRef<boolean>;
	isPolling: ComputedRef<boolean>;
	install: () => Promise<string>;
	stopPolling: () => void;
}
