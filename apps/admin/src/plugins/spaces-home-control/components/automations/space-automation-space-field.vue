<template>
	<el-form-item
		:label="t('spacesHomeControlPlugin.automations.fields.space.title')"
		:error="wrongType ? t('spacesHomeControlPlugin.automations.validation.spaceType') : props.error"
		required
		data-test-field="space_id"
	>
		<space-select
			:model-value="typeof props.modelValue === 'string' && props.modelValue !== '' ? props.modelValue : null"
			:placeholder="t('spacesHomeControlPlugin.automations.fields.space.placeholder')"
			filter="rooms_and_zones"
			:clearable="false"
			:disabled="props.disabled"
			@update:model-value="(spaceId: string | null): void => emit('update:modelValue', spaceId ?? undefined)"
		/>
	</el-form-item>
</template>

<script setup lang="ts">
/*
 * The room or zone a space card points at, picked with the space select of the spaces module. Only rooms
 * and zones are offered: the space cards of the backend act on nothing else.
 */
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElFormItem } from 'element-plus';

import SpaceSelect from '../../../../modules/spaces/components/space-select.vue';
import { useSpaces } from '../../../../modules/spaces/composables/useSpaces';
import { SpaceType } from '../../../../modules/spaces/spaces.constants';

import type { ISpaceAutomationSpaceFieldProps } from './space-automation-space-field.types';

defineOptions({
	name: 'SpaceAutomationSpaceField',
});

const props = withDefaults(defineProps<ISpaceAutomationSpaceFieldProps>(), {
	error: undefined,
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:modelValue', spaceId: string | undefined): void;
}>();

const { t } = useI18n();

const { fetching, firstLoadFinished, fetchSpaces, findById } = useSpaces();

// The space cards act on rooms and zones only; a stored space of another type is shown, and flagged
const wrongType = computed<boolean>((): boolean => {
	const space = typeof props.modelValue === 'string' && props.modelValue !== '' ? findById(props.modelValue) : null;

	return space !== null && space.type !== SpaceType.ROOM && space.type !== SpaceType.ZONE;
});

onBeforeMount((): void => {
	if (!firstLoadFinished.value && !fetching.value) {
		// The select stays empty and the summaries say "unknown space"; opening the form again tries again
		fetchSpaces().catch((): void => undefined);
	}
});
</script>
