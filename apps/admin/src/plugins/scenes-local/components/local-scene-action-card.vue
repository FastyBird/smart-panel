<template>
	<span
		class="inline-flex items-center max-w-40 h-6 px-2 rounded-full bg-fill-light text-label truncate"
		:title="formattedValue"
		data-test-id="local-scene-action-value"
	>
		{{ formattedValue }}
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ISceneActionCardProps } from '../../../modules/scenes/components/actions/scene-action-card.types';

/*
 * Spec section 7, sceneActionCard: the scene's action list draws the row, the domain icon and the device → channel →
 * property path; this plugin adds only the value the action sets
 */

defineOptions({
	name: 'LocalSceneActionCard',
});

const props = defineProps<ISceneActionCardProps>();

const { t } = useI18n();

// The value at the root (camelCase), older actions keep it in the configuration
const value = computed<unknown>((): unknown => props.action.value ?? props.action.configuration?.value);

const formattedValue = computed<string>((): string => {
	if (typeof value.value === 'boolean') {
		return value.value ? t('scenesLocalPlugin.actionCard.on') : t('scenesLocalPlugin.actionCard.off');
	}

	return value.value === null || value.value === undefined ? '' : String(value.value);
});
</script>
