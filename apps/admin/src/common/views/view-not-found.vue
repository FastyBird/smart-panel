<template>
	<div class="flex flex-col items-center justify-center w-full h-full">
		<el-result>
			<template #icon>
				<icon-with-child
					type="primary"
					:size="80"
				>
					<template #primary>
						<icon icon="mdi:file-search-outline" />
					</template>
					<template #secondary>
						<icon icon="mdi:help" />
					</template>
				</icon-with-child>
			</template>

			<template #title>
				<h1>{{ t('application.headings.notFound') }}</h1>
			</template>

			<template #sub-title>
				{{ t('application.messages.notFound') }}
			</template>

			<template #extra>
				<el-button
					type="primary"
					@click="router.push({ name: RouteNames.ROOT })"
				>
					{{ t('application.buttons.home.title') }}
				</el-button>
			</template>
		</el-result>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElResult } from 'element-plus';

import { Icon } from '@iconify/vue';

import { RouteNames } from '../../app.constants';
import IconWithChild from '../components/icon-with-child.vue';

defineOptions({
	name: 'ViewNotFound',
});

const { t } = useI18n();
const router = useRouter();
</script>
