import type { IUser } from '../../../users';
import type { FormResultType, LayoutType } from '../../auth.constants';

export type SettingsProfileFormFields = {
	email: string | null;
	firstName: string | null;
	lastName: string | null;
};

export type SettingsProfileFormProps = {
	profile: IUser;
	remoteFormSubmit?: boolean;
	remoteFormResult?: FormResultType;
	remoteFormReset?: boolean;
	layout?: LayoutType;
};
