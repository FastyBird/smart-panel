import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import type { IUseEntitiesOptions } from './types';
import { useDiscoveredDevice } from './useDiscoveredDevice';
import { useStates } from './useStates';

interface IUseEntitiesOptionsProps {
	deviceId: IHomeAssistantDiscoveredDevice['id'];
}

export const useEntitiesOptions = ({ deviceId }: IUseEntitiesOptionsProps): IUseEntitiesOptions => {
	const { device, fetchDevice } = useDiscoveredDevice({ id: deviceId });
	const { states, fetchStates, areLoading } = useStates();

	const entitiesOptions = computed<{ value: IHomeAssistantState['entityId']; label: IHomeAssistantState['entityId'] | string }[]>(
		(): { value: IHomeAssistantState['entityId']; label: IHomeAssistantState['entityId'] | string }[] => {
			return orderBy<IHomeAssistantState>(
				states.value.filter((state) => (device.value?.entities ?? []).includes(state.entityId)),
				[(state: IHomeAssistantState) => state.entityId],
				['asc']
			).map((state) => ({
				value: state.entityId,
				label: 'friendlyName' in state.attributes ? (state.attributes.friendlyName as string) : state.entityId,
			}));
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
