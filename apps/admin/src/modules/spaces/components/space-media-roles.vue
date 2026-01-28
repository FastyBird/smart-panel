<template>
	<div :class="{ 'mt-2': !hideHeader }">
		<el-divider v-if="!hideHeader" content-position="left" class="mt-6!">
			{{ t('spacesModule.edit.sections.smartOverrides.mediaRoles') }}
		</el-divider>

		<el-alert type="info" :closable="false" show-icon class="mb-4!">
			{{ t('spacesModule.fields.spaces.mediaRoles.v2Notice') }}
		</el-alert>

		<!-- Media roles editor - API being redesigned to routing-based architecture -->
		<!-- This component will be updated when the new V2 media routing API is available -->
	</div>
</template>

<script setup lang="ts">
import { ElAlert, ElDivider } from 'element-plus';
import { useI18n } from 'vue-i18n';

import type { ISpace } from '../store';

interface IProps {
	space: ISpace;
	hideHeader?: boolean;
}

defineOptions({
	name: 'SpaceMediaRoles',
});

withDefaults(defineProps<IProps>(), {
	hideHeader: false,
});

const { t } = useI18n();

// Note: Media domain now uses routing-based architecture (V2)
// This component will be updated when the new API endpoints are available

const loadMediaTargets = (): Promise<void> => {
	return Promise.resolve();
};

defineExpose({
	reload: loadMediaTargets,
});
</script>
