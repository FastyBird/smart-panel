<template>
	<el-card
		v-if="canAuthor"
		header-class="px-3! py-3! font-bold"
		:class="create ? 'border-0! shadow-none! bg-transparent!' : 'mt-2'"
		:body-class="create ? 'p-0!' : undefined"
		shadow="never"
		data-test-id="virtual-thermostat-editor"
	>
		<template
			v-if="!create"
			#header
		>
			<strong>{{ tt(create ? 'title.create' : 'title.edit') }}</strong>
		</template>
		<el-alert
			v-if="!create"
			type="info"
			:closable="false"
			:title="tt('draft.title')"
			:description="tt('draft.description')"
		/>

		<div
			v-if="loading"
			v-loading="true"
			class="h-20"
		/>
		<template v-else>
			<device-wizard-steps
				v-model="step"
				:enabled="create"
				:steps="stepLabels"
				:can-advance="!busy && !loading && !selectionLoading && !memberContextLoading"
				:before-next="beforeNext"
				:final-actions="wizardFinalActions"
				:dirty="step > 0 || !!name.trim()"
				:disabled="busy"
			>
				<virtual-wizard-layout
					:compact="step === 0"
					:enabled="create"
					:review="step === REVIEW_STEP"
					:title="
						create
							? step === REVIEW_STEP
								? t('devicesVirtualPlugin.wizard.layout.reviewTitle')
								: tt(`wizard.${step === 0 ? 'details' : step === 1 ? 'sources' : step === 2 ? 'actuators' : 'configuration'}Title`)
							: undefined
					"
					:description="
						create
							? step === REVIEW_STEP
								? t('devicesVirtualPlugin.wizard.layout.reviewDescription')
								: tt(`wizard.${step === 0 ? 'details' : step === 1 ? 'sources' : step === 2 ? 'actuators' : 'configuration'}Description`)
							: undefined
					"
					:loading="loading || selectionLoading"
				>
					<div v-show="at(0)">
						<el-form
							v-if="create"
							label-position="top"
							:disabled="busy"
							status-icon
							@submit.prevent
						>
							<el-form-item
								v-if="create"
								:error="validation.error('name')"
								:label="t('devicesModule.fields.devices.name.title')"
								required
							>
								<el-input
									v-model="name"
									:placeholder="t('devicesModule.fields.devices.name.placeholder')"
									name="name"
								/>
							</el-form-item>
							<virtual-placement-fields
								v-if="create"
								v-model:room-id="roomId"
								v-model:zone-ids="zoneIds"
								:suggest-sources="create"
								:disabled="busy"
							/>
						</el-form>
						<div
							v-if="configuration"
							class="mt-3 space-y-2"
						>
							<p>
								{{ tt('revision', { revision: configuration.revision, graph: configuration.graph_revision, readiness: configuration.readiness }) }}
							</p>
							<el-alert
								v-for="reason in configuration.reasons"
								:key="reason"
								type="warning"
								:closable="false"
								:title="reason"
							/>
							<el-alert
								v-for="claim in configuration.actuators"
								:key="claim.id"
								:type="claim.state === 'reserved' ? 'info' : 'warning'"
								:closable="false"
								:title="`${roleLabel(claim.role)}: ${claim.state} · ${claim.physical_identity}`"
								:description="claim.reason ?? undefined"
							/>
							<el-alert
								v-for="source in configuration.sources.filter((entry) => !entry.source_property)"
								:key="source.id"
								type="warning"
								:closable="false"
								:title="tt('missingSource', { role: roleLabel(source.role), identity: source.source_identity })"
							/>
						</div>
					</div>
					<virtual-thermostat-wizard-selection
						v-if="create && (step === 1 || step === 2)"
						:key="step"
						v-model:draft="draft"
						:kind="step === 1 ? 'sources' : 'actuators'"
						:room-id="roomId"
						:zone-ids="zoneIds"
						:disabled="busy"
						@loading="selectionLoading = $event"
					/>
					<div v-if="!create || step === 3">
						<el-divider
							v-if="!create"
							content-position="left"
						>
							{{ tt('requested') }}
						</el-divider>
						<virtual-wizard-card
							:plain="!create"
							:title="tt('requested')"
							icon="mdi:tune"
						>
							<el-form
								label-position="top"
								class="space-y-3"
								:disabled="busy"
								status-icon
							>
								<el-form-item
									:label="tt('requestedMode')"
									required
								>
									<el-select
										v-model="draft.requested_mode"
										class="w-full"
									>
										<el-option
											v-for="mode in modeNames"
											:key="mode"
											:value="mode"
											:label="tt(`modes.${mode}`)"
										/>
									</el-select>
								</el-form-item>
								<div class="thermostat-editor__fields">
									<el-form-item
										v-if="!create || hasHeating"
										:error="
											validation.error('setpointRequired') ||
											(create && !Number.isFinite(draft.policy.heatingSetpoint) ? validation.error('branchMismatch:heating') : '')
										"
										:label="tt('heatingSetpoint')"
										:required="create ? hasHeating : !Number.isFinite(draft.policy.coolingSetpoint)"
									>
										<el-input-number
											v-model="draft.policy.heatingSetpoint"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										v-if="!create || hasCooling"
										:error="
											validation.error('setpointRequired') ||
											(create && !Number.isFinite(draft.policy.coolingSetpoint) ? validation.error('branchMismatch:cooling') : '')
										"
										:label="tt('coolingSetpoint')"
										:required="create ? hasCooling : !Number.isFinite(draft.policy.heatingSetpoint)"
									>
										<el-input-number
											v-model="draft.policy.coolingSetpoint"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										:error="validation.error('coldTolerance')"
										:label="tt('coldTolerance')"
										required
									>
										<el-input-number
											v-model="draft.policy.coldTolerance"
											:min="0"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										:error="validation.error('hotTolerance')"
										:label="tt('hotTolerance')"
										required
									>
										<el-input-number
											v-model="draft.policy.hotTolerance"
											:min="0"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										:error="validation.error('neutralMargin')"
										:label="tt('neutralMargin')"
										required
									>
										<el-input-number
											v-model="draft.policy.neutralMargin"
											:min="0"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										:error="validation.error('minimumOff')"
										:label="tt('minimumOff')"
										required
									>
										<el-input-number
											v-model="draft.policy.minimumOffMs"
											:min="0"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										:error="validation.error('changeover')"
										:label="tt('changeover')"
										required
									>
										<el-input-number
											v-model="draft.policy.changeoverMs"
											:min="0"
											:controls="false"
										/>
									</el-form-item>
								</div>
								<el-checkbox
									v-if="!create"
									:model-value="draft.policy.floor !== null"
									@change="toggleFloor"
								>
									{{ tt('floorProtect') }}
								</el-checkbox>
								<div
									v-if="draft.policy.floor"
									class="thermostat-editor__fields"
								>
									<el-form-item
										:error="validation.error('floorPolicy')"
										:label="tt('floorLimit')"
										required
									>
										<el-input-number
											v-model="draft.policy.floor.limit"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										:error="validation.error('floorPolicy')"
										:label="tt('floorHysteresis')"
										required
									>
										<el-input-number
											v-model="draft.policy.floor.recoveryHysteresis"
											:controls="false"
										/>
									</el-form-item>
								</div>
								<el-checkbox
									:model-value="draft.heuristic !== null"
									@change="toggleTrend"
								>
									{{ tt('trend') }}
								</el-checkbox>
								<div
									v-if="draft.heuristic"
									class="thermostat-editor__fields"
								>
									<el-form-item
										v-for="field in trendFields"
										:key="field.key"
										:error="draft.heuristic && !Number.isFinite(draft.heuristic[field.key]) ? validation.error('trendIncomplete') : ''"
										:label="field.label"
										required
									>
										<el-input-number
											v-model="draft.heuristic[field.key]"
											:controls="false"
										/>
									</el-form-item>
								</div>
								<window-detection-reporting
									v-if="draft.heuristic"
									:property="draft.sources.find((source) => source.role === ThermostatSourceRole.ambient)?.source_property"
									:cadence="draft.heuristic"
								/>
								<div class="thermostat-editor__fields">
									<el-form-item
										v-if="!create || hasContact"
										:error="validation.error('contactDebounce')"
										:label="tt('contactOpening')"
										required
									>
										<el-input-number
											v-model="draft.contact_opening_ms"
											:min="0"
											:controls="false"
										/>
									</el-form-item>
									<el-form-item
										v-if="!create || hasContact"
										:error="validation.error('contactDebounce')"
										:label="tt('contactClosing')"
										required
									>
										<el-input-number
											v-model="draft.contact_closing_ms"
											:min="0"
											:controls="false"
										/>
									</el-form-item>
								</div>
							</el-form>
							<el-alert
								v-if="create"
								:title="tt('wizard.policyHelpTitle')"
								:description="tt('wizard.policyHelp')"
								type="info"
								:closable="false"
								show-icon
							/>
						</virtual-wizard-card>
					</div>
					<el-form
						v-if="!create || step === 3"
						:disabled="busy"
						label-position="top"
						status-icon
					>
						<el-form-item
							:error="validation.error('ambientSource') || validation.error('retainFloorPolicy') || validation.error('contactSourceLimit')"
						/>
						<el-divider
							v-if="!create"
							content-position="left"
						>
							{{ tt('sources.title') }}
						</el-divider>
						<el-checkbox
							v-if="configuration?.sources.some((entry) => entry.role === 'floor')"
							v-model="removeLegacyFloor"
						>
							{{ memberLabel('removeLegacyGuard') }}
						</el-checkbox>
						<virtual-wizard-card
							v-for="(source, index) in draft.sources"
							:key="source.id ?? index"
							class="mb-4"
							icon="mdi:thermometer"
						>
							<template #header>
								<div class="flex items-center justify-between gap-3">
									<strong>
										{{ roleLabel(source.role) }}
										<small v-if="!create && source.id">· {{ source.id }}</small>
									</strong>
									<virtual-wizard-remove-button
										v-if="!create"
										:disabled="source.role === 'floor' && !!configuration?.sources.some((entry) => entry.role === 'floor') && !removeLegacyFloor"
										:label="tt('remove')"
										@click="draft.sources.splice(index, 1)"
									/>
								</div>
							</template>
							<p
								v-if="create"
								class="mt-0"
							>
								{{ memberSourceLabel(source.source_property) }}
							</p>
							<el-form-item
								v-if="!create"
								:error="validation.error(`sourceSelect:${source.role}`)"
								:label="t('devicesVirtualPlugin.measurement.selectSource')"
								required
							>
								<thermostat-property-picker
									v-model="source.source_property"
									:kind="source.role"
								/>
							</el-form-item>
							<el-form-item
								:error="validation.error(`sourceAge:${source.role}`)"
								:label="tt('sources.maximumAge')"
								class="mt-2"
								required
							>
								<el-input-number
									v-model="source.maximum_age_seconds"
									:min="1"
									:controls="false"
								/>
							</el-form-item>
							<source-reporting
								:properties="[source.source_property]"
								:maximum-age-seconds="source.maximum_age_seconds"
								:consequence="source.role"
								@apply="source.maximum_age_seconds = $event"
							/>
							<div
								v-if="source.role === 'contact'"
								class="thermostat-editor__fields"
							>
								<el-form-item
									:error="validation.error('contactValues') || validation.error('contactValuesDiffer')"
									:label="tt(create ? 'wizard.openValue' : 'sources.openValue')"
									required
								>
									<el-select
										v-if="create"
										v-model="source.open_value"
										:aria-label="tt('wizard.openValue')"
										clearable
									>
										<el-option
											:value="true"
											:label="t('devicesVirtualPlugin.measurement.detected')"
										/>
										<el-option
											:value="false"
											:label="t('devicesVirtualPlugin.measurement.notDetected')"
										/>
									</el-select>
									<el-input
										v-else
										:model-value="formatContactValue(source.open_value)"
										@update:model-value="setContactValue(source, 'open_value', $event)"
									/>
								</el-form-item>
								<el-form-item
									:error="validation.error('contactValues') || validation.error('contactValuesDiffer')"
									:label="tt(create ? 'wizard.closedValue' : 'sources.closedValue')"
									required
								>
									<el-select
										v-if="create"
										v-model="source.closed_value"
										:aria-label="tt('wizard.closedValue')"
										clearable
									>
										<el-option
											:value="true"
											:label="t('devicesVirtualPlugin.measurement.detected')"
										/>
										<el-option
											:value="false"
											:label="t('devicesVirtualPlugin.measurement.notDetected')"
										/>
									</el-select>
									<el-input
										v-else
										:model-value="formatContactValue(source.closed_value)"
										@update:model-value="setContactValue(source, 'closed_value', $event)"
									/>
								</el-form-item>
							</div>
						</virtual-wizard-card>
						<div
							v-if="!create"
							class="flex flex-wrap gap-2"
						>
							<el-button
								:disabled="draft.sources.some((source) => source.role === 'ambient')"
								@click="addSource(ThermostatSourceRole.ambient)"
							>
								{{ tt('sources.addAmbient') }}
							</el-button>
							<el-button
								:disabled="draft.sources.some((source) => source.role === 'floor')"
								@click="addSource(ThermostatSourceRole.floor)"
							>
								{{ tt('sources.addFloor') }}
							</el-button>
							<el-button
								:disabled="draft.sources.some((source) => source.role === 'contact')"
								@click="addSource(ThermostatSourceRole.contact)"
							>
								{{ tt('sources.addContact') }}
							</el-button>
						</div>
					</el-form>
					<el-form
						v-if="!create || step === 3"
						:disabled="busy"
						label-position="top"
						status-icon
					>
						<el-form-item
							:error="
								wizardIssues
									.filter((issue) => issue.step === (create ? 3 : 2) && validation.error(issue.field))
									.map((issue) => issue.message)
									.join(' · ')
							"
						/>
						<virtual-cooling-policy-editor
							v-if="!create || hasCooling"
							v-model:draft="draft"
							:disabled="busy"
							:guided="create"
							@select-sources="step = 1"
						/>
						<el-divider
							v-if="!create"
							content-position="left"
						>
							{{ memberLabel('members') }} · {{ draft.actuators.length }}/8
						</el-divider>
						<p v-if="!create">{{ memberLabel('nativeUnavailable') }}</p>
						<section
							v-for="role in [ThermostatActuatorRole.heating, ThermostatActuatorRole.cooling]"
							v-show="!create || draft.actuators.some((member) => member.role === role)"
							:key="role"
							class="mb-5"
						>
							<h3
								v-if="!create"
								class="m-0 mb-3 text-base"
							>
								{{ roleLabel(role) }}
							</h3>
							<thermostat-member-card
								v-for="(actuator, index) in draft.actuators.filter((member) => member.role === role)"
								ref="memberCards"
								:key="actuator.retained?.id ?? `${role}-${index}`"
								:member="actuator"
								:selectable="!create"
								:floor-sources="create ? selectedFloorSources : undefined"
								:cooling-sources="create && draft.policy.cooling ? selectedCoolingSources : undefined"
								:title="create ? `${roleLabel(role)} · ${memberSourceLabel(actuator.source_property)}` : undefined"
								:parallel="draft.actuators.filter((member) => member.role === 'heating').length > 1"
								:controller="deviceId"
								:configuration-revision="configuration?.revision ?? 0"
								:requested-limit="draft.policy.floor?.limit ?? null"
								:disabled="busy"
								:runtime="memberRuntime.value.value?.snapshot.branches.find((branch) => branch.claim === actuator.retained?.id) ?? null"
								:setup-disabled="!!configuration && JSON.stringify(draft) !== JSON.stringify(draftFromConfiguration(configuration))"
								:freshness="memberFreshness"
								:received-at="memberRuntime.value.value?.receivedAt ?? now"
								:now="now"
								@remove="draft.actuators.splice(draft.actuators.indexOf(actuator), 1)"
								@changed="reload"
							/>
							<el-button
								v-if="!create"
								:disabled="busy || draft.actuators.length >= 8"
								@click="addActuator(role)"
							>
								{{ memberLabel('addMember') }} · {{ roleLabel(role) }}
							</el-button>
						</section>
						<el-form-item
							v-if="!create"
							:label="memberLabel('displayFloor')"
						>
							<el-select
								v-model="draft.display_floor_claim"
								clearable
							>
								<el-option
									v-for="member in draft.actuators.filter((member) => member.retained?.protection)"
									:key="member.retained!.id"
									:value="member.retained!.id"
									:label="`${roleLabel(member.role)} · ${member.retained!.physical_identity}`"
								/>
							</el-select>
						</el-form-item>
						<details v-if="configuration?.released_actuators?.length">
							<summary>{{ memberLabel('releasedHistory') }}</summary>
							<pre
								v-for="claim in configuration.released_actuators"
								:key="claim.id"
								>{{ JSON.stringify(claim, null, 2) }}</pre
							>
						</details>
					</el-form>
					<div
						v-if="!create"
						v-show="at(0)"
					>
						<el-divider content-position="left">{{ tt('settings.title') }}</el-divider>
						<div
							v-for="(setting, index) in draft.settings"
							:key="setting.setting"
							class="flex items-center gap-2 mb-2"
						>
							<el-select
								v-model="setting.setting"
								class="w-48"
							>
								<el-option
									v-for="settingName in settingNames"
									:key="settingName"
									:value="settingName"
									:label="tt(`settingRoles.${settingName}`)"
								/>
							</el-select>
							<thermostat-property-picker
								v-model="setting.property"
								:owner-device-id="deviceId"
								kind="setting"
							/>
							<virtual-wizard-remove-button
								:label="tt('remove')"
								@click="draft.settings.splice(index, 1)"
							/>
						</div>
						<el-button @click="addSetting">
							{{ tt('settings.add') }}
						</el-button>
					</div>
					<div
						v-show="at(REVIEW_STEP)"
						:class="create ? 'flex flex-col gap-4' : undefined"
					>
						<el-divider v-if="!create" />
						<template v-if="create">
							<virtual-wizard-review-section
								:title="t('devicesVirtualPlugin.wizard.steps.details')"
								:disabled="busy"
								@edit="step = 0"
							>
								<virtual-wizard-descriptions
									:column="2"
									data-test-id="thermostat-summary"
								>
									<el-descriptions-item :label="t('devicesModule.fields.devices.name.title')">{{ name }}</el-descriptions-item>
									<el-descriptions-item :label="t('devicesModule.fields.devices.room.title')">{{ roomName(roomId) }}</el-descriptions-item>
									<el-descriptions-item :label="t('devicesModule.fields.devices.zones.title')">{{ zoneNames(zoneIds) }}</el-descriptions-item>
								</virtual-wizard-descriptions>
							</virtual-wizard-review-section>
							<virtual-wizard-review-section
								:title="stepLabels[1]"
								:count="reviewSources.length > 1 ? reviewSources.length : undefined"
								:disabled="busy"
								icon="mdi:thermometer"
								@edit="step = 1"
							>
								<virtual-wizard-source-picker
									:sources="[]"
									:selected="reviewSources"
									read-only
									data-test-id="thermostat-review-sources"
								/>
								<virtual-wizard-descriptions
									:column="2"
									class="thermostat-editor__review-settings"
								>
									<template
										v-for="(source, index) in draft.sources"
										:key="`${source.role}-${index}`"
									>
										<el-descriptions-item :label="`${roleLabel(source.role)} · ${tt('sources.maximumAge')}`">
											{{ source.maximum_age_seconds }} s
										</el-descriptions-item>
										<template v-if="source.role === 'contact'">
											<el-descriptions-item :label="tt('sources.openValue')">{{ formatContactValue(source.open_value) }}</el-descriptions-item>
											<el-descriptions-item :label="tt('sources.closedValue')">{{ formatContactValue(source.closed_value) }}</el-descriptions-item>
										</template>
									</template>
								</virtual-wizard-descriptions>
							</virtual-wizard-review-section>
							<virtual-wizard-review-section
								:title="stepLabels[2]"
								:count="draft.actuators.length > 1 ? draft.actuators.length : undefined"
								:disabled="busy"
								icon="mdi:electric-switch"
								@edit="step = 2"
							>
								<virtual-wizard-source-picker
									:sources="[]"
									:selected="reviewActuators"
									read-only
									data-test-id="thermostat-review-actuators"
								/>
								<virtual-wizard-descriptions
									:column="2"
									class="thermostat-editor__review-settings"
								>
									<template
										v-for="(member, index) in draft.actuators"
										:key="member.retained?.id ?? `${member.role}-${index}`"
									>
										<el-descriptions-item :label="`${roleLabel(member.role)} · ${memberLabel('lease')}`">
											{{ member.lease_seconds }} s
										</el-descriptions-item>
										<el-descriptions-item
											v-if="member.protection"
											:label="memberLabel('localProtection')"
										>
											{{ memberSourceLabel(member.protection.source_property) }} · {{ member.protection.maximum_age_seconds }} s
										</el-descriptions-item>
										<template v-if="member.cooling_protection">
											<el-descriptions-item :label="t('devicesVirtualPlugin.dewPoint.title')">
												{{ memberSourceLabel(member.cooling_protection.dew_point_property) }}
											</el-descriptions-item>
											<el-descriptions-item :label="t('devicesVirtualPlugin.dewPoint.surface')">
												{{ memberSourceLabel(member.cooling_protection.surface_property) }} · {{ member.cooling_protection.maximum_age_seconds }} s
											</el-descriptions-item>
										</template>
									</template>
								</virtual-wizard-descriptions>
							</virtual-wizard-review-section>
							<virtual-wizard-review-section
								:title="tt('wizard.configurationStep')"
								:disabled="busy"
								icon="mdi:tune"
								@edit="step = 3"
							>
								<virtual-wizard-descriptions
									:column="2"
									data-test-id="thermostat-processing-summary"
								>
									<el-descriptions-item
										v-for="item in policyReviewItems"
										:key="item.label"
										:label="item.label"
									>
										{{ item.value }}
									</el-descriptions-item>
								</virtual-wizard-descriptions>
							</virtual-wizard-review-section>
						</template>
					</div>
					<template #aside>
						<virtual-wizard-summary
							v-if="create && step !== REVIEW_STEP"
							:title="name"
							:subtitle="`${t('devicesVirtualPlugin.wizard.kinds.thermostat.title')} · ${roomName(roomId)}`"
							:items="sidebarItems"
						/>
						<virtual-wizard-card
							v-if="at(REVIEW_STEP)"
							icon="mdi:clipboard-check-outline"
							body-class="flex flex-col gap-3"
							data-test-id="thermostat-preview"
						>
							<template #header>
								<div class="flex items-center justify-between gap-2">
									<strong>{{ tt('wizard.previewTitle') }}</strong>
									<el-button
										v-if="create"
										size="small"
										:loading="previewBusy"
										:disabled="busy || validationErrors.length > 0"
										@click="runPreview"
									>
										{{ t('devicesVirtualPlugin.wizard.layout.recalculate') }}
									</el-button>
								</div>
							</template>
							<el-alert
								v-if="preview"
								:title="tt('draft.title')"
								:description="tt('draft.description')"
								type="info"
								:closable="false"
								show-icon
							/>
							<virtual-wizard-descriptions
								v-if="preview"
								:column="1"
								card-inset
							>
								<el-descriptions-item :label="t('devicesVirtualPlugin.wizard.layout.state')">
									<el-tag
										type="info"
										size="small"
									>
										{{ tt('draft.title') }}
									</el-tag>
								</el-descriptions-item>
								<el-descriptions-item
									v-if="preview.reasons.length"
									:label="t('devicesVirtualPlugin.measurement.help.diagnostics')"
								>
									<el-space wrap>
										<el-tag
											v-for="reason in preview.reasons"
											:key="reason"
											type="warning"
											size="small"
										>
											{{ translateThermostatError(t, reason) }}
										</el-tag>
									</el-space>
								</el-descriptions-item>
							</virtual-wizard-descriptions>
						</virtual-wizard-card>
					</template>
				</virtual-wizard-layout>
				<template #final>
					<div class="flex gap-2">
						<!-- The review step previews by itself; the button is only the way to take a fresh one. -->
						<el-button
							v-if="!create || (!preview && validationErrors.length === 0)"
							:loading="busy"
							:disabled="validationErrors.length > 0"
							@click="runPreview"
						>
							{{ tt('actions.preview') }}
						</el-button>
						<el-button
							type="primary"
							:loading="busy"
							:disabled="!preview || !canSavePreview || validationErrors.length > 0"
							@click="save"
						>
							{{ tt(create ? 'actions.create' : 'actions.save') }}
						</el-button>
						<el-button
							v-if="configuration?.actuators.length"
							type="warning"
							:loading="busy"
							@click="requestRelease"
						>
							{{ tt('actions.release') }}
						</el-button>
						<el-button
							v-if="!create"
							@click="reload"
						>
							{{ tt('actions.reload') }}
						</el-button>
					</div>
				</template>
			</device-wizard-steps>
		</template>
	</el-card>
	<virtual-thermostat-comfort
		v-if="!create && deviceId && configuration"
		:key="deviceId"
		:device-id="deviceId"
		:revision="configuration.revision"
		:disabled="busy || JSON.stringify(draft) !== JSON.stringify(draftFromConfiguration(configuration))"
		@changed="reload"
	/>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElDescriptionsItem,
	ElDivider,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElSelect,
	ElSpace,
	ElTag,
	vLoading,
} from 'element-plus';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectSockets, injectStoresManager, useBackend } from '../../../common';
import { useSession } from '../../../modules/auth/composables/useSession';
import DeviceWizardSteps from '../../../modules/devices/components/wizard/device-wizard-steps.vue';
import type { IWizardAction } from '../../../modules/devices/components/wizard/device-wizard.types';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	SpacesModuleClimateIntentMode,
	DevicesVirtualPluginThermostatActuatorRole as ThermostatActuatorRole,
	DevicesVirtualPluginThermostatSettingSetting as ThermostatSettingRole,
	DevicesVirtualPluginThermostatSourceRole as ThermostatSourceRole,
	type operations,
} from '../../../openapi';
import { usePlacementNames } from '../composables/use-placement-names';
import { useThermostatMemberContext } from '../composables/use-thermostat-member-context';
import { useThermostatPreviewGate } from '../composables/use-thermostat-preview-gate';
import { useVirtualWizardError } from '../composables/use-virtual-wizard-error';
import { provideVirtualWizardPlacement } from '../composables/use-virtual-wizard-placement';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';
import {
	RECOMMENDED_ACTUATOR_LEASE_SECONDS,
	RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS,
	type ThermostatConfiguration,
	type ThermostatDraft,
	type ThermostatSource,
	buildThermostatRequest,
	draftAfterRelease,
	draftFromConfiguration,
	emptyThermostatDraft,
	newThermostatDraft,
	recommendedFloorPolicy,
	recommendedWindowHeuristic,
	translateThermostatError,
} from '../services/thermostat-authoring';
import { ThermostatMemberFreshness } from '../services/thermostat-members';
import { formatSourceSampleAge, sourceSampleAge } from '../utils/source-sample-age';
import { thermostatDeviceDraft } from '../utils/thermostat-device-draft';
import {
	syncThermostatWizardBranches,
	syncThermostatWizardFloor,
	thermostatWizardIssueStep,
	thermostatWizardSources,
} from '../utils/thermostat-wizard-selection';

