import type { RouteLocationRaw } from 'vue-router';

import type { TypePickerOption } from '../../../../common';

export interface IDeviceWizardPickerOption extends TypePickerOption {
	/** Where choosing the option leads: the wizard, with its variant when it has several */
	to: RouteLocationRaw;
}
