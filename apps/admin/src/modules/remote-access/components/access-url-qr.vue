<template>
	<div class="flex flex-col gap-2">
		<!-- A text toggle: icon-only buttons are for edit, delete, refresh, copy and more -->
		<div class="flex">
			<el-button
				:aria-expanded="props.open ? 'true' : 'false'"
				text
				size="small"
				data-test-id="access-url-qr-toggle"
				@click="emit('toggle')"
			>
				<template #icon>
					<icon icon="mdi:qrcode" />
				</template>
				{{ props.open ? t('remoteAccessModule.buttons.hideQr.title') : t('remoteAccessModule.buttons.showQr.title') }}
			</el-button>
		</div>

		<div
			v-if="props.open && props.image"
			class="flex justify-center"
		>
			<img
				:src="props.image"
				:alt="t('remoteAccessModule.texts.qrAlt')"
				width="180"
				height="180"
				data-test-id="access-url-qr"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

defineOptions({
	name: 'AccessUrlQr',
});

const props = withDefaults(defineProps<{ open: boolean; image?: string }>(), {
	image: undefined,
});

const emit = defineEmits<{
	(e: 'toggle'): void;
}>();

const { t } = useI18n();
</script>