import SourceReporting from './source-reporting.vue';
import ThermostatMemberCard from './thermostat-member-card.vue';
import ThermostatPropertyPicker from './thermostat-property-picker.vue';
import VirtualCoolingPolicyEditor from './virtual-cooling-policy-editor.vue';
import VirtualPlacementFields from './virtual-placement-fields.vue';
import VirtualThermostatComfort from './virtual-thermostat-comfort.vue';
import VirtualThermostatWizardSelection from './virtual-thermostat-wizard-selection.vue';
import VirtualWizardCard from './virtual-wizard-card.vue';
import VirtualWizardDescriptions from './virtual-wizard-descriptions.vue';
import VirtualWizardLayout from './virtual-wizard-layout.vue';
import VirtualWizardRemoveButton from './virtual-wizard-remove-button.vue';
import VirtualWizardReviewSection from './virtual-wizard-review-section.vue';
import type { VirtualWizardSource } from './virtual-wizard-source-picker.types';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';
import VirtualWizardSummary from './virtual-wizard-summary.vue';
import WindowDetectionReporting from './window-detection-reporting.vue';

const props = defineProps<{ deviceId?: string; create?: boolean }>();
const emit = defineEmits<{ created: [deviceId: string]; busy: [value: boolean] }>();
const backend = useBackend();
const sockets = injectSockets();
let alive = true;
const { profile } = useSession();
const canAuthor = computed(() => ['owner', 'admin'].includes(profile.value?.role ?? ''));
const { t, locale } = useI18n();
const memberLabel = (key: string) => t(`devicesVirtualPlugin.members.${key}`);
const tt = (key: string, params: Record<string, unknown> = {}): string => t(`devicesVirtualPlugin.thermostat.${key}`, params);
const roleLabel = (role: string): string => tt(`${props.create ? 'wizard.roles' : 'roles'}.${role}`);
const removeLegacyFloor = ref(false),
	now = ref(Date.now());
