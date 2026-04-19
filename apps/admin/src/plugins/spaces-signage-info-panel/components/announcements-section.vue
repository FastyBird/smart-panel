<template>
	<div class="flex flex-col gap-3">
		<el-alert
			v-if="announcements.length === 0"
			:title="t('spacesSignageInfoPanelPlugin.announcements.empty')"
			type="info"
			:closable="false"
			show-icon
		/>

		<el-table
			v-else
			:data="announcements"
			stripe
			size="small"
		>
			<el-table-column
				prop="title"
				:label="t('spacesSignageInfoPanelPlugin.announcements.fields.title')"
			/>
			<el-table-column
				prop="priority"
				width="90"
				:label="t('spacesSignageInfoPanelPlugin.announcements.fields.priority')"
			/>
			<el-table-column
				prop="order"
				width="80"
				:label="t('spacesSignageInfoPanelPlugin.announcements.fields.order')"
			/>
			<el-table-column
				:label="t('spacesSignageInfoPanelPlugin.announcements.fields.activeFrom')"
				width="180"
			>
				<template #default="{ row }">
					<span v-if="row.activeFrom">{{ formatDateTime(row.activeFrom) }}</span>
					<span v-else>—</span>
				</template>
			</el-table-column>
			<el-table-column
				:label="t('spacesSignageInfoPanelPlugin.announcements.fields.activeUntil')"
				width="180"
			>
				<template #default="{ row }">
					<span v-if="row.activeUntil">{{ formatDateTime(row.activeUntil) }}</span>
					<span v-else>—</span>
				</template>
			</el-table-column>
			<el-table-column
				width="150"
				align="right"
			>
				<template #default="{ row }">
					<el-button
						size="small"
						@click="onEdit(row)"
					>
						{{ t('spacesSignageInfoPanelPlugin.announcements.actions.edit') }}
					</el-button>
					<el-button
						size="small"
						type="danger"
						@click="onDelete(row)"
					>
						{{ t('spacesSignageInfoPanelPlugin.announcements.actions.delete') }}
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-button
			type="primary"
			plain
			@click="onAdd"
		>
			<el-icon class="mr-1">
				<icon icon="mdi:plus" />
			</el-icon>
			{{ t('spacesSignageInfoPanelPlugin.announcements.add') }}
		</el-button>

		<el-dialog
			v-model="dialogOpen"
			:title="editing
				? t('spacesSignageInfoPanelPlugin.announcements.actions.edit')
				: t('spacesSignageInfoPanelPlugin.announcements.add')"
			width="520"
		>
			<el-form
				:model="form"
				label-position="top"
				@submit.prevent="onSave"
			>
				<el-form-item
					:label="t('spacesSignageInfoPanelPlugin.announcements.fields.title')"
					required
				>
					<el-input v-model="form.title" />
				</el-form-item>
				<el-form-item :label="t('spacesSignageInfoPanelPlugin.announcements.fields.body')">
					<el-input
						v-model="form.body"
						type="textarea"
						:rows="3"
					/>
				</el-form-item>
				<el-form-item :label="t('spacesSignageInfoPanelPlugin.announcements.fields.icon')">
					<el-input
						v-model="form.icon"
						placeholder="mdi:information"
					/>
				</el-form-item>
				<div class="flex gap-2">
					<el-form-item
						:label="t('spacesSignageInfoPanelPlugin.announcements.fields.priority')"
						class="flex-1"
					>
						<el-input-number
							v-model="form.priority"
							:min="0"
						/>
					</el-form-item>
					<el-form-item
						:label="t('spacesSignageInfoPanelPlugin.announcements.fields.order')"
						class="flex-1"
					>
						<el-input-number
							v-model="form.order"
							:min="0"
						/>
					</el-form-item>
				</div>
				<div class="flex gap-2">
					<el-form-item
						:label="t('spacesSignageInfoPanelPlugin.announcements.fields.activeFrom')"
						class="flex-1"
					>
						<el-date-picker
							v-model="form.activeFrom"
							type="datetime"
							clearable
						/>
					</el-form-item>
					<el-form-item
						:label="t('spacesSignageInfoPanelPlugin.announcements.fields.activeUntil')"
						class="flex-1"
					>
						<el-date-picker
							v-model="form.activeUntil"
							type="datetime"
							clearable
						/>
					</el-form-item>
				</div>
			</el-form>
			<template #footer>
				<el-button @click="dialogOpen = false">
					{{ t('spacesSignageInfoPanelPlugin.announcements.actions.cancel') }}
				</el-button>
				<el-button
					type="primary"
					:loading="saving"
					@click="onSave"
				>
					{{ t('spacesSignageInfoPanelPlugin.announcements.actions.save') }}
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElDatePicker,
	ElDialog,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElInputNumber,
	ElMessageBox,
	ElTable,
	ElTableColumn,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { ISpace } from '../../../modules/spaces';
