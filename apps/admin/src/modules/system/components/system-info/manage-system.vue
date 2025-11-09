<template>
	<el-row
		justify="center"
		class="cursor-pointer"
		@click="onRestart"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:restart"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.restart') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="restart-info"
			>
				{{ t('systemModule.texts.manage.rebootDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="cursor-pointer"
		@click="onPowerOff"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:power-settings-new"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.powerOff') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="power-off-info"
			>
				{{ t('systemModule.texts.manage.powerOffDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="mb-4 cursor-pointer"
		@click="onFactoryReset"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:vacuum-cleaner"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.factoryReset') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="factory-reset-info"
			>
				{{ t('systemModule.texts.manage.factoryResetDevice') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>

	<el-divider />

	<el-row
		justify="center"
		class="mb-4 cursor-pointer"
		@click="onShowLogs"
	>
		<el-col
			:span="3"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<el-avatar :size="32">
					<icon
						icon="mdi:console"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</div>
		</el-col>
		<el-col :span="19">
			<el-text
				size="large"
				class="block font-600 text-lg"
			>
				{{ t('systemModule.headings.manage.systemLogs') }}
			</el-text>
			<el-text
				class="block"
				data-test-id="factory-reset-info"
			>
				{{ t('systemModule.texts.manage.systemLogs') }}
			</el-text>
		</el-col>
		<el-col
			:span="2"
			class="text-center"
		>
			<div class="flex justify-center items-center h-full">
				<icon
					icon="mdi:keyboard-arrow-right"
					class="w[32px] h[32px]"
				/>
			</div>
		</el-col>
	</el-row>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAvatar, ElCol, ElDivider, ElRow, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSystemActions } from '../../composables/composables';
import { RouteNames } from '../../system.constants';

defineOptions({
	name: 'ManageSystem',
});

const emit = defineEmits<{
	(e: 'close'): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { onRestart, onPowerOff, onFactoryReset } = useSystemActions();

const onShowLogs = (): void => {
	emit('close');

	router.push({ name: RouteNames.SYSTEM_LOGS });
};
</script>