const configuration = ref<ThermostatConfiguration | null>(null);
const memberFreshness = new ThermostatMemberFreshness();
let retainedRuntimeClaims: string[] = [];
const memberRuntime = useThermostatMemberContext(
	computed(() => (props.deviceId && configuration.value ? `${props.deviceId}:${configuration.value.revision}` : '')),
	async (_, signal) => {
		const { data, error } = await backend.client.GET('/plugins/devices-virtual/producers/thermostats/{id}/runtime', {
			params: { path: { id: props.deviceId! } },
			signal,
		});
		if (!data) throw new Error(JSON.stringify(error));
		if (data.data.configuration_revision !== configuration.value?.revision) throw new Error('configuration_revision_changed');
		return { snapshot: data.data, receivedAt: Date.now() };
	}
);
watch([configuration, memberRuntime.value], ([config, runtime]) => {
	if (runtime) {
		retainedRuntimeClaims = runtime.snapshot.branches.filter((branch) => branch.claim_state !== 'released').map((branch) => branch.claim);
	}
	if (!config) return;
	memberFreshness.retain([...config.actuators.filter((claim) => claim.state !== 'released').map((claim) => claim.id), ...retainedRuntimeClaims]);
});
const clock = props.create
	? null
	: setInterval(() => {
			now.value = Date.now();
			memberFreshness.expire(now.value);
		}, 1000);
