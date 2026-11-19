<template>
	<el-table
		:data="camera.profiles"
		row-key="id"
		size="small"
		data-test-id="camera-profiles-table"
	>
		<el-table-column
			prop="id"
			:label="t('camerasModule.profiles.columns.name')"
			min-width="110"
		/>

		<el-table-column
			:label="t('camerasModule.profiles.columns.resolution')"
			min-width="120"
		>
			<template #default="{ row }">
				{{ resolution(row) }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('camerasModule.profiles.columns.fps')"
			min-width="70"
		>
			<template #default="{ row }">
				{{ row.fps ?? EMPTY }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('camerasModule.profiles.columns.videoCodec')"
			min-width="110"
		>
			<template #default="{ row }">
				{{ row.videoCodec ?? EMPTY }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('camerasModule.profiles.columns.audioCodec')"
			min-width="110"
		>
			<template #default="{ row }">
				{{ row.audioCodec ?? EMPTY }}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('camerasModule.profiles.columns.availability')"
			min-width="220"
		>
			<template #default="{ row }">
				<el-tag
					:type="row.available ? 'success' : 'warning'"
					size="small"
				>
					{{ row.available ? t('camerasModule.profiles.available') : t('camerasModule.profiles.unavailable') }}
				</el-tag>

				<div
					v-if="!row.available"
					class="mt-1 text-xs"
				>
					{{ reasonSentence(row.unavailableReason) }}
				</div>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, ElTag } from 'element-plus';

import type { ICameraProfile } from '../store';

import type { ICameraProfilesTableProps } from './camera-profiles-table.types';
import { cameraReasonSentenceKey } from './camera-profiles-table.types';

defineOptions({
	name: 'CameraProfilesTable',
});

defineProps<ICameraProfilesTableProps>();

const { t } = useI18n();

const EMPTY = '—';

const resolution = (profile: ICameraProfile): string =>
	profile.width !== null && profile.height !== null ? `${profile.width} × ${profile.height}` : EMPTY;

const reasonSentence = (code: string | null): string => t(cameraReasonSentenceKey(code));
</script>