import { announcementsStoreKey } from '../store/keys';
import type { IAnnouncement } from '../store/announcements.store.types';

const props = defineProps<{ spaceId: ISpace['id'] }>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const store = storesManager.getStore(announcementsStoreKey);

const announcements = computed<IAnnouncement[]>(() => store.listForSpace(props.spaceId));

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref<IAnnouncement | null>(null);

const emptyForm = () => ({
	title: '',
	body: null as string | null,
	icon: null as string | null,
	priority: 0,
	order: 0,
	activeFrom: null as Date | null,
	activeUntil: null as Date | null,
});

const form = reactive(emptyForm());

const resetForm = (): void => {
	Object.assign(form, emptyForm());
};

const onAdd = (): void => {
	editing.value = null;
	resetForm();
	dialogOpen.value = true;
};

const onEdit = (row: IAnnouncement): void => {
	editing.value = row;
	form.title = row.title;
	form.body = row.body;
	form.icon = row.icon;
	form.priority = row.priority;
	form.order = row.order;
	form.activeFrom = row.activeFrom;
	form.activeUntil = row.activeUntil;
	dialogOpen.value = true;
};

const onDelete = async (row: IAnnouncement): Promise<void> => {
	try {
		await ElMessageBox.confirm(
			t('spacesSignageInfoPanelPlugin.announcements.messages.confirmDelete'),
			t('spacesSignageInfoPanelPlugin.announcements.actions.delete'),
			{ type: 'warning' },
		);
	} catch {
		return;
	}

	try {
		await store.remove(props.spaceId, row.id);
		flashMessage.success(t('spacesSignageInfoPanelPlugin.announcements.messages.deleted'));
	} catch {
		flashMessage.error(t('spacesSignageInfoPanelPlugin.announcements.messages.deleteFailed'));
	}
};

const onSave = async (): Promise<void> => {
	if (!form.title.trim()) return;
	if (saving.value) return;

	saving.value = true;

	try {
		if (editing.value) {
			await store.update(props.spaceId, editing.value.id, {
				title: form.title,
				body: form.body,
				icon: form.icon,
				priority: form.priority,
				order: form.order,
				activeFrom: form.activeFrom,
				activeUntil: form.activeUntil,
			});
			flashMessage.success(t('spacesSignageInfoPanelPlugin.announcements.messages.updated'));
		} else {
			await store.create(props.spaceId, {
				title: form.title,
				body: form.body,
				icon: form.icon,
				priority: form.priority,
				order: form.order,
				activeFrom: form.activeFrom,
				activeUntil: form.activeUntil,
			});
			flashMessage.success(t('spacesSignageInfoPanelPlugin.announcements.messages.created'));
		}

		dialogOpen.value = false;
	} catch {
		flashMessage.error(t('spacesSignageInfoPanelPlugin.announcements.messages.saveFailed'));
	} finally {
		saving.value = false;
	}
};

const formatDateTime = (value: Date): string => {
	return value.toLocaleString();
};

onMounted(async () => {
	try {
		await store.fetch(props.spaceId);
	} catch {
		// Errors already logged by the store; leave the table empty on failure.
	}
});
</script>