const disconnectMembers = () => memberRuntime.invalidate();
const refreshMembers = () => {
	void memberRuntime.reload();
};
const memberHint = (event: { event: string; payload: unknown }) => {
	if (
		event.event === 'DevicesVirtualPlugin.Thermostat.RuntimeChanged' &&
		event.payload &&
		typeof event.payload === 'object' &&
		'controller' in event.payload &&
		event.payload.controller === props.deviceId
	)
		refreshMembers();
};
onMounted(() => {
	sockets.on('event', memberHint);
	sockets.on('connect', refreshMembers);
	sockets.on('disconnect', disconnectMembers);
});
onBeforeUnmount(() => {
	alive = false;
	if (clock !== null) clearInterval(clock);
	requestSequence++;
	sockets.off('event', memberHint);
	sockets.off('connect', refreshMembers);
	sockets.off('disconnect', disconnectMembers);
});
const preview = ref<ThermostatConfiguration | null>(null);
const draft = ref(props.create ? newThermostatDraft() : emptyThermostatDraft());
const name = ref('');
const roomId = ref<string | null>(null);
const zoneIds = ref<string[]>([]);
const { roomName, zoneNames } = usePlacementNames();
const graph = ref<ReturnType<typeof thermostatDeviceDraft> | null>(null);
let graphBranchSignature = '';
const creationGraph = () => {
	const signature = `${draft.value.policy.heatingSetpoint !== null}:${draft.value.policy.coolingSetpoint !== null}`;
	if (!graph.value || graphBranchSignature !== signature) {
		graph.value = thermostatDeviceDraft(name.value, draft.value.policy.heatingSetpoint !== null, draft.value.policy.coolingSetpoint !== null);
		graphBranchSignature = signature;
	}
	graph.value.device.name = name.value.trim();
	// Assigned, not spread: the same graph object is previewed and then created.
	if (roomId.value) graph.value.device.room_id = roomId.value;
	else delete graph.value.device.room_id;
	if (zoneIds.value.length) graph.value.device.zone_ids = [...zoneIds.value];
	else delete graph.value.device.zone_ids;
	return graph.value;
};
const payload = () =>
	buildThermostatRequest(
		props.create ? { ...draft.value, settings: creationGraph().settings } : draft.value,
		configuration.value?.revision ?? 0,
		configuration.value?.graph_revision ?? preview.value?.graph_revision
	);
