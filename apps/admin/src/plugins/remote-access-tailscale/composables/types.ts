import type { ComputedRef } from 'vue';

import type {
	ITailscaleLoginResult,
	ITailscalePrivilegedSetup,
	ITailscaleRequirement,
	ITailscaleSetupJob,
	ITailscaleSetupProgress,
	ITailscaleStatus,
} from '../store/tailscale-status.store.types';

export interface IUseTailscaleStatus {
	status: ComputedRef<ITailscaleStatus | null>;
	requirements: ComputedRef<ITailscaleRequirement[]>;
	setup: ComputedRef<ITailscaleSetupJob | null>;
	privilegedSetup: ComputedRef<ITailscalePrivilegedSetup | null>;
	isLoading: ComputedRef<boolean>;
	isConnecting: ComputedRef<boolean>;
	isDisconnecting: ComputedRef<boolean>;
	isLoggingOut: ComputedRef<boolean>;
	isResettingPreferences: ComputedRef<boolean>;
	fetchStatus: () => Promise<void>;
	refreshStatus: () => Promise<void>;
	connect: () => Promise<ITailscaleStatus>;
	disconnect: () => Promise<ITailscaleStatus>;
	logout: () => Promise<ITailscaleStatus>;
	resetPreferences: () => Promise<ITailscaleStatus>;
}

export interface IUseTailscaleSetup {
	progress: ComputedRef<ITailscaleSetupProgress | null>;
	isInstalling: ComputedRef<boolean>;
	isPolling: ComputedRef<boolean>;
	install: () => Promise<string>;
	startPolling: () => void;
	stopPolling: () => void;
}

export interface IUseTailscaleLogin {
	isLoggingIn: ComputedRef<boolean>;
	isPolling: ComputedRef<boolean>;
	hasPollingTimedOut: ComputedRef<boolean>;
	login: (authKey?: string) => Promise<ITailscaleLoginResult>;
	stopPolling: () => void;
}
