<template>
	<div data-test-id="modbus-templates-catalog">
		<div class="flex items-center justify-between mb-2">
			<strong>{{ t('devicesModbusPlugin.catalog.heading') }}</strong>
			<el-button
				size="small"
				:loading="reloading"
				:disabled="loading"
				data-test-id="modbus-templates-reload"
				@click="onReload"
			>
				{{ t('devicesModbusPlugin.catalog.reload') }}
			</el-button>
		</div>

		<el-text
			size="small"
			type="info"
			class="block mb-2"
		>
			{{ t('devicesModbusPlugin.catalog.description') }}
		</el-text>

		<el-alert
			v-if="loadError"
			type="error"
			:title="loadError"
			:closable="false"
			show-icon
			data-test-id="modbus-templates-error"
		/>

		<template v-else>
			<el-table
				v-loading="loading"
				:data="catalog?.templates ?? []"
				row-key="id"
				size="small"
				class="w-full"
				:empty-text="t('devicesModbusPlugin.catalog.empty')"
			>
				<el-table-column
					:label="t('devicesModbusPlugin.catalog.table.name')"
					min-width="200"
				>
					<template #default="{ row }: { row: IModbusTemplateSummary }">
						{{ row.name }}
						<el-tag
							v-if="row.overridesBuiltin"
							size="small"
							type="warning"
							class="ml-1"
						>
							{{ t('devicesModbusPlugin.catalog.overridesBuiltin') }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('devicesModbusPlugin.catalog.table.source')"
					width="120"
				>
					<template #default="{ row }: { row: IModbusTemplateSummary }">{{ sourceLabel(row.source) }}</template>
				</el-table-column>
				<el-table-column
					:label="t('devicesModbusPlugin.catalog.table.revision')"
					width="120"
					prop="revision"
				/>
				<el-table-column
					:label="t('devicesModbusPlugin.catalog.table.points')"
					width="90"
					prop="pointCount"
				/>
			</el-table>

			<div
				v-if="catalog && catalog.files.length > 0"
				class="mt-4"
			>
				<strong>{{ t('devicesModbusPlugin.catalog.files.heading') }}</strong>
				<ul class="list-none p-0 m-0 mt-2 space-y-2">
					<li
						v-for="file in catalog.files"
						:key="`${file.source}:${file.path}`"
						:data-test-id="`modbus-template-file-${file.path}`"
					>
						<div>
							<span class="font-mono">{{ file.path }}</span>
							<el-tag
								size="small"
								class="ml-2"
							>
								{{ sourceLabel(file.source) }}
							</el-tag>
							<el-text
								size="small"
								type="info"
								class="ml-2"
							>
								{{ t('devicesModbusPlugin.catalog.files.loaded', { count: file.loaded }) }}
							</el-text>
						</div>
						<el-alert
							v-for="(message, index) in file.errors"
							:key="`e${index}`"
							type="error"
							:title="message"
							:closable="false"
							show-icon
							class="mt-1"
							data-test-id="modbus-template-file-error"
						/>
						<el-alert
							v-for="(message, index) in file.warnings"
							:key="`w${index}`"
							type="warning"
							:title="message"
							:closable="false"
							show-icon
							class="mt-1"
							data-test-id="modbus-template-file-warning"
						/>
					</li>
				</ul>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';

import { injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { modbusTemplatesStoreKey } from '../store/keys';
import type { IModbusTemplateSummary } from '../store/templates.types';

defineOptions({
	name: 'ModbusTemplatesCatalog',
});

const { t } = useI18n();
const flashMessage = useFlashMessage();
const logger = useLogger();
const templatesStore = injectStoresManager().getStore(modbusTemplatesStoreKey);

const catalog = computed(() => templatesStore.catalog);
const loading = ref<boolean>(false);
const reloading = ref<boolean>(false);
const loadError = ref<string | null>(null);

const sourceLabel = (source: string): string =>
	source === 'builtin' || source === 'user' ? t(`devicesModbusPlugin.catalog.source.${source}`) : source;

const errorMessage = (error: unknown, fallback: string): string => (error instanceof Error && error.message !== '' ? error.message : fallback);

onMounted(async (): Promise<void> => {
	loading.value = true;

	try {
		await templatesStore.fetch();
	} catch (error: unknown) {
		logger.error('Failed to load the Modbus device templates', error);

		loadError.value = errorMessage(error, t('devicesModbusPlugin.catalog.loadFailed'));
	} finally {
		loading.value = false;
	}
});

// Reload waits for the initial fetch (the button is disabled meanwhile), so a late fetch result or error can never
// replace the reloaded catalog.
const onReload = async (): Promise<void> => {
	if (loading.value || reloading.value) {
		return;
	}

	reloading.value = true;

	try {
		const reloaded = await templatesStore.reload();

		loadError.value = null;

		flashMessage.success(
			t('devicesModbusPlugin.catalog.reloaded', {
				templates: reloaded.templates.length,
				files: reloaded.files.length,
				errors: reloaded.files.reduce((sum, file) => sum + file.errors.length, 0),
				warnings: reloaded.files.reduce((sum, file) => sum + file.warnings.length, 0),
			})
		);
	} catch (error: unknown) {
		logger.error('Failed to reload the Modbus device templates', error);

		flashMessage.error(errorMessage(error, t('devicesModbusPlugin.catalog.reloadFailed')));
	} finally {
		reloading.value = false;
	}
};
</script>