const loading = ref(false);
const mutationBusy = ref(false);
const previewBusy = ref(false);
const busy = computed(() => mutationBusy.value || previewBusy.value);
// The wizard shell holds navigation while a save is in flight: leaving would unmount this editor and
// drop the response of a request the backend still completes.
watch(busy, (value) => emit('busy', value), { immediate: true });
const loadError = ref<string | null>(null);
const requestError = ref<string | null>(null);
const previewGate = useThermostatPreviewGate(
	() =>
		JSON.stringify({
			draft: draft.value,
			name: name.value,
			roomId: roomId.value,
			zoneIds: zoneIds.value,
			create: props.create,
			deviceId: props.deviceId,
			revision: configuration.value?.revision,
		}),
	[draft, name, roomId, zoneIds, () => props.create, () => props.deviceId, () => configuration.value?.revision],
	() => {
		preview.value = null;
		previewBusy.value = false;
	}
);
const canSavePreview = previewGate.canSave;
const validationErrors = computed(() => [
	...(props.create && !name.value.trim() ? [t('devicesModule.fields.devices.name.validation.required')] : []),
	...(configuration.value?.sources.some((source) => source.role === 'floor') &&
	!draft.value.sources.some((source) => source.role === 'floor') &&
	!removeLegacyFloor.value
		? [memberLabel('removeLegacyGuard')]
		: []),
	...payload().errors.map((error) => translateThermostatError(t, error)),
]);
// The current step validates only fields the user can edit there. The shared wrapper awaits the
// backend review before displaying the final summary; live readiness is informational.
const step = ref(0);
const REVIEW_STEP = 4;
const selectionLoading = ref(false);
const hasHeating = computed(() => draft.value.actuators.some((member) => member.role === 'heating'));
const hasCooling = computed(() => draft.value.actuators.some((member) => member.role === 'cooling'));
const hasContact = computed(() => draft.value.sources.some((source) => source.role === 'contact'));
const at = (index: number): boolean => !props.create || step.value === index;
const stepLabels = computed<string[]>(() =>
	['details', 'sources', 'actuators', 'configuration', 'review'].map((key) =>
		key === 'configuration' ? tt('wizard.configurationStep') : t(`devicesVirtualPlugin.wizard.steps.${key}`)
	)
);
const policyIssues = new Set([
	'setpointRequired',
	'coldTolerance',
	'hotTolerance',
	'neutralMargin',
	'minimumOff',
	'changeover',
	'floorPolicy',
	'trendIncomplete',
	'contactDebounce',
]);
const sourceIssues = new Set([
	'ambientSource',
	'retainFloorPolicy',
	'sourceAge',
	'sourceSelect',
	'contactValues',
	'contactValuesDiffer',
	'contactSourceLimit',
]);
const wizardIssues = computed(() =>
	[
		...payload().errors,
		...(props.create && hasCooling.value && draft.value.policy.cooling
			? [
					...(!draft.value.coolingSources?.some((source) => source.role === 'dew_point')
						? ['devicesVirtualPlugin.thermostat.errors.coolingDewPointSource']
						: []),
					...(!draft.value.coolingSources?.some((source) => source.role === 'cooled_surface')
						? ['devicesVirtualPlugin.thermostat.errors.coolingSurfaceSource']
						: []),
				]
			: []),
	].map((error) => {
		const [key, serialized] = error.split('?');
		const code = key.split('.').at(-1)!;
		const params = serialized ? (JSON.parse(serialized) as { role?: string }) : {};
		return {
			code,
			field: params.role ? `${code}:${params.role}` : code,
			step: props.create ? thermostatWizardIssueStep(code) : policyIssues.has(code) ? 0 : sourceIssues.has(code) ? 1 : 2,
			message: translateThermostatError(t, error),
		};
	})
);
const validation = useWizardValidation(step, () => ({
	...(step.value === 0 && !name.value.trim() ? { name: t('devicesModule.fields.devices.name.validation.required') } : {}),
	...Object.fromEntries(wizardIssues.value.filter((issue) => issue.step === step.value).map((issue) => [issue.field, issue.message])),
}));
const memberCards = ref<{ loading: boolean }[]>([]);
const memberContextLoading = computed(() => props.create && step.value === 3 && memberCards.value.some((card) => card.loading));
const beforeNext = async (): Promise<boolean> => {
	if (memberContextLoading.value) return false;
	if (props.create && step.value === 2) syncThermostatWizardBranches(draft.value);
	const earlierIssue = wizardIssues.value.find((issue) => issue.step < step.value);
	if (props.create && earlierIssue) {
		step.value = earlierIssue.step;
		await nextTick();
		validation.validate();
		return false;
	}
	if (!validation.validate()) return false;
	if (step.value !== REVIEW_STEP - 1) return true;
	await runPreview();
	return !!preview.value && canSavePreview.value && !requestError.value;
};
const modeNames = computed(() =>
	Object.values(SpacesModuleClimateIntentMode).filter(
		(mode) =>
			!props.create ||
			mode === 'off' ||
			(mode === 'heat' && hasHeating.value) ||
			(mode === 'cool' && hasCooling.value) ||
			(mode === 'auto' && hasHeating.value && hasCooling.value)
	)
);
const settingNames = Object.values(ThermostatSettingRole);
type TrendKey = keyof NonNullable<typeof draft.value.heuristic>;
const trendKeys: TrendKey[] = [
	'sampleWindowMs',
	'minimumSamples',
	'minimumSpanMs',
	'maximumSampleAgeMs',
	'slopeThresholdCPerMinute',
	'confirmationMs',
	'recoveryMs',
	'maximumPauseMs',
	'cooldownMs',
];
const trendFields = computed<{ key: TrendKey; label: string }[]>(() => trendKeys.map((key) => ({ key, label: tt(`trendFields.${key}`) })));

