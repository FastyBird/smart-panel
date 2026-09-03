import type { ComputedRef } from 'vue';

import type { ITailscaleLoginResult, ITailscaleRequirement, ITailscaleSetupProgress, ITailscaleStatus } from '../store/tailscale-status.store.types';

export interface IUseTailscaleStatus {
	status: ComputedRef<ITailscaleStatus | null>;
	requirements: ComputedRef<ITailscaleRequirement[]>;
	isLoading: ComputedRef<boolean>;
	isLoggingOut: ComputedRef<boolean>;
	isResettingPreferences: ComputedRef<boolean>;
	fetchStatus: () => Promise<void>;
	logout: () => Promise<ITailscaleStatus>;
	resetPreferences: () => Promise<ITailscaleStatus>;
}

export interface IUseTailscaleSetup {
	progress: ComputedRef<ITailscaleSetupProgress | null>;
	isInstalling: ComputedRef<boolean>;
	install: () => Promise<string>;
}

export interface IUseTailscaleLogin {
	isLoggingIn: ComputedRef<boolean>;
	isPolling: ComputedRef<boolean>;
	login: (authKey?: string) => Promise<ITailscaleLoginResult>;
	stopPolling: () => void;
}
