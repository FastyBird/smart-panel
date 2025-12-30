<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:wizard-hat"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('spacesModule.onboarding.title') }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.onboarding') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="handleCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('spacesModule.onboarding.title')"
		:sub-heading="t('spacesModule.subHeadings.onboarding')"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<div class="flex items-center gap-2">
				<el-button
					v-if="currentStep === 2 && assignableZones.length > 0"
					:type="showAdvancedZones ? 'primary' : 'default'"
					class="px-4!"
					@click="showAdvancedZones = !showAdvancedZones"
				>
					{{ showAdvancedZones ? t('spacesModule.onboarding.basic') : t('spacesModule.onboarding.advanced') }}
				</el-button>
				<el-button
					link
					class="px-4!"
					@click="handleCancel"
				>
					{{ t('spacesModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					v-if="currentStep > 0"
					class="px-4!"
					@click="prevStep"
				>
					{{ t('spacesModule.buttons.previous.title') }}
				</el-button>
				<el-button
					v-if="currentStep < 3"
					type="primary"
					class="px-4!"
					@click="handleNext"
				>
					{{ t('spacesModule.buttons.next.title') }}
				</el-button>
				<el-button
					v-else
					type="primary"
					:loading="isLoading"
					class="px-4!"
					@click="handleFinish"
				>
					{{ t('spacesModule.buttons.finish.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="currentStep"
					finish-status="success"
					align-center
				>
					<el-step :title="t('spacesModule.onboarding.steps.spaces.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.displays.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.devices.title')" />
					<el-step :title="t('spacesModule.onboarding.steps.summary.title')" />
				</el-steps>
			</template>

			
			<div
				v-loading="isLoading"
				class="p-4 max-h-full box-border flex flex-col"
			>
				<!-- Step 1: Spaces -->
				<template v-if="currentStep === 0">
					<el-alert
						type="info"
						:title="t('spacesModule.onboarding.steps.spaces.description')"
						:closable="false"
						show-icon
						class="!mb-4 shrink-0"
					/>

					<el-scrollbar class="flex-1 overflow-hidden h-full">
						<template v-if="proposedSpaces.length > 0">
							<h4 class="my-2 font-medium">
								{{ t('spacesModule.onboarding.steps.spaces.proposed') }}
							</h4>

							<div
								v-for="(space, index) in proposedSpaces"
								:key="index"
								class="flex items-center gap-3 flex-wrap p-2"
							>
								<el-checkbox :model-value="space.selected" @change="() => toggleProposedSpace(index)" />
								<div class="grow-1 flex items-center gap-1 min-w-[150px]">
									<!-- Read mode (default) -->
									<template v-if="!space.editing">
										{{ space.name }}
										<el-button link size="small" @click="handleStartEditingProposedName(index)">
											<el-icon :size="14">
												<icon icon="mdi:pencil" />
											</el-icon>
										</el-button>
									</template>

									<!-- Edit mode -->
									<el-input
										v-else
										:ref="(el: any) => setProposedEditInputRef(index, el)"
										v-model="space.editName"
										size="small"
										class="max-w-[250px]!"
										@keyup.enter="handleConfirmProposedNameEdit(index)"
										@keyup.esc="handleDiscardProposedNameEdit(index)"
										@blur="handleConfirmProposedNameEdit(index)"
									/>
								</div>
								<el-tag size="small" type="info">{{ space.deviceCount }} {{ t('spacesModule.onboarding.devices') }}</el-tag>
								<el-select
									v-model="space.type"
									size="small"
									class="w-[120px]!"
									@change="() => onSpaceTypeChange(space)"
								>
									<el-option :label="t('spacesModule.fields.spaces.type.options.room')" :value="SpaceType.ROOM" />
									<el-option :label="t('spacesModule.fields.spaces.type.options.zone')" :value="SpaceType.ZONE" />
								</el-select>
								<el-select
									v-model="space.category"
									size="small"
									:placeholder="t('spacesModule.fields.spaces.category.placeholder')"
									:clearable="space.type === SpaceType.ROOM"
									:required="space.type === SpaceType.ZONE"
									class="w-[180px]!"
									@change="() => onCategoryChange(space)"
								>
									<!-- Grouped categories for zones -->
									<template v-if="space.type === SpaceType.ZONE">
										<el-option-group
											v-for="group in getCategoryGroups(space.type)"
											:key="group.key"
											:label="t(`spacesModule.fields.spaces.category.groups.${group.key}`)"
										>
											<el-option
												v-for="category in group.categories"
												:key="category"
												:label="t(`spacesModule.fields.spaces.category.options.${category}`)"
												:value="category"
											>
												<span class="flex items-center gap-2">
													<el-icon v-if="getCategoryTemplates(space.type)[category]">
														<icon :icon="getCategoryTemplates(space.type)[category].icon" />
													</el-icon>
													{{ t(`spacesModule.fields.spaces.category.options.${category}`) }}
												</span>
											</el-option>
										</el-option-group>
									</template>
									<!-- Flat list for rooms -->
									<template v-else>
										<el-option
											v-for="category in getCategoryOptions(space.type)"
											:key="category"
											:label="t(`spacesModule.fields.spaces.category.options.${category}`)"
											:value="category"
										>
											<span class="flex items-center gap-2">
												<el-icon v-if="getCategoryTemplates(space.type)[category]">
													<icon :icon="getCategoryTemplates(space.type)[category].icon" />
												</el-icon>
												{{ t(`spacesModule.fields.spaces.category.options.${category}`) }}
											</span>
										</el-option>
									</template>
								</el-select>
								<el-button
									size="small"
									type="warning"
									plain
									@click="removeProposedSpace(index)"
								>
									<template #icon>
										<icon icon="mdi:trash" />
									</template>
								</el-button>
							</div>
						</template>

						<el-alert
							v-else-if="matchedSpaces.length === 0"
							type="info"
							:title="t('spacesModule.onboarding.steps.spaces.noProposals')"
							:closable="false"
							show-icon
							class="!mb-4"
						/>

						<!-- Matched existing spaces (proposals that match existing spaces) -->
						<template v-if="aggregatedMatchedSpaces.length > 0">
							<h4 class="my-2 font-medium">
								{{ t('spacesModule.onboarding.steps.spaces.matchedExisting') }}
							</h4>

							<div
								v-for="aggregated in aggregatedMatchedSpaces"
								:key="aggregated.existingSpace.id"
								class="flex items-center gap-3 flex-wrap p-2"
							>
								<el-checkbox
									:model-value="true"
									disabled
								/>
								<span class="grow-1 min-w-0">
									<template v-if="aggregated.matchCount === 1">
										{{ aggregated.proposedNames[0] }}
										<span class="text-gray-500 text-sm ml-2">
											→ {{ t('spacesModule.onboarding.steps.spaces.matchedWith', { name: aggregated.existingSpace.name }) }}
										</span>
									</template>
									<template v-else>
										<span class="text-gray-600">
											{{ t('spacesModule.onboarding.steps.spaces.multipleMatchedWith', { count: aggregated.matchCount, name: aggregated.existingSpace.name }) }}
										</span>
									</template>
								</span>
								<el-tag size="small" type="info">{{ aggregated.totalDeviceCount }} {{ t('spacesModule.onboarding.devices') }}</el-tag>
								<el-tag size="small" type="success">{{ t('spacesModule.onboarding.steps.spaces.existingTag') }}</el-tag>
							</div>
						</template>

						<template v-if="unmatchedExistingSpaces.length > 0">
							<h4 class="my-2 font-medium">
								{{ t('spacesModule.onboarding.steps.spaces.existing') }}
							</h4>

							<div class="flex flex-wrap gap-2">
								<el-tag v-for="space in unmatchedExistingSpaces" :key="space.id" size="large">
									{{ space.name }}
								</el-tag>
							</div>
						</template>

						<template v-if="customSpaces.length > 0">
							<h4 class="my-2 font-medium">
								{{ t('spacesModule.onboarding.steps.spaces.custom') }}
							</h4>

							<div
								v-for="(space, index) in customSpaces"
								:key="index"
								class="flex items-center gap-3 flex-wrap p-2"
							>
								<el-checkbox :model-value="space.selected" @change="() => toggleCustomSpace(index)" />
								<div class="grow-1 flex items-center gap-1 min-w-[150px]">
									<!-- Read mode (default) -->
									<template v-if="!space.editing">
										{{ space.name }}
										<el-button link size="small" @click="handleStartEditingCustomName(index)">
											<el-icon :size="14">
												<icon icon="mdi:pencil" />
											</el-icon>
										</el-button>
									</template>

									<!-- Edit mode -->
									<el-input
										v-else
										:ref="(el: any) => setCustomEditInputRef(index, el)"
										v-model="space.editName"
										size="small"
										class="max-w-[250px]"
										@keyup.enter="handleConfirmCustomNameEdit(index)"
										@keyup.esc="handleDiscardCustomNameEdit(index)"
										@blur="handleConfirmCustomNameEdit(index)"
									/>
								</div>
								<el-select
									v-model="space.type"
									size="small"
									class="w-[120px]!"
									@change="() => onSpaceTypeChange(space)"
								>
									<el-option :label="t('spacesModule.fields.spaces.type.options.room')" :value="SpaceType.ROOM" />
									<el-option :label="t('spacesModule.fields.spaces.type.options.zone')" :value="SpaceType.ZONE" />
								</el-select>
								<el-select
									v-model="space.category"
									size="small"
									:placeholder="t('spacesModule.fields.spaces.category.placeholder')"
									:clearable="space.type === SpaceType.ROOM"
									:required="space.type === SpaceType.ZONE"
									class="w-[180px]!"
									@change="() => onCategoryChange(space)"
								>
									<!-- Grouped categories for zones -->
									<template v-if="space.type === SpaceType.ZONE">
										<el-option-group
											v-for="group in getCategoryGroups(space.type)"
											:key="group.key"
											:label="t(`spacesModule.fields.spaces.category.groups.${group.key}`)"
										>
											<el-option
												v-for="category in group.categories"
												:key="category"
												:label="t(`spacesModule.fields.spaces.category.options.${category}`)"
												:value="category"
											>
												<span class="flex items-center gap-2">
													<el-icon v-if="getCategoryTemplates(space.type)[category]">
														<icon :icon="getCategoryTemplates(space.type)[category].icon" />
													</el-icon>
													{{ t(`spacesModule.fields.spaces.category.options.${category}`) }}
												</span>
											</el-option>
										</el-option-group>
									</template>
									<!-- Flat list for rooms -->
									<template v-else>
										<el-option
											v-for="category in getCategoryOptions(space.type)"
											:key="category"
											:label="t(`spacesModule.fields.spaces.category.options.${category}`)"
											:value="category"
										>
											<span class="flex items-center gap-2">
												<el-icon v-if="getCategoryTemplates(space.type)[category]">
													<icon :icon="getCategoryTemplates(space.type)[category].icon" />
												</el-icon>
												{{ t(`spacesModule.fields.spaces.category.options.${category}`) }}
											</span>
										</el-option>
									</template>
								</el-select>
								<el-button
									size="small"
									type="warning"
									plain
									@click="removeCustomSpace(index)"
								>
									<template #icon>
										<icon icon="mdi:trash" />
									</template>
								</el-button>
							</div>
						</template>

						<h4 class="my-2 font-medium">
							{{ t('spacesModule.onboarding.steps.spaces.addManual') }}
						</h4>
						<div class="flex items-center gap-3 p-2">
							<el-input v-model="newSpaceName" :placeholder="t('spacesModule.onboarding.steps.spaces.placeholder')" />
							<el-button type="primary" :disabled="!newSpaceName.trim()" @click="handleAddSpace">
								{{ t('spacesModule.buttons.add.title') }}
							</el-button>
						</div>
					</el-scrollbar>
				</template>

				<!-- Step 2: Displays -->
				<template v-if="currentStep === 1">
					<el-alert
						type="info"
						:title="t('spacesModule.onboarding.steps.displays.description')"
						:closable="false"
						show-icon
						class="!mb-4 shrink-0"
					/>

					<el-table :data="sortedDisplays" class="w-full flex-grow" table-layout="fixed">
						<template #empty>
							<div class="h-full w-full leading-normal">
								<el-result class="h-full w-full">
									<template #icon>
										<icon-with-child :size="80">
											<template #primary>
												<icon icon="mdi:monitor" />
											</template>
											<template #secondary>
												<icon icon="mdi:information" />
											</template>
										</icon-with-child>
									</template>

									<template #title>
										{{ t('spacesModule.onboarding.steps.displays.noDisplays') }}
									</template>
								</el-result>
							</div>
						</template>

						<el-table-column prop="name" :label="t('spacesModule.onboarding.displayName')" min-width="200">
							<template #default="{ row }">
								<div>
									<div>{{ row.name || row.id }}</div>
									<div v-if="row.macAddress" class="text-xs text-gray-500 mt-1">
										{{ row.macAddress }}
									</div>
								</div>
							</template>
						</el-table-column>

						<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="250">
							<template #default="{ row }">
								<el-select
									:model-value="displayAssignments[row.id]"
									:placeholder="t('spacesModule.onboarding.selectSpace')"
									clearable
									class="w-full"
									@update:model-value="(val: string | null) => setDisplayAssignment(row.id, val)"
								>
									<el-option
										v-for="space in roomSpaces"
										:key="space.id"
										:label="space.name"
										:value="space.id"
									/>
								</el-select>
							</template>
						</el-table-column>
					</el-table>
				</template>

				<!-- Step 3: Devices -->
				<template v-if="currentStep === 2">
					<el-alert
						type="info"
						:title="t('spacesModule.onboarding.steps.devices.description')"
						:closable="false"
						show-icon
						class="!mb-4 shrink-0"
					/>

					<el-table :data="sortedDevices" class="h-full w-full flex-grow" table-layout="fixed">
						<template #empty>
							<div class="h-full w-full leading-normal">
								<el-result class="h-full w-full">
									<template #icon>
										<icon-with-child :size="80">
											<template #primary>
												<icon icon="mdi:power-plug" />
											</template>
											<template #secondary>
												<icon icon="mdi:information" />
											</template>
										</icon-with-child>
									</template>

									<template #title>
										{{ t('spacesModule.onboarding.steps.devices.noDevices') }}
									</template>
								</el-result>
							</div>
						</template>

						<el-table-column prop="name" :label="t('spacesModule.onboarding.deviceName')" min-width="200">
							<template #default="{ row }">
								<div>
									<div>{{ row.name }}</div>
									<div v-if="row.description" class="text-xs text-gray-500 mt-1">
										{{ row.description }}
									</div>
								</div>
							</template>
						</el-table-column>

						<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="250">
							<template #default="{ row }">
								<el-select
									:model-value="deviceAssignments[row.id]"
									:placeholder="t('spacesModule.onboarding.selectSpace')"
									clearable
									class="w-full"
									@update:model-value="(val: string | null) => setDeviceAssignment(row.id, val)"
								>
									<el-option
										v-for="space in roomSpaces"
										:key="space.id"
										:label="space.name"
										:value="space.id"
									/>
								</el-select>
							</template>
						</el-table-column>

						<!-- Optional zones column (advanced mode) -->
						<el-table-column
							v-if="showAdvancedZones && assignableZones.length > 0"
							:label="t('spacesModule.onboarding.zones')"
							width="250"
						>
							<template #default="{ row }">
								<el-select
									:model-value="zoneAssignments[row.id] || []"
									multiple
									clearable
									collapse-tags
									:placeholder="t('spacesModule.onboarding.selectZones')"
									class="w-full"
									@update:model-value="(val: string[]) => setDeviceZones(row.id, val)"
								>
									<el-option
										v-for="zone in assignableZones"
										:key="zone.id"
										:label="zone.name"
										:value="zone.id"
									/>
								</el-select>
							</template>
						</el-table-column>
					</el-table>
				</template>

				<!-- Step 4: Summary -->
				<template v-if="currentStep === 3">
					<el-alert
						type="info"
						:title="t('spacesModule.onboarding.steps.summary.description')"
						:closable="false"
						show-icon
						class="!mb-4 shrink-0"
					/>

					<div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-center my-4 shrink-0">
						<div>
							<div class="text-2xl font-bold text-blue-600">{{ summary.spaceCount }}</div>
							<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.totalSpaces') }}</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-green-600">{{ summary.assignedDevices }}</div>
							<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.assignedDevices') }}</div>
						</div>
						<el-tooltip
							:content="t('spacesModule.onboarding.summary.clickToAssignDevices')"
							placement="top"
							:disabled="summary.unassignedDevices === 0"
						>
							<div
								:class="{ 'cursor-pointer': summary.unassignedDevices > 0 }"
								@click="summary.unassignedDevices > 0 && (showUnassignedDevicesDialog = true)"
							>
								<div class="text-2xl font-bold text-yellow-600">{{ summary.unassignedDevices }}</div>
								<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.unassignedDevices') }}</div>
							</div>
						</el-tooltip>
						<div>
							<div class="text-2xl font-bold text-green-600">{{ summary.assignedDisplays }}</div>
							<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.assignedDisplays') }}</div>
						</div>
						<el-tooltip
							:content="t('spacesModule.onboarding.summary.clickToAssignDisplays')"
							placement="top"
							:disabled="summary.unassignedDisplays === 0"
						>
							<div
								:class="{ 'cursor-pointer': summary.unassignedDisplays > 0 }"
								@click="summary.unassignedDisplays > 0 && (showUnassignedDisplaysDialog = true)"
							>
								<div class="text-2xl font-bold text-yellow-600">{{ summary.unassignedDisplays }}</div>
								<div class="text-sm text-gray-500">{{ t('spacesModule.onboarding.summary.unassignedDisplays') }}</div>
							</div>
						</el-tooltip>
					</div>

					<template v-if="allSpaces.length > 0">
						<h4 class="mb-2 font-medium">
							{{ t('spacesModule.onboarding.summary.bySpace') }}
						</h4>

						<el-table :data="spaceSummaryData" class="h-full w-full flex-grow" table-layout="fixed">
							<el-table-column prop="name" :label="t('spacesModule.onboarding.spaceName')">
								<template #default="{ row }">
									<span>{{ row.name }}</span>
									<el-tag
										size="small"
										:type="row.type === SpaceType.ROOM ? 'primary' : 'info'"
										class="ml-2"
									>
										{{ row.type === SpaceType.ROOM ? t('spacesModule.misc.types.room') : t('spacesModule.misc.types.zone') }}
									</el-tag>
									<el-tag
										v-if="row.devices === 0 && row.type === SpaceType.ROOM"
										size="small"
										type="warning"
										class="ml-1"
									>
										{{ t('spacesModule.onboarding.summary.noDevices') }}
									</el-tag>
								</template>
							</el-table-column>
							<el-table-column prop="devices" :label="t('spacesModule.onboarding.devices')" width="120" align="center" />
							<el-table-column prop="displays" :label="t('spacesModule.onboarding.displays')" width="120" align="center" />
						</el-table>
					</template>
				</template>

				<!-- Unassigned Devices Dialog -->
				<el-dialog
					v-model="showUnassignedDevicesDialog"
					:title="t('spacesModule.onboarding.summary.unassignedDevicesTitle')"
				>
					<el-table :data="unassignedDevicesList" class="max-h-[70vh] w-full" table-layout="fixed" max-height="70vh" stripe>
						<el-table-column prop="name" :label="t('spacesModule.onboarding.deviceName')" />
						<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="200">
							<template #default="{ row }">
								<el-select
									:model-value="deviceAssignments[row.id]"
									:placeholder="t('spacesModule.onboarding.selectSpace')"
									clearable
									class="w-full"
									@update:model-value="(val: string | null) => setDeviceAssignment(row.id, val)"
								>
									<el-option
										v-for="space in roomSpaces"
										:key="space.id"
										:label="space.name"
										:value="space.id"
									/>
								</el-select>
							</template>
						</el-table-column>
					</el-table>
				</el-dialog>

				<!-- Unassigned Displays Dialog -->
				<el-dialog
					v-model="showUnassignedDisplaysDialog"
					:title="t('spacesModule.onboarding.summary.unassignedDisplaysTitle')"
				>
					<el-table :data="unassignedDisplaysList" class="max-h-[70vh] w-full" table-layout="fixed" max-height="70vh" stripe>
						<el-table-column :label="t('spacesModule.onboarding.displayName')">
							<template #default="{ row }">
								{{ row.name || row.id }}
							</template>
						</el-table-column>
						<el-table-column :label="t('spacesModule.onboarding.assignedSpace')" width="200">
							<template #default="{ row }">
								<el-select
									:model-value="displayAssignments[row.id]"
									:placeholder="t('spacesModule.onboarding.selectSpace')"
									clearable
									class="w-full"
									@update:model-value="(val: string | null) => setDisplayAssignment(row.id, val)"
								>
									<el-option
										v-for="space in roomSpaces"
										:key="space.id"
										:label="space.name"
										:value="space.id"
									/>
								</el-select>
							</template>
						</el-table-column>
					</el-table>
				</el-dialog>
			</div>

			<div
				v-if="!isMDDevice"
				class="mt-6 flex justify-between"
			>
				<el-button v-if="currentStep > 0" @click="prevStep">
					{{ t('spacesModule.buttons.previous.title') }}
				</el-button>
				<div v-else></div>

				<div class="flex gap-2">
					<el-button @click="handleCancel">
						{{ t('spacesModule.buttons.cancel.title') }}
					</el-button>
					<el-button
						v-if="currentStep === 2 && assignableZones.length > 0"
						:type="showAdvancedZones ? 'primary' : 'default'"
						@click="showAdvancedZones = !showAdvancedZones"
					>
						{{ showAdvancedZones ? t('spacesModule.onboarding.basic') : t('spacesModule.onboarding.advanced') }}
					</el-button>
					<el-button v-if="currentStep < 3" type="primary" @click="handleNext">
						{{ t('spacesModule.buttons.next.title') }}
					</el-button>
					<el-button v-else type="primary" :loading="isLoading" @click="handleFinish">
						{{ t('spacesModule.buttons.finish.title') }}
					</el-button>
				</div>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElDialog,
	ElIcon,
	ElInput,
	ElOption,
	ElOptionGroup,
	ElResult,
	ElSelect,
	ElScrollbar,
	ElStep,
	ElSteps,
	ElTable,
	ElTableColumn,
	ElTag,
	ElTooltip,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	IconWithChild,
	ViewHeader,
	useBreakpoints,
	useFlashMessage,
} from '../../../common';
import { useSpaceCategories, useSpacesOnboarding, type DeviceInfo, type DisplayInfo } from '../composables';
import {
	RouteNames,
	SpaceType,
	isValidCategoryForType,
	type SpaceCategory,
} from '../spaces.constants';

const { t } = useI18n();
const router = useRouter();
const flashMessage = useFlashMessage();

const { isMDDevice, isLGDevice } = useBreakpoints();

useMeta({
	title: t('spacesModule.meta.spaces.onboarding.title'),
});

const {
	isLoading,
	currentStep,
	existingSpaces,
	proposedSpaces,
	customSpaces,
	matchedSpaces,
	availableSpaces,
	deviceAssignments,
	displayAssignments,
	zoneAssignments,
	showAdvancedZones,
	assignableZones,
	fetchProposedSpaces,
	fetchDevices,
	fetchDisplays,
	fetchExistingSpaces,
	createDraftSpacesFromProposals,
	createSpacesFromProposals,
	setDeviceAssignment,
	setDisplayAssignment,
	setDeviceZones,
	applyAssignments,
	nextStep,
	prevStep,
	toggleProposedSpace,
	toggleCustomSpace,
	addManualSpace,
	removeProposedSpace,
	removeCustomSpace,
	startEditingProposedName,
	confirmProposedNameEdit,
	discardProposedNameEdit,
	startEditingCustomName,
	confirmCustomNameEdit,
	discardCustomNameEdit,
	initializeDeviceAssignments,
	initializeDisplayAssignments,
	getSummary,
} = useSpacesOnboarding();

const newSpaceName = ref('');
const devices = ref<DeviceInfo[]>([]);
const displays = ref<DisplayInfo[]>([]);
const showUnassignedDevicesDialog = ref(false);
const showUnassignedDisplaysDialog = ref(false);

// Refs for inline edit inputs (to enable autofocus)
const proposedEditInputRefs = ref<Map<number, InstanceType<typeof ElInput> | null>>(new Map());
const customEditInputRefs = ref<Map<number, InstanceType<typeof ElInput> | null>>(new Map());

const setProposedEditInputRef = (index: number, el: InstanceType<typeof ElInput> | null): void => {
	if (el) {
		proposedEditInputRefs.value.set(index, el);
	} else {
		proposedEditInputRefs.value.delete(index);
	}
};

const setCustomEditInputRef = (index: number, el: InstanceType<typeof ElInput> | null): void => {
	if (el) {
		customEditInputRefs.value.set(index, el);
	} else {
		customEditInputRefs.value.delete(index);
	}
};

const handleStartEditingProposedName = async (index: number): Promise<void> => {
	startEditingProposedName(index);
	await nextTick();
	proposedEditInputRefs.value.get(index)?.focus?.();
};

const handleStartEditingCustomName = async (index: number): Promise<void> => {
	startEditingCustomName(index);
	await nextTick();
	customEditInputRefs.value.get(index)?.focus?.();
};

// Sorted displays for Step 2 (alphabetically by name, fallback to id)
const sortedDisplays = computed(() =>
	[...displays.value].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
);

// Sorted devices for Step 3 (alphabetically by name)
const sortedDevices = computed(() =>
	[...devices.value].sort((a, b) => a.name.localeCompare(b.name))
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
			{
				label: t('spacesModule.breadcrumbs.spaces.onboarding'),
				route: router.resolve({ name: RouteNames.SPACES_ONBOARDING }),
			},
		];
	}
);

// Use availableSpaces from composable which handles deduplication
const allSpaces = availableSpaces;

// Only room spaces for device/display assignment (zones cannot have devices directly assigned)
// Sorted alphabetically by name for better UX
const roomSpaces = computed(() =>
	allSpaces.value
		.filter((space) => space.type === SpaceType.ROOM)
		.sort((a, b) => a.name.localeCompare(b.name))
);

// Existing spaces that are NOT already shown in matched spaces section
const unmatchedExistingSpaces = computed(() => {
	const matchedIds = new Set(matchedSpaces.value.map((m) => m.existingSpace.id));
	return existingSpaces.value.filter((space) => !matchedIds.has(space.id));
});

// Aggregate matched spaces by existing space ID to avoid duplicate rows
interface AggregatedMatch {
	existingSpace: (typeof existingSpaces.value)[0];
	proposedNames: string[];
	totalDeviceCount: number;
	matchCount: number;
}

const aggregatedMatchedSpaces = computed<AggregatedMatch[]>(() => {
	const byExistingId = new Map<string, AggregatedMatch>();

	for (const matched of matchedSpaces.value) {
		const existing = byExistingId.get(matched.existingSpace.id);
		if (existing) {
			existing.proposedNames.push(matched.proposedName);
			existing.totalDeviceCount += matched.deviceCount;
			existing.matchCount++;
		} else {
			byExistingId.set(matched.existingSpace.id, {
				existingSpace: matched.existingSpace,
				proposedNames: [matched.proposedName],
				totalDeviceCount: matched.deviceCount,
				matchCount: 1,
			});
		}
	}

	return Array.from(byExistingId.values());
});

const summary = computed(() => getSummary());

const spaceSummaryData = computed(() =>
	allSpaces.value.map((space) => ({
		name: space.name,
		type: space.type,
		devices: summary.value.devicesBySpace[space.id] ?? 0,
		displays: summary.value.displaysBySpace[space.id] ?? 0,
	}))
);

// Unassigned devices for drill-down dialog (sorted alphabetically)
const unassignedDevicesList = computed(() =>
	devices.value
		.filter((d) => !deviceAssignments.value[d.id])
		.sort((a, b) => a.name.localeCompare(b.name))
);

// Unassigned displays for drill-down dialog (sorted alphabetically)
const unassignedDisplaysList = computed(() =>
	displays.value
		.filter((d) => !displayAssignments.value[d.id])
		.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
);

onMounted(async () => {
	try {
		// Fetch existing data
		await fetchExistingSpaces();
		devices.value = await fetchDevices();
		displays.value = await fetchDisplays();

		// Initialize assignments from current data
		initializeDeviceAssignments(devices.value);
		initializeDisplayAssignments(displays.value);

		// Fetch proposed spaces based on device names
		await fetchProposedSpaces();
	} catch {
		flashMessage.error(t('spacesModule.messages.loadError'));
	}
});

const handleAddSpace = (): void => {
	if (newSpaceName.value.trim()) {
		const result = addManualSpace(newSpaceName.value.trim());
		if (result.success) {
			newSpaceName.value = '';
		} else {
			flashMessage.warning(
				t('spacesModule.onboarding.steps.spaces.duplicateWarning', { name: result.duplicateOf })
			);
		}
	}
};

const handleConfirmProposedNameEdit = (index: number): void => {
	const result = confirmProposedNameEdit(index);
	if (result.convertedToMatch) {
		flashMessage.info(t('spacesModule.onboarding.steps.spaces.convertedToMatch'));
	} else if (result.duplicateOf) {
		flashMessage.warning(
			t('spacesModule.onboarding.steps.spaces.duplicateWarning', { name: result.duplicateOf })
		);
	}
};

const handleConfirmCustomNameEdit = (index: number): void => {
	const result = confirmCustomNameEdit(index);
	if (result.convertedToMatch) {
		flashMessage.info(t('spacesModule.onboarding.steps.spaces.convertedToMatch'));
	} else if (result.duplicateOf) {
		flashMessage.warning(
			t('spacesModule.onboarding.steps.spaces.duplicateWarning', { name: result.duplicateOf })
		);
	}
};

const handleDiscardProposedNameEdit = (index: number): void => {
	discardProposedNameEdit(index);
};

const handleDiscardCustomNameEdit = (index: number): void => {
	discardCustomNameEdit(index);
};

// Category helpers from composable
const { getCategoryOptions, getCategoryGroups, getCategoryTemplates } = useSpaceCategories();

const onSpaceTypeChange = (space: { type: SpaceType; category: SpaceCategory | null; description: string | null }): void => {
	// Clear category if it's no longer valid for the new type
	if (space.category && !isValidCategoryForType(space.category, space.type)) {
		space.category = null;
		space.description = null;
	}
};

const onCategoryChange = (space: { type: SpaceType; category: SpaceCategory | null; description: string | null }): void => {
	// Update description from category template when category changes
	if (space.category) {
		const templates = getCategoryTemplates(space.type);
		const template = templates[space.category];
		if (template?.description) {
			space.description = template.description;
		}
	}
};

const validateSpaces = (): boolean => {
	// Check all selected proposed spaces
	for (const space of proposedSpaces.value) {
		if (space.selected && space.type === SpaceType.ZONE && !space.category) {
			flashMessage.error(t('spacesModule.fields.spaces.category.validation.requiredForZone'));
			return false;
		}
	}
	
	// Check all selected custom spaces
	for (const space of customSpaces.value) {
		if (space.selected && space.type === SpaceType.ZONE && !space.category) {
			flashMessage.error(t('spacesModule.fields.spaces.category.validation.requiredForZone'));
			return false;
		}
	}
	
	return true;
};

const handleNext = (): void => {
	if (currentStep.value === 0) {
		// Validate that all zones have categories
		if (!validateSpaces()) {
			return;
		}
		// Create draft spaces when moving to step 2 (devices assignment)
		createDraftSpacesFromProposals();
	}
	nextStep();
};

const handleCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SPACES });
	} else {
		router.push({ name: RouteNames.SPACES });
	}
};

const handleFinish = async (): Promise<void> => {
	try {
		// First, create spaces from proposals and custom spaces
		await createSpacesFromProposals();
		
		// Then, apply device and display assignments
		const result = await applyAssignments();
		
		flashMessage.success(
			t('spacesModule.onboarding.messages.completed', {
				devices: result.devicesAssigned,
				displays: result.displaysAssigned,
			})
		);
		if (isLGDevice.value) {
			router.replace({ name: RouteNames.SPACES });
		} else {
			router.push({ name: RouteNames.SPACES });
		}
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	}
};
</script>