let requestSequence = 0;
const path = `/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats/{id}` as const;
const reload = async (): Promise<void> => {
	if (props.create || !props.deviceId) return;
	const sequence = ++requestSequence;
	mutationBusy.value = false;
	loading.value = true;
	loadError.value = null;
	previewGate.invalidate();
	try {
		const { data, error, response } = await backend.client.GET(path, { params: { path: { id: props.deviceId } } });
		if (!alive || sequence !== requestSequence) return;
		if (response.status === 404) {
			configuration.value = null;
			draft.value = emptyThermostatDraft();
		} else if (data) {
			configuration.value = data.data;
			draft.value = draftFromConfiguration(data.data);
		} else loadError.value = getErrorReason<operations['get-devices-virtual-plugin-thermostat-configuration']>(error, tt('loadFailed'));
	} catch (error) {
		if (sequence === requestSequence) loadError.value = String(error);
	} finally {
		if (sequence === requestSequence) loading.value = false;
	}
};
const errorText = (error: unknown): string => {
	if (typeof error === 'object' && error !== null && 'message' in error) {
		const message = (error as { message: unknown }).message;
		if (typeof message === 'string') return message;
		if (Array.isArray(message)) return message.join('; ');
	}
	// The backend's own refusal travels as `error.details.reason`; without reading it every rejected
	// preview or save collapsed into the same sentence and gave no hint of what to change.
	return getErrorReason(error as Parameters<typeof getErrorReason>[0], tt('requestFailed'));
};
const runPreview = async (): Promise<void> => {
	if (mutationBusy.value || !canAuthor.value) return;
	const result = payload();
	if (!result.request) return;
	const request = {
		create: props.create,
		configuration: result.request,
		device: props.create ? creationGraph().device : null,
		deviceId: props.deviceId,
	};
	requestError.value = null;
	await previewGate.execute(
		request,
		async (snapshot) => {
			const { data, error } = snapshot.create
				? await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats/draft-preview`, {
						body: { device: snapshot.device!, configuration: snapshot.configuration },
					})
				: await backend.client.POST(`${path}/preview`, { params: { path: { id: snapshot.deviceId! } }, body: snapshot.configuration });
			if (!data) throw new Error(errorText(error));
			return data.data;
		},
		{
			success: (result) => (preview.value = result),
			error: (error) => (requestError.value = errorText(error)),
			pending: (pending) => (previewBusy.value = pending),
		}
	);
};
const save = async (): Promise<void> => {
	if (!canAuthor.value || !preview.value || !previewGate.canSave.value || busy.value) return;
	const result = payload();
	if (!result.request) return;
	const identity = props.deviceId,
		ticket = ++requestSequence,
		draftSignature = JSON.stringify(draft.value);
	mutationBusy.value = true;
	requestError.value = null;
	try {
		if (props.create) {
			const { data, error } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats`, {
				body: { device: creationGraph().device, configuration: result.request },
			});
			if (!alive || ticket !== requestSequence) return;
			if (data) {
				// Release the shell before announcing the device: the parent navigates on `created`, and
				// the shell refuses to leave while it still believes a save is in flight.
				mutationBusy.value = false;
				await nextTick();
				if (!alive || ticket !== requestSequence) return;
				emit('created', data.data.device.id);
			} else requestError.value = errorText(error);
			return;
		}
		const { data, error } = await backend.client.PUT(path, { params: { path: { id: props.deviceId! } }, body: result.request });
		if (!alive || ticket !== requestSequence || identity !== props.deviceId) return;
		if (data) {
			configuration.value = data.data;
			if (JSON.stringify(draft.value) === draftSignature) draft.value = draftFromConfiguration(data.data);
			preview.value = null;
		} else requestError.value = errorText(error);
	} catch (error) {
		if (alive && ticket === requestSequence) requestError.value = errorText(error);
	} finally {
		if (alive && ticket === requestSequence) mutationBusy.value = false;
	}
};
const requestRelease = async (): Promise<void> => {
	const deviceId = props.deviceId;
	if (!canAuthor.value || !configuration.value || !deviceId || busy.value) return;
	const ticket = ++requestSequence,
		draftSignature = JSON.stringify(draftFromConfiguration(configuration.value));
	mutationBusy.value = true;
	requestError.value = null;
	try {
		const { data, error } = await backend.client.POST(`${path}/release`, {
			params: { path: { id: deviceId } },
			body: { expected_revision: configuration.value.revision },
		});
		if (!alive || ticket !== requestSequence || deviceId !== props.deviceId) return;
		if (data) {
			configuration.value = data.data;
			draft.value = JSON.stringify(draft.value) === draftSignature ? draftFromConfiguration(data.data) : draftAfterRelease(draft.value, data.data);
			previewGate.invalidate();
			preview.value = null;
			memberRuntime.invalidate();
			void memberRuntime.reload();
		} else requestError.value = errorText(error);
	} catch (error) {
		if (alive && ticket === requestSequence) requestError.value = errorText(error);
	} finally {
		if (alive && ticket === requestSequence) mutationBusy.value = false;
	}
};
const toggleFloor = (enabled: string | number | boolean): void => {
	if (
		enabled !== true &&
		(draft.value.actuators.some((member) => !!member.protection) || draft.value.sources.some((source) => source.role === 'floor'))
	)
		return;
	draft.value.policy.floor = enabled === true ? recommendedFloorPolicy() : null;
};
const toggleTrend = (enabled: string | number | boolean): void => {
	draft.value.heuristic = enabled === true ? recommendedWindowHeuristic() : null;
};
const addSource = (role: ThermostatSource['role']): void => {
	draft.value.sources.push({ role, source_property: null, maximum_age_seconds: props.create ? RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS : null });
};
const addActuator = (role: ThermostatActuatorRole): void => {
	if (draft.value.actuators.length >= 8 || !canAuthor.value) return;
	draft.value.actuators.push({ role, source_property: '', lease_seconds: props.create ? RECOMMENDED_ACTUATOR_LEASE_SECONDS : null });
};
const addSetting = (): void => {
	draft.value.settings.push({ setting: ThermostatSettingRole.heating_setpoint, property: '' });
};
const formatContactValue = (value: unknown): string => (value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value));
const setContactValue = (source: ThermostatDraft['sources'][number], key: 'open_value' | 'closed_value', value: string): void => {
	try {
		source[key] = JSON.parse(value) as string | number | boolean;
	} catch {
		source[key] = value;
	}
};
watch(
	() => props.deviceId,
	() => {
		memberFreshness.clear();
		retainedRuntimeClaims = [];
		previewGate.invalidate();
		void reload();
	}
);
onMounted(() => {
	if (!props.create) void reload();
});
const wizardFinalActions = computed<IWizardAction[]>(() => [
	{
		id: 'create',
		label: tt('actions.create'),
		variant: 'primary',
		disabled: !preview.value || !canSavePreview.value || validationErrors.value.length > 0,
		handler: save,
	},
]);

