<template>
	<el-dropdown
		trigger="click"
		@command="onLanguageChange"
	>
		<el-button
			type="primary"
			circle
			link
		>
			<template #icon>
				<icon icon="mdi:translate" />
			</template>
		</el-button>

		<template #dropdown>
			<el-dropdown-menu>
				<el-dropdown-item
					v-for="loc in supportedLocales"
					:key="loc.value"
					:command="loc.value"
					:class="{ 'is-active': loc.value === currentLocale }"
				>
					<span class="mr-2">{{ loc.flag }}</span>
					<span>{{ loc.label }}</span>
				</el-dropdown-item>
			</el-dropdown-menu>
		</template>
	</el-dropdown>
</template>

<script setup lang="ts">
import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { AppLocale } from '../../locales';
import { useLanguage } from '../composables/useLanguage';

defineOptions({
	name: 'LanguageSwitcher',
});

const emit = defineEmits<{
	(e: 'change', locale: AppLocale): void;
}>();

const { currentLocale, supportedLocales } = useLanguage();

const onLanguageChange = (locale: AppLocale): void => {
	currentLocale.value = locale;
	emit('change', locale);
};
</script>

<style scoped>
.is-active {
	color: var(--el-color-primary);
	font-weight: 600;
}
</style>
