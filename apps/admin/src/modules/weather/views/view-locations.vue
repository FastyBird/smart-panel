<template>
	<div class="flex flex-col h-full p-4">
		<div class="flex justify-between items-center mb-4">
			<h2 class="text-xl font-semibold">{{ t('weatherModule.headings.locations.list') }}</h2>
			<el-button
				type="primary"
				@click="showAddDialog = true"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>
				{{ t('weatherModule.buttons.addLocation.title') }}
			</el-button>
		</div>

		<list-locations
			:items="locations"
			:loading="areLoading"
			@edit="onEdit"
			@remove="onRemove"
		/>

		<!-- Add Location Dialog -->
		<el-dialog
			v-model="showAddDialog"
			:title="t('weatherModule.headings.locations.add')"
			width="500px"
			:close-on-click-modal="!addFormChanged"
			@close="onAddDialogClose"
		>
			<div class="mb-4">
				<el-form-item :label="t('weatherModule.fields.locations.type.title')">
					<el-select
						v-model="selectedType"
						:placeholder="t('weatherModule.fields.locations.type.placeholder')"
						class="w-full"
					>
						<el-option
							v-for="type in availableTypes"
							:key="type"
							:label="type"
							:value="type"
						/>
					</el-select>
				</el-form-item>
			</div>

			<location-add-form
				v-if="selectedType"
				:id="newLocationId"
				:type="selectedType"
				v-model:remote-form-changed="addFormChanged"
				@cancel="showAddDialog = false"
				@added="onLocationAdded"
			/>
		</el-dialog>

		<!-- Edit Location Dialog -->
		<el-dialog
			v-model="showEditDialog"
			:title="t('weatherModule.headings.locations.edit')"
			width="500px"
			:close-on-click-modal="!editFormChanged"
			@close="onEditDialogClose"
		>
			<location-edit-form
				v-if="editingLocationId"
				:id="editingLocationId"
				v-model:remote-form-changed="editFormChanged"
				@cancel="showEditDialog = false"
				@updated="onLocationUpdated"
			/>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { v4 as uuid } from 'uuid';

import { Icon } from '@iconify/vue';

import ListLocations from '../components/list-locations.vue';
import LocationAddForm from '../components/location-add-form.vue';
import LocationEditForm from '../components/location-edit-form.vue';
import { useLocations } from '../composables/useLocations';
import { useLocationsActions } from '../composables/useLocationsActions';
import type { IWeatherLocation } from '../store/locations.store.types';

defineOptions({
	name: 'ViewLocations',
});

const { t } = useI18n();

const { locations, areLoading, fetchLocations } = useLocations();
const { remove } = useLocationsActions();

// Available location types - in a real implementation this would come from plugins
const availableTypes = ref<string[]>(['weather-openweathermap']);

// Add dialog state
const showAddDialog = ref(false);
const selectedType = ref<string>('');
const newLocationId = ref<string>(uuid());
const addFormChanged = ref(false);

// Edit dialog state
const showEditDialog = ref(false);
const editingLocationId = ref<IWeatherLocation['id'] | null>(null);
const editFormChanged = ref(false);

const onEdit = (id: IWeatherLocation['id']): void => {
	editingLocationId.value = id;
	showEditDialog.value = true;
};

const onRemove = async (id: IWeatherLocation['id']): Promise<void> => {
	await remove(id);
};

const onLocationAdded = (): void => {
	showAddDialog.value = false;
	selectedType.value = '';
	newLocationId.value = uuid();
	addFormChanged.value = false;
};

const onLocationUpdated = (): void => {
	showEditDialog.value = false;
	editingLocationId.value = null;
	editFormChanged.value = false;
};

const onAddDialogClose = (): void => {
	selectedType.value = '';
	newLocationId.value = uuid();
	addFormChanged.value = false;
};

const onEditDialogClose = (): void => {
	editingLocationId.value = null;
	editFormChanged.value = false;
};

onMounted(async () => {
	await fetchLocations();
});
</script>
