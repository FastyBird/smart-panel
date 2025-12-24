import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType } from '../../../modules/devices';
import type { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { IMappingExposeOverride, IMappingPreviewResponse } from '../schemas/mapping-preview.types';
import type {
	IZigbee2mqttDeviceAddForm,
	IZigbee2mqttDeviceAddMultiStepForm,
	IZigbee2mqttDeviceEditForm,
} from '../schemas/devices.types';
import type { IDiscoveredDeviceOption } from './useDiscoveredDevicesOptions';

export interface IUseDeviceAddForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	model: Reactive<IZigbee2mqttDeviceAddForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDeviceAddFormMultiStep {
	// Step navigation
	activeStep: Ref<'one' | 'two' | 'three' | 'four' | 'five'>;
	reachedSteps: Ref<Set<'one' | 'two' | 'three' | 'four' | 'five'>>;

	// Mapping preview
	preview: Ref<IMappingPreviewResponse | null>;
	suggestedCategory: Ref<DevicesModuleDeviceCategory | null>;
	isPreviewLoading: Ref<boolean>;
	previewError: Ref<Error | null>;

	// Device adoption
	isAdopting: Ref<boolean>;

	// Options
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	devicesOptions: ComputedRef<IDiscoveredDeviceOption[]>;
	devicesOptionsLoading: Ref<boolean>;

	// Override state
	exposeOverrides: Ref<IMappingExposeOverride[]>;

	// Form model
	model: Reactive<IZigbee2mqttDeviceAddMultiStepForm>;
	formChanged: Ref<boolean>;

	// Actions
	submitStep: (step: 'one' | 'two' | 'three' | 'four' | 'five', formEl?: FormInstance) => Promise<'ok' | 'added'>;
	clear: () => void;
	clearPreview: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDeviceEditForm {
	categoriesOptions: ComputedRef<{ value: DevicesModuleDeviceCategory; label: string }[]>;
	model: Reactive<IZigbee2mqttDeviceEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
