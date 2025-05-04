import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { MAIN_STATE_ENTITY_ATTRIBUTE } from '../devices-home-assistant.constants';
import type { IHomeAssistantState } from '../store/home-assistant-states.store.types';

import type { IUseAttributesOptions } from './types';
import { useState } from './useState';

interface IUseAttributesOptionsProps {
	entityId: IHomeAssistantState['entityId'];
}

export const useAttributesOptions = ({ entityId }: IUseAttributesOptionsProps): IUseAttributesOptions => {
	const { t } = useI18n();

	const { state, fetchState, isLoading } = useState({ entityId });

	const attributesOptions = computed<{ value: string; label: string }[]>(() => {
		if (!state.value || !state.value.attributes) return [];

		const attributeEntries = Object.entries(state.value.attributes);

		const options = orderBy(
			attributeEntries.map(([key]) => ({
				value: key,
				label: key,
			})),
			['label'],
			['asc']
		);

		return [
			{
				value: MAIN_STATE_ENTITY_ATTRIBUTE,
				label: t('devicesHomeAssistantPlugin.misc.options.attributes.mainState'),
			},
			...options,
		];
	});

	fetchState().catch(() => {
		// Could be ignored
	});

	return {
		attributesOptions,
		isLoading,
	};
};
