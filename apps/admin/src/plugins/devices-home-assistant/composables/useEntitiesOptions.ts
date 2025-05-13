import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { DEVICE_NO_ENTITY } from '../devices-home-assistant.constants';
import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import type { IUseEntitiesOptions } from './types';
import { useDiscoveredDevice } from './useDiscoveredDevice';
import { useStates } from './useStates';

interface IUseEntitiesOptionsProps {
	deviceId: IHomeAssistantDiscoveredDevice['id'];
}

export const useEntitiesOptions = ({ deviceId }: IUseEntitiesOptionsProps): IUseEntitiesOptions => {
	const { t } = useI18n();

	const { device, fetchDevice } = useDiscoveredDevice({ id: deviceId });
	const { states, fetchStates, areLoading } = useStates();

	const entitiesOptions = computed<{ value: IHomeAssistantState['entityId']; label: IHomeAssistantState['entityId'] | string }[]>(
		(): { value: IHomeAssistantState['entityId']; label: IHomeAssistantState['entityId'] | string }[] => {
			const options = orderBy<IHomeAssistantState>(
				states.value.filter((state) => (device.value?.entities ?? []).includes(state.entityId)),
				[(state: IHomeAssistantState) => state.entityId],
				['asc']
			).map((state) => ({
				value: state.entityId,
				label: `HA: ${'friendlyName' in state.attributes ? (state.attributes.friendlyName as string) : state.entityId}`,
			}));

			return [
				{
					value: DEVICE_NO_ENTITY,
					label: t('devicesHomeAssistantPlugin.misc.options.entities.noEntity'),
				},
				...options,
			];
		}
	);

	fetchDevice()
		.then(() => {
			fetchStates().catch(() => {
				// Could be ignored
			});
		})
		.catch(() => {
			// Could be ignored
		});

	return {
		entitiesOptions,
		areLoading,
	};
};
