import type { IUser } from '../../../users';
import type { FormResultType, LayoutType } from '../../auth.constants';

export type SettingsPasswordFormFields = {
	currentPassword: string;
	newPassword: string;
	repeatPassword: string;
};

export type SettingsPasswordFormProps = {
	profile: IUser;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	layout?: LayoutType;
};
