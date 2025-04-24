<template>
	<div
		v-if="error"
		class="flex flex-col justify-center w-full h-full"
	>
		<el-result>
			<template #icon>
				<icon-with-child
					type="primary"
					:size="80"
				>
					<template #primary>
						<slot name="icon" />
					</template>
					<template #secondary>
						<icon icon="mdi:error" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				<h1>{{ t('application.headings.loadingFailed') }}</h1>
			</template>

			<template #sub-title>
				<slot name="message" />
			</template>
		</el-result>
	</div>

	<template v-else>
		<slot />
	</template>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElResult } from 'element-plus';

import { Icon } from '@iconify/vue';

import IconWithChild from './icon-with-child.vue';

defineOptions({
	name: 'ViewError',
});

const { t } = useI18n();

const error = ref<unknown | null>(null);

onErrorCaptured((err: unknown, _vm: ComponentPublicInstance | null, info: string): boolean => {
	error.value = err;

	console.error(err, info);

	return false; // prevent further propagation
});
</script>
