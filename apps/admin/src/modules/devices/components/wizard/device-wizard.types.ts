import type { ComputedRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

export type IWizardStep = 'discover' | 'confirm' | 'results';

export type IWizardRowStatus = 'checking' | 'ready' | 'needs_credentials' | 'needs_attention' | 'already_registered' | 'unsupported' | 'failed';

export type IWizardCell =
	| { render: 'text'; value: string; muted?: boolean }
	| { render: 'code'; value: string }
	| { render: 'tag'; value: string; variant?: 'info' | 'success' | 'warning' | 'danger'; tooltip?: string };

export interface IWizardColumn {
	key: string;
	/** Already translated by the adapter. */
	label: string;
	steps: IWizardStep[];
	width?: number;
	minWidth?: number;
	sortable?: boolean;
}

export interface IWizardRow {
	/** Stable identity — hostname for Shelly, ieeeAddress for Zigbee2MQTT. */
	key: string;
	label: string;
	subLabel: string | null;
	identifier: string;
	status: IWizardRowStatus;
	/** Optional text override. Never overrides the tag colour. */
	statusLabel?: string;
	/** The adapter decides; the shell never infers adoptability from status. */
	adoptable: boolean;
	/** Defaults to `status === 'ready'`. Set false for explicit-selection bulk inventories. */
	selectedByDefault?: boolean;
	willUpdate: boolean;
	suggestedName: string;
	suggestedCategory: DevicesModuleDeviceCategory | null;
	categoryOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	cells?: Record<string, IWizardCell>;
}

export interface IWizardBannerControl {
	type: 'banner';
	id: string;
	severity: 'info' | 'warning' | 'error';
	title: string;
	message?: string;
	link?: { label: string; to: RouteLocationRaw };
}

export interface IWizardProgressControl {
	type: 'progress';
	id: string;
	label: string;
	percentage: number;
	state?: 'success' | 'warning';
	/** false keeps the layout slot but hides the content, avoiding a reflow. */
	visible: boolean;
}

export interface IWizardActionControl {
	type: 'action';
	id: string;
	label: string;
	icon: string;
	variant?: 'default' | 'primary' | 'warning';
	disabled?: boolean;
	loading?: boolean;
	handler: () => void | Promise<void>;
}

export interface IWizardFormField {
	key: string;
	label: string;
	placeholder?: string;
	secret?: boolean;
}

export interface IWizardFormControl {
	type: 'form';
	id: string;
	fields: IWizardFormField[];
	submitLabel: string;
	submitIcon?: string;
	submitDisabled: boolean;
	loading?: boolean;
	/** Resolving clears the inputs; rejecting leaves them intact for correction. */
	handler: (values: Record<string, string>) => Promise<void>;
}

export type IWizardControl = IWizardBannerControl | IWizardProgressControl | IWizardActionControl | IWizardFormControl;

export interface IWizardAdoptSelection {
	key: string;
	name: string;
	category: DevicesModuleDeviceCategory;
}

export interface IWizardResult {
	key: string;
	name: string;
	identifier: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
	/** Data source for an IWizardColumn whose `steps` includes 'results'. */
	cells?: Record<string, IWizardCell>;
}

export type IDeviceWizardCapabilities = { addMore: true } | { addMore: false };

interface IDeviceWizardAdapterBase {
	// Identity and labels — all already translated by the adapter.
	title: string;
	subtitle: string;
	breadcrumbLabel: string;
	/** Breadcrumb route param, e.g. 'devices-shelly-ng-plugin'. */
	pluginType: string;
	identifierLabel: string;
	/** Defaults to editable. Selection-only keeps automatic names/categories read-only. */
	confirmationMode?: 'editable' | 'selection-only';

	rows: ComputedRef<IWizardRow[]>;
	results: ComputedRef<IWizardResult[]>;
	columns: IWizardColumn[];
	controls: ComputedRef<IWizardControl[]>;

	/**
	 * Identifies the discovery session the current rows belong to. The shell resets its
	 * selection / name / category state whenever this changes between two non-null values,
	 * so a rescan cannot carry a stale selection into a fresh session. Adapters that only
	 * ever open a new session through `restart()` (which already routes through the shell's
	 * reset) may omit it.
	 */
	sessionKey?: ComputedRef<string | null>;

	/** false renders the loading overlay on the discover step. */
	ready: ComputedRef<boolean>;
	busy: ComputedRef<boolean>;

	// The shell calls start() on mount and dispose() on unmount — adapters must not
	// register their own tryOnMounted / tryOnUnmounted hooks.
	start: () => Promise<void>;
	adopt: (selection: IWizardAdoptSelection[]) => Promise<IWizardResult[]>;
	beforeLeaveDiscover?: () => Promise<void>;
	dispose?: () => Promise<void>;
}

/**
 * A discriminated union on `capabilities.addMore`: an adapter declaring `addMore: true` is
 * required by the compiler to also provide `restart` — `onAddMore`'s `await adapter.restart?.()`
 * would otherwise silently no-op and strand the user on an empty discover step. Adapters that
 * don't support a second round (`addMore: false`) may omit `restart` entirely.
 */
export type IDeviceWizardAdapter =
	| (IDeviceWizardAdapterBase & { capabilities: { addMore: true }; restart: () => Promise<void> })
	| (IDeviceWizardAdapterBase & { capabilities: { addMore: false }; restart?: () => Promise<void> });

export interface IWizardAction {
	id: string;
	label: string;
	/** `warning` reaches the bar only via a promoted `IWizardActionControl`. */
	variant: 'link' | 'default' | 'primary' | 'warning';
	/** Set only on promoted plugin actions; the shell's own actions render label-only. */
	icon?: string;
	disabled?: boolean;
	loading?: boolean;
	handler: () => void | Promise<void>;
}

export interface IDeviceWizardProps {
	adapterFactory: () => IDeviceWizardAdapter;
}

/**
 * Tag colour per normalized status. Owned by the shell so the same status can never render
 * two different ways across plugins.
 */
export const wizardStatusTagType = (status: IWizardRowStatus): 'success' | 'info' | 'warning' | 'danger' => {
	if (status === 'ready') {
		return 'success';
	}

	if (status === 'checking' || status === 'already_registered') {
		return 'info';
	}

	if (status === 'needs_credentials' || status === 'needs_attention' || status === 'unsupported') {
		return 'warning';
	}

	return 'danger';
};

export const wizardResultTagType = (status: IWizardResult['status']): 'success' | 'info' | 'danger' => {
	if (status === 'created') {
		return 'success';
	}

	if (status === 'updated') {
		return 'info';
	}

	return 'danger';
};
