import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { type IDevice } from '../../../modules/devices';
import { useDeviceEditFormSubmit } from '../../../modules/devices/composables/useDeviceEditFormSubmit';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DevicesWledValidationException } from '../devices-wled.exceptions';
import { WledDeviceEditFormSchema } from '../schemas/devices.schemas';
import type { IWledDeviceEditForm } from '../schemas/devices.types';

import type { IUseDeviceEditForm } from './types';

interface IUseDeviceEditFormProps {
	device: IDevice;
	messages?: { success?: string; error?: string };
}

// WLED LED controllers typically fall into these categories
const WLED_CATEGORIES = [DevicesModuleDeviceCategory.lighting];

export const useDeviceEditForm = ({ device, messages }: IUseDeviceEditFormProps): IUseDeviceEditForm => {
	const { t } = useI18n();

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(
		(): { value: DevicesModuleDeviceCategory; label: string }[] => {
			return orderBy(WLED_CATEGORIES, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map((value) => ({
				value,
				label: t(`devicesModule.categories.devices.${value}`),
			}));
		}
	);

	const model = reactive<IWledDeviceEditForm>(device as unknown as IWledDeviceEditForm);

	const { formEl, formChanged, submit, clear, formResult } = useDeviceEditFormSubmit({
		device,
		model,
		messages,
		messagePrefix: 'devicesWledPlugin',
		parseModel: () => WledDeviceEditFormSchema.safeParse(model),
		validationException: DevicesWledValidationException,
	});

	return {
		categoriesOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
