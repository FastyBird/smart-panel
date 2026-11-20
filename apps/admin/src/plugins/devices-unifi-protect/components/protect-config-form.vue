<template>
	<div />
</template>

<script setup lang="ts">
import type { FormResultType, IPluginConfigEditFormProps } from '../../../modules/config';

// Placeholder registered as `pluginConfigEditForm`; the settings form replaces it.
defineOptions({
	name: 'ProtectConfigForm',
});

defineProps<IPluginConfigEditFormProps>();

defineEmits<{
	(e: 'update:remote-form-submit', value: boolean): void;
	(e: 'update:remote-form-result', value: FormResultType): void;
	(e: 'update:remote-form-reset', value: boolean): void;
	(e: 'update:remote-form-changed', value: boolean): void;
}>();
</script>