const summaryStores = injectStoresManager();
const properties = summaryStores.getStore(channelsPropertiesStoreKey);
const channels = summaryStores.getStore(channelsStoreKey);
const devices = summaryStores.getStore(devicesStoreKey);
const memberSourceLabel = (id: string | null | undefined) => {
	const property = properties.findAll().find((entry) => entry.id === id);
	const channel = channels.findAll().find((entry) => entry.id === property?.channel);
	const device = devices.findAll().find((entry) => entry.id === channel?.device);
	return device ? `${device.name} · ${property?.name ?? property?.category ?? ''}` : '—';
};
const selectedFloorSources = computed(() =>
	draft.value.sources
		.filter((source) => source.role === 'floor' && source.source_property)
		.map((source) => ({
			id: source.source_property!,
			label: memberSourceLabel(source.source_property),
			maximumAgeSeconds: source.maximum_age_seconds,
		}))
);
watch(
	() => draft.value.sources.map((source) => `${source.role}:${source.source_property}`).join('|'),
	() => {
		if (props.create) syncThermostatWizardFloor(draft.value);
	},
	{ immediate: true }
);
const selectedCoolingSources = computed(() =>
	(draft.value.coolingSources ?? []).map((source) => ({
		id: source.source_property,
		role: source.role,
		label: memberSourceLabel(source.source_property),
	}))
);
const reviewSources = ref<VirtualWizardSource[]>([]);
const reviewActuators = ref<VirtualWizardSource[]>([]);
const reviewSource = (id: string | null | undefined, role: string, index: number): VirtualWizardSource => {
	const property = properties.findAll().find((entry) => entry.id === id);
	const channel = channels.findAll().find((entry) => entry.id === property?.channel);
	const device = devices.findAll().find((entry) => entry.id === channel?.device);
	const online = device?.status?.online ?? null;
	const value = property?.value?.value;
	const age = sourceSampleAge(property?.value?.lastUpdated, Date.now());
	const knownValue =
		online !== false && (typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)));
	return {
		id: `${role}-${index}-${id ?? 'missing'}`,
		name: device?.name ?? '—',
		detail: [roleLabel(role), channel?.name, property?.name ?? property?.category].filter(Boolean).join(' · '),
		roomId: device?.roomId ?? null,
		room: roomName(device?.roomId ?? null),
		online,
		reading: knownValue ? `${value} ${property?.unit ?? ''}`.trim() : '—',
		readingHint: knownValue && age === null ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTimeHint') : undefined,
		age: knownValue && age === null ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTime') : formatSourceSampleAge(age, locale?.value),
	};
};
const reviewedSourceBindings = () => {
	const boundCoolingIds = new Set(
		draft.value.actuators.flatMap((member) =>
			member.cooling_protection ? [member.cooling_protection.dew_point_property, member.cooling_protection.surface_property] : []
		)
	);
	return [
		...draft.value.sources,
		...(draft.value.policy.cooling ? (draft.value.coolingSources?.filter((source) => boundCoolingIds.has(source.source_property)) ?? []) : []),
	];
};
// Freeze the displayed readings with the reviewed configuration; live reports never rewrite Review.
watch(
	preview,
	(snapshot) => {
		reviewSources.value =
			snapshot && props.create ? reviewedSourceBindings().map((source, index) => reviewSource(source.source_property, source.role, index)) : [];
		reviewActuators.value =
			snapshot && props.create ? draft.value.actuators.map((member, index) => reviewSource(member.source_property, member.role, index)) : [];
	},
	{ flush: 'sync' }
);
const policyReviewItems = computed(() => {
	const policy = draft.value.policy;
	const items: { label: string; value: string | number }[] = [
		{ label: tt('summary.mode'), value: tt(`modes.${draft.value.requested_mode}`) },
		...(['heatingSetpoint', 'coolingSetpoint', 'coldTolerance', 'hotTolerance', 'neutralMargin', 'minimumOffMs', 'changeoverMs'] as const)
			.filter((key) => policy[key] !== null)
			.map((key) => ({ label: tt(key === 'minimumOffMs' ? 'minimumOff' : key === 'changeoverMs' ? 'changeover' : key), value: policy[key]! })),
		{ label: tt('contactOpening'), value: draft.value.contact_opening_ms ?? '—' },
		{ label: tt('contactClosing'), value: draft.value.contact_closing_ms ?? '—' },
		{ label: tt('floorProtect'), value: t(`devicesVirtualPlugin.measurement.help.${policy.floor ? 'enabled' : 'disabled'}`) },
	];
	if (policy.floor)
		items.push(
			{ label: tt('floorLimit'), value: policy.floor.limit ?? '—' },
			{ label: tt('floorHysteresis'), value: policy.floor.recoveryHysteresis ?? '—' }
		);
	items.push({ label: tt('trend'), value: t(`devicesVirtualPlugin.measurement.help.${draft.value.heuristic ? 'enabled' : 'disabled'}`) });
	if (draft.value.heuristic)
		for (const field of trendFields.value) items.push({ label: field.label, value: draft.value.heuristic[field.key] ?? '—' });
	if (policy.cooling)
		items.push(
			{ label: t('devicesVirtualPlugin.dewPoint.margin'), value: policy.cooling.marginC ?? '—' },
			{ label: t('devicesVirtualPlugin.dewPoint.hysteresis'), value: policy.cooling.recoveryHysteresisC ?? '—' },
			{ label: t('devicesVirtualPlugin.dewPoint.absoluteMinimum'), value: policy.cooling.absoluteMinimumC ?? '—' }
		);
	return items;
});

const sidebarItems = computed(() => [
	{ label: t('devicesModule.fields.devices.room.title'), value: roomName(roomId.value) },
	{ label: tt('summary.mode'), value: tt(`modes.${draft.value.requested_mode}`) },
	{
		label: tt('summary.sources'),
		value: thermostatWizardSources(draft.value).filter((source) => source.source_property).length || null,
	},
	{
		label: tt('summary.members'),
		value: draft.value.actuators.filter((member) => member.source_property).length || null,
	},
]);

provideVirtualWizardPlacement(computed(() => (props.create ? { roomId: roomId.value, zoneIds: zoneIds.value } : {})));
useVirtualWizardError(() => loadError.value ?? requestError.value);
</script>

<style scoped>
.thermostat-editor__fields {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
	column-gap: 16px;
}
.thermostat-editor__fields :deep(.el-input-number) {
	width: 100%;
}
.thermostat-editor__review-settings :deep(.virtual-wizard-descriptions .el-descriptions__table) {
	border-top: 1px solid var(--el-border-color-lighter);
}
</style>
