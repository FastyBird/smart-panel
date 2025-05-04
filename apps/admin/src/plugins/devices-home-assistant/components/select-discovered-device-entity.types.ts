import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

export interface ISelectDiscoveredDeviceEntityProps {
	deviceId: IHomeAssistantDiscoveredDevice['id'];
	modelValue: IHomeAssistantState['entityId'] | undefined;
	disabled?: boolean;
}
