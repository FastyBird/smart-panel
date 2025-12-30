<template>
	<el-table v-loading="fetching" :data="spaces">
		<el-table-column prop="name" :label="t('spacesModule.table.columns.name')" min-width="200">
			<template #default="{ row }">
				<div class="flex items-center gap-2">
					<el-icon v-if="row.icon">
						<icon :icon="row.icon" />
					</el-icon>
					<span>{{ row.name }}</span>
				</div>
			</template>
		</el-table-column>
		<el-table-column prop="type" :label="t('spacesModule.table.columns.type')" width="120">
			<template #default="{ row }">
				<el-tag :type="row.type === 'room' ? 'primary' : 'info'" size="small">
					{{ t(`spacesModule.misc.types.${row.type}`) }}
				</el-tag>
			</template>
		</el-table-column>
		<el-table-column prop="description" :label="t('spacesModule.table.columns.description')" min-width="250">
			<template #default="{ row }">
				{{ row.description ?? '-' }}
			</template>
		</el-table-column>
		<el-table-column :label="t('spacesModule.table.columns.actions')" width="150" align="center">
			<template #default="{ row }">
				<el-button-group>
					<el-button size="small" @click="onView(row)">
						<el-icon>
							<icon icon="mdi:eye" />
						</el-icon>
					</el-button>
					<el-button size="small" @click="onEdit(row)">
						<el-icon>
							<icon icon="mdi:pencil" />
						</el-icon>
					</el-button>
					<el-button size="small" type="danger" @click="onDelete(row)">
						<el-icon>
							<icon icon="mdi:delete" />
						</el-icon>
					</el-button>
				</el-button-group>
			</template>
		</el-table-column>
		<template #empty>
			<el-empty :description="t('spacesModule.table.empty')">
				<el-button type="primary" @click="onAdd">
					{{ t('spacesModule.buttons.add.title') }}
				</el-button>
			</el-empty>
		</template>
	</el-table>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ElButton, ElButtonGroup, ElEmpty, ElIcon, ElMessageBox, ElTable, ElTableColumn, ElTag } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { useSpaces } from '../composables';
import { RouteNames } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';
import { spacesStoreKey, type ISpace } from '../store';

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();

const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);

const { spaces, fetching } = useSpaces();

const onAdd = (): void => {
	router.push({ name: RouteNames.SPACES_EDIT });
};

const onView = (space: ISpace): void => {
	router.push({ name: RouteNames.SPACE, params: { id: space.id } });
};

const onEdit = (space: ISpace): void => {
	router.push({ name: RouteNames.SPACE_EDIT, params: { id: space.id } });
};

const onDelete = async (space: ISpace): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('spacesModule.messages.confirmDelete'), {
			type: 'warning',
		});

		await spacesStore.remove({ id: space.id });
		flashMessage.success(t('spacesModule.messages.removed', { space: space.name }));
	} catch (error: unknown) {
		if (error instanceof SpacesApiException) {
			flashMessage.error(error.message);
		}
		// Otherwise user cancelled - ignore
	}
};
</script>
