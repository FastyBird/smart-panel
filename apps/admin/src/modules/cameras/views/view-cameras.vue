<template>
	<div class="p-4">
		<h1 class="text-xl font-semibold">
			{{ t('camerasModule.headings.cameras') }}
		</h1>

		<p class="text-sm opacity-70">
			{{ t('camerasModule.subHeadings.cameras') }}
		</p>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineOptions({
	name: 'ViewCameras',
});

const { t } = useI18n();
</script>
