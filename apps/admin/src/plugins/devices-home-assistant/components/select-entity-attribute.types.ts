import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

export interface ISelectEntityAttributeProps {
	entityId: IHomeAssistantState['entityId'];
	modelValue: string | null | undefined;
	disabled?: boolean;
}
