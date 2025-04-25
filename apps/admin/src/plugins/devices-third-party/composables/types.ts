import type { Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import type { IThirdPartyDevice } from '../store/devices.store.types';

export interface IThirdPartyDeviceAddForm {
	id: IThirdPartyDevice['id'];
	type: string;
	category: DevicesModuleDeviceCategory;
	name: string;
	description: string;
	serviceAddress: string;
}

export interface IThirdPartyDeviceEditForm {
	id: IThirdPartyDevice['id'];
	type: string;
	category: DevicesModuleDeviceCategory;
	name: string;
	description: string;
	serviceAddress: string;
}

export interface IUseThirdPartyDeviceAddForm {
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	model: IThirdPartyDeviceAddForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseThirdPartyDeviceEditForm {
	categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[];
	model: IThirdPartyDeviceEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
