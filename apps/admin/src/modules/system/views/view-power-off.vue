<template>
	<el-alert
		type="info"
		:closable="false"
		class="my-6!"
		center
	>
		<div class="text-center">
			<span class="font-size-[0.9rem] font-bold">
				{{ t('systemModule.subHeadings.poweredOff') }}
			</span>
			<br />
			{{ t('systemModule.texts.poweredOff') }}
		</div>
	</el-alert>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert } from 'element-plus';

defineOptions({
	name: 'ViewPowerOff',
});

const { t } = useI18n();
</script>
