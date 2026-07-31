import type { ComputedRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

export type IWizardStep = 'discover' | 'confirm' | 'results';

export type IWizardRowStatus = 'checking' | 'ready' | 'needs_credentials' | 'already_registered' | 'unsupported' | 'failed';

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

export interface IDeviceWizardCapabilities {
	addMore: boolean;
}

export interface IDeviceWizardAdapter {
	// Identity and labels — all already translated by the adapter.
	title: string;
	subtitle: string;
	breadcrumbLabel: string;
	/** Breadcrumb route param, e.g. 'devices-shelly-ng-plugin'. */
	pluginType: string;
	identifierLabel: string;

	rows: ComputedRef<IWizardRow[]>;
	results: ComputedRef<IWizardResult[]>;
	columns: IWizardColumn[];
	controls: ComputedRef<IWizardControl[]>;

	/** false renders the loading overlay on the discover step. */
	ready: ComputedRef<boolean>;
	busy: ComputedRef<boolean>;

	capabilities: IDeviceWizardCapabilities;

	// The shell calls start() on mount and dispose() on unmount — adapters must not
	// register their own tryOnMounted / tryOnUnmounted hooks.
	start: () => Promise<void>;
	adopt: (selection: IWizardAdoptSelection[]) => Promise<IWizardResult[]>;
	beforeLeaveDiscover?: () => Promise<void>;
	/** Required when capabilities.addMore is true. */
	restart?: () => Promise<void>;
	dispose?: () => Promise<void>;
}

export interface IWizardAction {
	id: string;
	label: string;
	variant: 'link' | 'default' | 'primary';
	disabled?: boolean;
	loading?: boolean;
	handler: () => void | Promise<void>;
}

export interface IDeviceWizardProps {
	adapterFactory: () => IDeviceWizardAdapter;
}
