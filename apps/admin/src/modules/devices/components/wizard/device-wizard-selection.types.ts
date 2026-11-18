import type { RouteLocationRaw } from 'vue-router';

export interface IDeviceWizardSelectionChoice {
	id: string;
	label: string;
	description: string;
	icon: string;
	to: RouteLocationRaw;
	keywords?: string[];
}

export interface IDeviceWizardSelectionSection {
	id: string;
	label: string;
	description: string;
	choices: IDeviceWizardSelectionChoice[];
}
