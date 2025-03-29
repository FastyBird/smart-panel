import type { Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType } from '../../../modules/devices-module';
import { DevicesDeviceCategory } from '../../../openapi';
import type { IThirdPartyDevice } from '../store';

export interface IThirdPartyDeviceAddForm {
	id: IThirdPartyDevice['id'];
	type: string;
	category: DevicesDeviceCategory;
	name: string;
	description: string;
	serviceAddress: string;
}

export interface IThirdPartyDeviceEditForm {
	id: IThirdPartyDevice['id'];
	type: string;
	category: DevicesDeviceCategory;
	name: string;
	description: string;
	serviceAddress: string;
}

export interface IUseThirdPartyDeviceAddForm {
	categoriesOptions: { value: DevicesDeviceCategory; label: string }[];
	model: IThirdPartyDeviceAddForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseThirdPartyDeviceEditForm {
	categoriesOptions: { value: DevicesDeviceCategory; label: string }[];
	model: IThirdPartyDeviceEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
