<template>
	<div class="py-4 px-4 max-w-lg mx-auto">
		<p class="text-gray-500 mb-4">
			{{ t('onboardingModule.spaces.description') }}
		</p>

		<!-- Quick add by category -->
		<div class="mb-4">
			<div class="text-sm font-medium mb-2">{{ t('onboardingModule.spaces.quickAdd') }}</div>
			<div class="flex flex-wrap gap-2">
				<el-button
					v-for="cat in quickCategories"
					:key="cat.value"
					size="small"
					:type="hasCategory(cat.value) ? 'primary' : 'default'"
					:plain="hasCategory(cat.value)"
					@click="toggleCategory(cat.value)"
				>
					<template #icon>
						<icon :icon="cat.icon" />
					</template>
					{{ cat.label }}
				</el-button>
			</div>
		</div>

		<el-divider content-position="left">{{ t('onboardingModule.spaces.orAddCustom') }}</el-divider>

		<!-- Custom space name input -->
		<div class="flex flex-row items-end gap-2 mb-4">
			<el-form-item
				:label="t('onboardingModule.spaces.fields.name')"
				class="flex-1 mb-0!"
			>
				<el-input
					v-model="customName"
					:placeholder="t('onboardingModule.spaces.placeholders.name')"
					@keyup.enter="addCustomSpace"
				/>
			</el-form-item>
			<el-button
				type="primary"
				:disabled="!customName.trim()"
				@click="addCustomSpace"
			>
				{{ t('onboardingModule.spaces.buttons.add') }}
			</el-button>
		</div>

		<!-- Added spaces list -->
		<div
			v-if="spacesToCreate.length > 0"
			class="border border-gray-200 rounded-lg overflow-hidden"
		>
			<div class="text-sm font-medium px-3 py-2 bg-gray-50 border-b border-gray-200">
				{{ t('onboardingModule.spaces.roomsToCreate', { count: spacesToCreate.length }) }}
			</div>
			<div class="divide-y divide-gray-200">
				<div
					v-for="(space, index) in spacesToCreate"
					:key="index"
					class="flex items-center justify-between px-3 py-2"
				>
					<div class="flex items-center gap-2">
						<icon
							v-if="space.icon"
							:icon="space.icon"
							class="text-gray-500"
						/>
						<span>{{ space.name }}</span>
						<el-tag
							v-if="space.category"
							size="small"
							type="info"
						>
							{{ space.category }}
						</el-tag>
					</div>
					<el-button
						text
						type="danger"
						size="small"
						@click="removeSpace(index)"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
					</el-button>
				</div>
			</div>
		</div>

		<el-alert
			type="info"
			:title="t('onboardingModule.spaces.hint')"
			:closable="false"
			show-icon
			class="mt-4!"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDivider, ElFormItem, ElInput, ElTag } from 'element-plus';
import { Icon } from '@iconify/vue';

import { useAppOnboarding } from '../composables/composables';

defineOptions({
	name: 'StepSpaces',
});

const { t } = useI18n();
const { spacesToCreate } = useAppOnboarding();

const customName = ref('');

const quickCategories = [
	{ value: 'living_room', label: t('onboardingModule.spaces.categories.livingRoom'), icon: 'mdi:sofa' },
	{ value: 'bedroom', label: t('onboardingModule.spaces.categories.bedroom'), icon: 'mdi:bed' },
	{ value: 'kitchen', label: t('onboardingModule.spaces.categories.kitchen'), icon: 'mdi:countertop' },
	{ value: 'bathroom', label: t('onboardingModule.spaces.categories.bathroom'), icon: 'mdi:shower' },
	{ value: 'office', label: t('onboardingModule.spaces.categories.office'), icon: 'mdi:desk' },
	{ value: 'hallway', label: t('onboardingModule.spaces.categories.hallway'), icon: 'mdi:door-open' },
	{ value: 'garage', label: t('onboardingModule.spaces.categories.garage'), icon: 'mdi:garage' },
	{ value: 'nursery', label: t('onboardingModule.spaces.categories.nursery'), icon: 'mdi:baby-carriage' },
	{ value: 'guest_room', label: t('onboardingModule.spaces.categories.guestRoom'), icon: 'mdi:bed-outline' },
	{ value: 'dining_room', label: t('onboardingModule.spaces.categories.diningRoom'), icon: 'mdi:silverware-fork-knife' },
];

const hasCategory = (category: string): boolean => {
	return spacesToCreate.some((s) => s.category === category);
};

const categoryToName = (category: string): string => {
	const cat = quickCategories.find((c) => c.value === category);
	return cat?.label ?? category;
};

const categoryToIcon = (category: string): string => {
	const cat = quickCategories.find((c) => c.value === category);
	return cat?.icon ?? 'mdi:home';
};

const toggleCategory = (category: string): void => {
	const existingIndex = spacesToCreate.findIndex((s) => s.category === category);

	if (existingIndex >= 0) {
		spacesToCreate.splice(existingIndex, 1);
	} else {
		spacesToCreate.push({
			name: categoryToName(category),
			category,
			icon: categoryToIcon(category),
		});
	}
};

const addCustomSpace = (): void => {
	const name = customName.value.trim();
	if (!name) return;

	spacesToCreate.push({
		name,
		category: null,
		icon: null,
	});

	customName.value = '';
};

const removeSpace = (index: number): void => {
	spacesToCreate.splice(index, 1);
};
</script>
