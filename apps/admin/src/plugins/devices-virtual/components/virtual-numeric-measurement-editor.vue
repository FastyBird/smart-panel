<template>
	<el-card
		header-class="px-3! py-3! font-bold"
		:class="stepped ? 'border-0! shadow-none! bg-transparent!' : ''"
		:body-class="stepped ? 'p-0!' : undefined"
		shadow="never"
		data-test-id="measurement-editor"
	>
		<template
			v-if="!stepped"
			#header
		>
			<strong>{{ t(`devicesVirtualPlugin.measurement.${isTransform ? 'transform' : 'aggregate'}`) }}</strong>
		</template>

		<el-button
			v-if="conflict || catalogError"
			:disabled="busy"
			@click="reload"
		>
			{{ t('devicesVirtualPlugin.measurement.reload') }}
		</el-button>
		<el-alert
			v-if="current"
			:title="
				t('devicesVirtualPlugin.measurement.quality', {
					quality: diagnosticLabel(liveQuality),
				})
			"
			type="info"
			:closable="false"
			class="mb-3"
		/>
		<p
			v-if="current && liveReasons.length"
			data-test-id="measurement-reasons"
		>
			{{ liveReasons.map(diagnosticLabel).join(', ') }}
		</p>
		<device-wizard-steps
			v-model="step"
			:enabled="stepped"
			:steps="stepLabels"
			:can-advance="canAdvance"
			:before-next="beforeNext"
			:final-actions="wizardFinalActions"
			:dirty="step > 0 || !!model.name.trim()"
			:disabled="busy || loading"
		>
			<virtual-wizard-layout
				:loading="catalogLoading"
				:loading-text="t('devicesVirtualPlugin.measurement.loadingCatalog')"
				:compact="step === 0"
				:enabled="stepped"
				:review="at(3)"
				:title="stepped ? layoutTitle : undefined"
				:description="stepped ? layoutDescription : undefined"
			>
				<el-form
					v-if="!stepped || !at(3)"
					v-loading="!stepped && catalogLoading"
					:element-loading-text="t('devicesVirtualPlugin.measurement.loadingCatalog')"
					:aria-busy="catalogLoading"
					label-position="top"
					:disabled="busy || loading"
					status-icon
				>
					<div
						v-if="at(0)"
						:class="stepped ? 'w-full' : undefined"
					>
						<el-form-item
							v-if="!outputId"
							:error="validation.error('name')"
							:label="t('devicesModule.fields.devices.name.title')"
							required
						>
							<el-input
								v-model="model.name"
								:placeholder="t('devicesModule.fields.devices.name.placeholder')"
								name="name"
							/>
						</el-form-item>
						<el-form-item
							v-if="isTransform"
							:error="validation.error('profile')"
							:label="t('devicesVirtualPlugin.measurement.profile')"
							required
						>
							<el-select
								v-model="model.temperature"
								:disabled="!!outputId"
							>
								<el-option
									:value="true"
									:label="t('devicesVirtualPlugin.measurement.temperature')"
								/>
								<el-option
									:value="false"
									:label="t('devicesVirtualPlugin.measurement.generic')"
								/>
							</el-select>
						</el-form-item>
						<template v-if="!isTransform">
							<el-form-item
								:error="validation.error('profile')"
								:label="t('devicesVirtualPlugin.measurement.profile')"
								required
							>
								<el-select
									v-model="model.profile"
									:disabled="!!outputId"
									data-test-id="aggregate-profile"
								>
									<el-option
										v-for="profile in profiles"
										:key="profile.profile"
										:value="profile.profile"
										:label="t(`devicesVirtualPlugin.measurement.profiles.${profile.profile}`)"
									/>
								</el-select>
								<p
									v-if="stepped && selectedProfile?.numeric_policy"
									class="virtual-wizard-field-help"
									data-test-id="aggregate-grid"
								>
									{{ t('devicesVirtualPlugin.measurement.help.unitTitle', { unit: selectedProfile.unit }) }} ·
									{{
										effectiveStep === null
											? t('devicesVirtualPlugin.measurement.help.legacyPrecision')
											: t('devicesVirtualPlugin.measurement.help.precision', { step: effectiveStep, unit: selectedProfile.unit })
									}}
									{{ t('devicesVirtualPlugin.wizard.layout.unitSourcesHint') }}
								</p>
							</el-form-item>
							<el-alert
								v-if="!stepped && selectedProfile?.numeric_policy"
								:title="t('devicesVirtualPlugin.measurement.help.unitTitle', { unit: selectedProfile.unit })"
								:description="
									effectiveStep === null
										? t('devicesVirtualPlugin.measurement.help.legacyPrecision')
										: t('devicesVirtualPlugin.measurement.help.precision', { step: effectiveStep, unit: selectedProfile.unit })
								"
								type="info"
								:closable="false"
								show-icon
								class="mb-3"
								data-test-id="aggregate-grid"
							/>
						</template>
						<div
							v-if="isTransform && !model.temperature"
							class="grid grid-cols-1 sm:grid-cols-2 gap-x-4"
						>
							<el-form-item
								:error="validation.error('quantity')"
								:label="t('devicesVirtualPlugin.measurement.quantity')"
								required
							>
								<el-input
									v-model="model.quantity"
									:disabled="current !== null"
								/>
							</el-form-item>
							<el-form-item
								:error="validation.error('unit')"
								:label="t('devicesVirtualPlugin.measurement.unit')"
								required
							>
								<el-input
									v-model="model.unit"
									:disabled="current !== null"
									:maxlength="32"
								/>
							</el-form-item>
						</div>
						<virtual-placement-fields
							v-if="!outputId"
							v-model:room-id="model.roomId"
							v-model:zone-ids="model.zoneIds"
							:suggest-sources="stepped"
							:disabled="busy"
						/>
					</div>
					<div v-if="at(1)">
						<el-form-item
							:error="validation.error('inputs')"
							:label="stepped ? undefined : t('devicesVirtualPlugin.measurement.inputs')"
							required
						>
							<virtual-wizard-source-picker
								v-if="stepped"
								:sources="availablePickerSources"
								:selected="selectedPickerSources"
								:multiple="!isTransform"
								:room-id="model.roomId"
								:zone-ids="model.zoneIds"
								:room-name="roomName(model.roomId)"
								:disabled="busy || sourcesLoading"
								@add="addSource"
								@remove="removeSource"
							/>
							<div
								v-else
								class="w-full space-y-2"
							>
								<div
									v-for="(input, index) in model.inputs"
									:key="input.id ?? index"
									class="flex gap-2 items-center"
								>
									<el-select
										v-model="input.source_property"
										filterable
										class="grow-1"
										:loading="sourcesLoading"
										:disabled="!isTransform && (sourcesLoading || !!sourcesError)"
										:placeholder="t('devicesVirtualPlugin.measurement.selectSource')"
									>
										<el-option
											v-if="input.source_property && !candidates.some((candidate) => candidate.id === input.source_property)"
											:value="input.source_property"
											disabled
											:label="t('devicesVirtualPlugin.measurement.missing', { id: input.identity ?? input.source_property })"
										/>
										<el-option
											v-if="input.source_property === null"
											:value="''"
											disabled
											:label="t('devicesVirtualPlugin.measurement.missing', { id: input.identity })"
										/>
										<el-option
											v-for="candidate in availableCandidates(index)"
											:key="candidate.id"
											:value="candidate.id"
											:label="`${candidate.label} (${candidate.unit})`"
										/>
									</el-select>
									<el-tag
										v-if="input.identity"
										:type="input.source_property === null ? 'warning' : 'info'"
									>
										{{ input.source_property === null ? t('devicesVirtualPlugin.measurement.missing', { id: input.identity }) : input.identity }}
									</el-tag>

									<virtual-wizard-remove-button
										v-if="!isTransform"
										:label="t('devicesVirtualPlugin.measurement.remove')"
										@click="model.inputs.splice(index, 1)"
									/>
								</div>
								<el-button
									v-if="!isTransform"
									@click="model.inputs.push({ source_property: null, weight: 1 })"
								>
									{{ t('devicesVirtualPlugin.measurement.addInput') }}
								</el-button>
							</div>
						</el-form-item>
					</div>
					<div v-if="at(2)">
						<div :class="isTransform ? 'grid grid-cols-1 md:grid-cols-2 gap-x-4' : 'grid grid-cols-1 gap-x-4 max-w-2xl'">
							<el-form-item
								:error="validation.error('operator')"
								:label="t('devicesVirtualPlugin.measurement.operator')"
								required
							>
								<el-select
									v-if="isTransform"
									v-model="model.operator"
								>
									<el-option
										value="extension"
										:label="t('devicesVirtualPlugin.measurement.extensionOperator')"
									/>
									<el-option
										v-for="operator in transformOperators"
										:key="operator"
										:value="operator"
										:label="t(`devicesVirtualPlugin.measurement.operators.${operator}`)"
										:disabled="[TransformOperator.ntc_beta, TransformOperator.steinhart_hart].includes(operator) && !thermistorAllowed"
									/>
								</el-select>
								<div
									v-else
									class="aggregate-operator"
								>
									<el-radio-group
										v-if="stepped"
										v-model="model.aggregateOperator"
										class="aggregate-operator__buttons"
										:aria-label="t('devicesVirtualPlugin.measurement.operator')"
									>
										<el-radio-button
											v-for="operator in aggregateOperators"
											:key="operator"
											:value="operator"
											:label="t(`devicesVirtualPlugin.measurement.operators.${operator}`)"
										/>
									</el-radio-group>
									<el-select
										v-model="model.aggregateOperator"
										:class="{ 'aggregate-operator__select': stepped }"
										:aria-label="t('devicesVirtualPlugin.measurement.operator')"
									>
										<el-option
											v-for="operator in aggregateOperators"
											:key="operator"
											:value="operator"
											:label="t(`devicesVirtualPlugin.measurement.operators.${operator}`)"
										/>
									</el-select>
								</div>
							</el-form-item>

							<el-form-item
								v-if="!isTransform"
								:error="validation.error('quorum')"
								:label="t('devicesVirtualPlugin.measurement.quorum')"
								required
							>
								<el-input-number
									v-model="model.minimumValidInputs"
									data-test-id="aggregate-quorum"
									:min="1"
									:max="model.inputs.length || 1"
									:precision="0"
									@change="quorumChosen = true"
								/>
							</el-form-item>
							<template v-if="!isTransform && numericPolicy">
								<el-form-item :label="t('devicesVirtualPlugin.measurement.filter')">
									<el-switch
										v-model="model.filterEnabled"
										data-test-id="aggregate-filter"
									/>
								</el-form-item>
								<el-form-item
									v-if="model.filterEnabled"
									:error="validation.error('filterThreshold')"
									:label="t('devicesVirtualPlugin.measurement.filterThreshold', { unit: selectedProfile?.unit })"
									required
								>
									<el-input-number
										v-model="model.filterThreshold"
										:min="0.000001"
										data-test-id="aggregate-filter-threshold"
									/>
								</el-form-item>
							</template>
							<el-form-item
								:error="validation.error('age')"
								:label="t('devicesVirtualPlugin.measurement.maximumAge')"
								required
							>
								<el-input-number
									v-model="model.maximumAgeSeconds"
									:min="1"
									:max="86400"
									:precision="0"
								/>
							</el-form-item>
						</div>
						<div
							v-if="!isTransform && numericPolicy && model.aggregateOperator === AggregateOperator.weighted_mean"
							class="grid grid-cols-1 sm:grid-cols-2 gap-x-4"
						>
							<el-form-item
								v-for="(input, index) in model.inputs"
								:key="index"
								class="measurement-weight"
								:label="`${t('devicesVirtualPlugin.measurement.weight')} · ${weightLabels[index].label}`"
								:error="validation.error(`weight:${index}`)"
								required
							>
								<template #label>
									<el-tooltip
										:content="weightLabels[index].fullLabel"
										:show-after="300"
									>
										<span
											class="block min-w-0 max-w-full truncate"
											tabindex="0"
										>
											{{ t('devicesVirtualPlugin.measurement.weight') }} · {{ weightLabels[index].label }}
										</span>
									</el-tooltip>
								</template>
								<el-input-number
									v-model="input.weight"
									:min="0.000001"
									:max="1000000"
									:precision="6"
									data-test-id="aggregate-weight"
								/>
							</el-form-item>
						</div>
						<template v-if="isTransform">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<section
									v-for="side in ['input', 'output'] as const"
									:key="side"
									class="min-w-0"
								>
									<h3 class="text-sm font-semibold mt-0">{{ t(`devicesVirtualPlugin.conversion.${side}Range`) }}</h3>
									<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
										<el-form-item
											v-for="field in rangeFields.filter((field) => field.startsWith(side))"
											:key="field"
											:error="
												validation.error(field) ||
												validation.error(
													field.startsWith('input')
														? 'inputRange'
														: field.startsWith('output')
															? 'outputRange'
															: field.startsWith('coefficient')
																? 'coefficients'
																: ''
												) ||
												validation.error('operatorRanges')
											"
											:label="t(`devicesVirtualPlugin.measurement.${field}`)"
											required
										>
											<el-input-number
												v-model="model[field]"
												class="w-full"
												:data-test-id="`conversion-${field}`"
											/>
										</el-form-item>
									</div>
								</section>
							</div>
							<template v-if="model.operator === 'extension'">
								<el-form-item
									:error="validation.error('extension')"
									:label="t('devicesVirtualPlugin.measurement.extensionOperator')"
									required
								>
									<el-select
										v-model="model.extensionKey"
										data-test-id="numeric-operator"
										@change="selectOperator"
									>
										<el-option
											v-if="model.extensionKey && !selectedOperator"
											:value="model.extensionKey"
											:label="model.extensionKey"
											disabled
										/>
										<el-option
											v-for="descriptor in numericOperators"
											:key="`${descriptor.operatorId}@${descriptor.operatorVersion}`"
											:value="`${descriptor.operatorId}@${descriptor.operatorVersion}`"
											:label="`${descriptor.operatorId} · v${descriptor.operatorVersion}`"
										/>
									</el-select>
								</el-form-item>
								<el-alert
									v-if="!selectedOperator"
									:title="t('devicesVirtualPlugin.measurement.measurementOperatorMissing')"
									type="warning"
									:closable="false"
								/>
								<template v-else>
									<el-button
										data-test-id="numeric-operator-reset"
										@click="selectOperator"
									>
										{{ t('devicesVirtualPlugin.measurement.resetOperatorDefinition') }}
									</el-button>
									<p data-test-id="numeric-operator-domains">
										{{ selectedOperator.input.quantity }} ({{ selectedOperator.input.unit }}) [{{ selectedOperator.inputRange.minimum }},
										{{ selectedOperator.inputRange.maximum }}] → {{ selectedOperator.output.quantity }} ({{ selectedOperator.output.unit }}) [{{
											selectedOperator.outputRange.minimum
										}}, {{ selectedOperator.outputRange.maximum }}]
									</p>
									<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
										<el-form-item
											v-for="(schema, name) in selectedOperator.parameters"
											:key="name"
											:label="String(name)"
											:error="validation.error(`parameter:${name}`)"
											:required="schema.required"
										>
											<el-input-number
												v-model="model.parameters[name]"
												:min="schema.minimum"
												:max="schema.maximum"
												:data-test-id="`numeric-parameter-${name}`"
												class="w-full"
											/>
											<el-text size="small">
												{{ t('devicesVirtualPlugin.conversion.parameterBounds', { minimum: schema.minimum, maximum: schema.maximum }) }}
											</el-text>
										</el-form-item>
									</div>
								</template>
							</template>
							<div
								v-if="model.operator === TransformOperator.affine"
								class="grid grid-cols-1 sm:grid-cols-2 gap-x-4"
							>
								<el-form-item
									v-for="field in affineFields"
									:key="field"
									:error="
										validation.error(field) ||
										validation.error(
											field.startsWith('input')
												? 'inputRange'
												: field.startsWith('output')
													? 'outputRange'
													: field.startsWith('coefficient')
														? 'coefficients'
														: ''
										) ||
										validation.error('operatorRanges')
									"
									:label="t(`devicesVirtualPlugin.measurement.${field}`)"
									required
								>
									<el-input-number
										v-model="model[field]"
										class="w-full"
										:data-test-id="`conversion-${field}`"
									/>
								</el-form-item>
							</div>
							<div
								v-if="model.operator === TransformOperator.piecewise_linear"
								class="mb-3"
							>
								<h3 class="text-sm font-semibold">{{ t('devicesVirtualPlugin.conversion.calibration') }}</h3>
								<div
									v-for="(point, index) in model.points"
									:key="index"
									class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-x-3 items-end"
								>
									<el-form-item
										:label="t('devicesVirtualPlugin.conversion.calibrationInput', { index: index + 1 })"
										:error="validation.error('points')"
										required
									>
										<el-input-number
											v-model="point.x"
											class="w-full"
											:aria-label="t('devicesVirtualPlugin.conversion.calibrationInput', { index: index + 1 })"
										/>
									</el-form-item>
									<el-form-item
										:label="t('devicesVirtualPlugin.conversion.calibrationOutput', { index: index + 1 })"
										:error="validation.error('points')"
										required
									>
										<el-input-number
											v-model="point.y"
											class="w-full"
											:aria-label="t('devicesVirtualPlugin.conversion.calibrationOutput', { index: index + 1 })"
										/>
									</el-form-item>
									<virtual-wizard-remove-button
										class="mb-4"
										:label="t('devicesVirtualPlugin.measurement.remove')"
										@click="model.points.splice(index, 1)"
									/>
								</div>
								<el-form-item :error="model.points.length ? undefined : validation.error('points')">
									<el-button @click="model.points.push({ x: 0, y: 0 })">{{ t('devicesVirtualPlugin.measurement.addPoint') }}</el-button>
								</el-form-item>
							</div>
							<template v-if="model.operator === TransformOperator.ntc_beta || model.operator === TransformOperator.steinhart_hart">
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
									<el-form-item
										v-for="field in model.operator === TransformOperator.ntc_beta ? ntcFields : steinhartFields"
										:key="field"
										:error="
											validation.error(field) ||
											validation.error(
												field.startsWith('input')
													? 'inputRange'
													: field.startsWith('output')
														? 'outputRange'
														: field.startsWith('coefficient')
															? 'coefficients'
															: ''
											) ||
											validation.error('operatorRanges')
										"
										:label="t(`devicesVirtualPlugin.measurement.${field}`)"
										required
									>
										<el-input-number
											v-model="model[field]"
											class="w-full"
											:data-test-id="`conversion-${field}`"
										/>
									</el-form-item>
								</div>
								<el-form-item
									:error="validation.error('divider')"
									:label="t('devicesVirtualPlugin.measurement.divider')"
									required
								>
									<el-select v-model="model.thermistorLeg">
										<el-option
											:value="Divider.low"
											:label="t('devicesVirtualPlugin.measurement.low')"
										/>
										<el-option
											:value="Divider.high"
											:label="t('devicesVirtualPlugin.measurement.high')"
										/>
									</el-select>
								</el-form-item>
							</template>
							<el-form-item
								:error="validation.error('sample')"
								:label="t('devicesVirtualPlugin.measurement.sample')"
								class="sm:max-w-sm"
							>
								<el-input-number
									v-model="model.previewInput"
									class="w-full"
									data-test-id="conversion-sample"
								/>
							</el-form-item>
						</template>

						<el-alert
							v-if="isTransform"
							:title="t('devicesVirtualPlugin.conversion.processingTitle')"
							type="info"
							:closable="false"
							show-icon
						>
							<p class="mt-0">{{ t(`devicesVirtualPlugin.conversion.operators.${model.operator}`) }}</p>
							<ul class="pl-4 mb-0 space-y-2">
								<li>{{ t('devicesVirtualPlugin.conversion.rangesHelp') }}</li>
								<li>{{ t('devicesVirtualPlugin.conversion.sampleHelp') }}</li>
								<li v-if="model.operator === 'piecewise_linear'">{{ t('devicesVirtualPlugin.conversion.pointsHelp') }}</li>
								<li v-if="isThermistor">{{ t('devicesVirtualPlugin.conversion.thermistorHelp') }}</li>
								<li v-if="!thermistorAllowed">{{ t('devicesVirtualPlugin.conversion.thermistorRequirement') }}</li>
								<li>{{ t('devicesVirtualPlugin.measurement.help.maximumAge') }}</li>
							</ul>
						</el-alert>

						<el-alert
							v-if="!isTransform"
							:title="t('devicesVirtualPlugin.measurement.help.processingTitle')"
							type="info"
							:closable="false"
							show-icon
						>
							<p class="mt-0">{{ t('devicesVirtualPlugin.measurement.help.processingAdvice') }}</p>
							<ul class="pl-4 mb-0 space-y-2">
								<li>
									<strong>{{ operatorLabel }}:</strong>
									{{ t(`devicesVirtualPlugin.measurement.help.operators.${model.aggregateOperator}`) }}
								</li>
								<li>
									<strong>{{ t('devicesVirtualPlugin.measurement.quorum') }}:</strong>
									{{ t('devicesVirtualPlugin.measurement.help.quorum') }}
								</li>
								<li v-if="numericPolicy">
									<strong>{{ t('devicesVirtualPlugin.measurement.filter') }}:</strong>
									{{ t('devicesVirtualPlugin.measurement.help.filter') }}
								</li>
								<li>
									<strong>{{ t('devicesVirtualPlugin.measurement.maximumAge') }}:</strong>
									{{ t('devicesVirtualPlugin.measurement.help.maximumAge') }}
								</li>
							</ul>
						</el-alert>
					</div>
				</el-form>
				<template v-if="stepped && at(3)">
					<virtual-wizard-review-section
						:title="t('devicesVirtualPlugin.wizard.steps.details')"
						:disabled="busy"
						data-test-id="measurement-summary"
						@edit="step = 0"
					>
						<virtual-wizard-descriptions :column="2">
							<el-descriptions-item :label="t('devicesModule.fields.devices.name.title')">{{ model.name }}</el-descriptions-item>
							<el-descriptions-item :label="t('devicesModule.fields.devices.room.title')">{{ roomName(model.roomId) }}</el-descriptions-item>
							<el-descriptions-item :label="t('devicesModule.fields.devices.zones.title')">{{ zoneNames(model.zoneIds) }}</el-descriptions-item>
							<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.profile')">{{ profileLabel }}</el-descriptions-item>
						</virtual-wizard-descriptions>
					</virtual-wizard-review-section>
					<virtual-wizard-review-section
						:title="stepLabels[1]"
						:count="isTransform ? undefined : model.inputs.length"
						:disabled="busy"
						@edit="step = 1"
					>
						<virtual-wizard-source-picker
							:sources="[]"
							:selected="reviewSources"
							read-only
							data-test-id="measurement-review-sources"
						/>
					</virtual-wizard-review-section>
					<virtual-wizard-review-section
						:title="stepLabels[2]"
						data-test-id="measurement-processing-summary"
						:disabled="busy"
						@edit="step = 2"
					>
						<virtual-wizard-descriptions :column="2">
							<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.operator')">{{ operatorLabel }}</el-descriptions-item>
							<template v-if="!isTransform">
								<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.quorum')">
									{{ model.minimumValidInputs }} / {{ model.inputs.length }}
								</el-descriptions-item>
								<el-descriptions-item
									v-if="numericPolicy"
									:label="t('devicesVirtualPlugin.measurement.filter')"
								>
									{{ t(`devicesVirtualPlugin.measurement.help.${model.filterEnabled ? 'enabled' : 'disabled'}`) }}
									<template v-if="model.filterEnabled">· {{ model.filterThreshold }} {{ selectedProfile?.unit }}</template>
								</el-descriptions-item>
							</template>
							<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.maximumAge')">{{ model.maximumAgeSeconds }} s</el-descriptions-item>

							<template v-if="isTransform">
								<el-descriptions-item
									v-for="item in conversionReviewItems"
									:key="item.label"
									:label="item.label"
								>
									{{ item.value }}
								</el-descriptions-item>
							</template>
						</virtual-wizard-descriptions>
					</virtual-wizard-review-section>
				</template>
				<template #aside>
					<virtual-wizard-summary
						v-if="stepped && !at(3)"
						:title="model.name"
						:subtitle="`${t(`devicesVirtualPlugin.measurement.${isTransform ? 'transform' : 'aggregate'}`)} · ${roomName(model.roomId)}`"
						:items="sidebarItems"
					/>

					<div v-show="!stepped || step > 0">
						<virtual-wizard-card
							v-if="stepped || displayPreview || isTransform"
							icon="mdi:calculator"
							body-class="flex flex-col gap-3"
							class="mb-3"
						>
							<template #header>
								<div class="flex items-center justify-between gap-2">
									<strong>
										{{
											t(stepped && !at(3) ? 'devicesVirtualPlugin.wizard.layout.livePreview' : 'devicesVirtualPlugin.measurement.help.previewTitle')
										}}
									</strong>
									<el-button
										v-if="stepped"
										size="small"
										:loading="previewPending || (busy && !submitting)"
										:disabled="busy || !localConfigurationValid || !canPreview"
										@click="refreshSidebar(true)"
									>
										{{ t('devicesVirtualPlugin.wizard.layout.recalculate') }}
									</el-button>
								</div>
							</template>
							<device-wizard-review-checks
								v-if="!stepped"
								:checks="reviewChecks"
							/>

							<el-text v-if="stepped && !displayPreview">
								{{ t('devicesVirtualPlugin.wizard.layout.previewHint') }}
							</el-text>

							<div
								v-if="displayPreview"
								class="flex flex-col gap-3"
								data-test-id="measurement-preview"
							>
								<el-alert
									:title="t('devicesVirtualPlugin.measurement.help.previewTitle')"
									:description="t(`devicesVirtualPlugin.measurement.${isTransform ? 'previewOnly' : 'help.previewDescription'}`)"
									type="info"
									:closable="false"
									show-icon
								/>
								<virtual-wizard-descriptions
									v-if="'preview_result' in displayPreview && displayPreview.preview_result && 'input' in displayPreview.preview_result"
									card-inset
									:column="1"
								>
									<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.sample')">
										{{ previewValue(displayPreview.preview_result.input) }}
									</el-descriptions-item>
									<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.help.result')">
										{{ previewValue(displayPreview.preview_result.value) }} {{ 'unit' in displayPreview ? displayPreview.unit : '' }}
									</el-descriptions-item>
									<el-descriptions-item
										v-if="displayPreview.preview_result.error"
										:label="t('devicesVirtualPlugin.measurement.help.diagnostics')"
									>
										<el-tag :type="isBlockingTransformPreviewError(displayPreview.preview_result.error) ? 'danger' : 'warning'">
											{{ diagnosticLabel(displayPreview.preview_result.error) }}
										</el-tag>
									</el-descriptions-item>
								</virtual-wizard-descriptions>
								<template v-if="aggregatePreview">
									<el-alert
										v-if="stepped && aggregatePreview.inputs.some((input) => input.exclusion === 'offline')"
										:title="t('devicesVirtualPlugin.wizard.layout.offlineHelp')"
										type="warning"
										:closable="false"
									/>
									<virtual-wizard-descriptions
										card-inset
										:column="1"
									>
										<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.profile')">
											{{ t(`devicesVirtualPlugin.measurement.profiles.${aggregatePreview.profile}`) }}
										</el-descriptions-item>
										<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.help.result')">
											<el-text
												size="large"
												data-test-id="aggregate-preview-result"
												class="text-3xl! font-semibold"
											>
												{{ previewValue(aggregatePreview.value, aggregatePreview.output_step) }} {{ aggregatePreview.unit }}
											</el-text>
										</el-descriptions-item>
										<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.help.quality')">
											<el-tag
												:type="aggregatePreview.quality === 'good' ? 'success' : aggregatePreview.quality === 'degraded' ? 'warning' : 'danger'"
												data-test-id="aggregate-preview-quality"
											>
												{{ diagnosticLabel(aggregatePreview.quality) }}
											</el-tag>
										</el-descriptions-item>
										<el-descriptions-item
											v-if="aggregateSummaryReasons.length"
											:label="t('devicesVirtualPlugin.measurement.help.diagnostics')"
										>
											<el-space
												wrap
												data-test-id="aggregate-preview-diagnostics"
											>
												<el-tag
													v-for="reason in aggregateSummaryReasons"
													:key="reason"
													type="warning"
												>
													{{ diagnosticLabel(reason) }}
												</el-tag>
											</el-space>
										</el-descriptions-item>
										<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.help.evaluatedAt')">
											{{ formatTime(aggregatePreview.evaluated_at) }}
										</el-descriptions-item>
										<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.help.expiresAt')">
											{{ formatTime(aggregatePreview.expires_at) }}
										</el-descriptions-item>
									</virtual-wizard-descriptions>

									<el-table
										v-if="!stepped"
										:data="aggregatePreview.inputs"
										row-key="id"
										stripe
									>
										<el-table-column
											:label="t('devicesVirtualPlugin.measurement.selectSource')"
											min-width="220"
										>
											<template #default="{ row }">{{ sourceLabel(row) }}</template>
										</el-table-column>
										<el-table-column
											:label="t('devicesVirtualPlugin.measurement.help.result')"
											min-width="120"
										>
											<template #default="{ row }">{{ previewValue(row.current_value) }} {{ row.unit }}</template>
										</el-table-column>
										<el-table-column
											:label="t('devicesVirtualPlugin.measurement.help.inputStatus')"
											min-width="180"
										>
											<template #default="{ row }">
												<el-tag :type="row.exclusion ? 'warning' : 'success'">
													{{ row.exclusion ? diagnosticLabel(row.exclusion) : t('devicesVirtualPlugin.measurement.help.included') }}
												</el-tag>
											</template>
										</el-table-column>
										<el-table-column
											:label="t('devicesVirtualPlugin.measurement.help.sampleAge')"
											min-width="130"
										>
											<template #default="{ row }">
												{{ row.age_seconds === null || row.age_seconds === undefined ? '—' : `${previewValue(row.age_seconds)} s` }}
											</template>
										</el-table-column>
									</el-table>
								</template>
							</div>
						</virtual-wizard-card>
						<div
							v-if="current && 'source' in current"
							class="mb-3"
						>
							<p>{{ current.source.current_value ?? '—' }} {{ current.source.unit }} → {{ current.current_value ?? '—' }} {{ current.unit }}</p>
							<el-text type="warning">{{ current.errors.map(diagnosticLabel).join(', ') }}</el-text>
						</div>
						<div
							v-if="current && 'inputs' in current"
							class="mb-3"
						>
							<div
								v-for="input in current.inputs"
								:key="input.id"
							>
								<code>{{ input.source_identity }}</code>
								· {{ diagnosticLabel(input.exclusion) }} · {{ t('devicesVirtualPlugin.measurement.sampleAge', { age: input.age_seconds ?? '—' }) }}
							</div>
						</div>
						<el-alert
							v-if="previewExpired && !stepped"
							:title="t('devicesVirtualPlugin.measurement.previewExpired')"
							type="warning"
							:closable="false"
						/>
					</div>
				</template>
			</virtual-wizard-layout>
			<template #final>
				<el-button
					v-if="!stepped || !preview || previewExpired"
					:loading="busy"
					:disabled="
						!canPreview ||
						loading ||
						!!catalogError ||
						(!isTransform && (!selectedProfile || sourcesLoading || !!sourcesError)) ||
						(isTransform && !model.temperature && (!model.quantity.trim() || !model.unit.trim())) ||
						(!outputId && !model.name.trim())
					"
					@click="checkDraft"
				>
					{{ t('devicesVirtualPlugin.measurement.preview') }}
				</el-button>
				<el-button
					type="primary"
					:loading="busy"
					:disabled="!canSavePreview || loading || !!catalogError"
					@click="submit"
				>
					{{ t(`devicesVirtualPlugin.measurement.${outputId ? 'save' : 'create'}`) }}
				</el-button>
			</template>
		</device-wizard-steps>
	</el-card>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElDescriptionsItem,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElRadioButton,
	ElRadioGroup,
	ElSelect,
	ElSpace,
	ElSwitch,
	ElTable,
	ElTableColumn,
	ElTag,
	ElText,
	ElTooltip,
	vLoading,
} from 'element-plus';

import { injectStoresManager } from '../../../common';
import type { IWizardReviewCheck } from '../../../modules/devices/components/wizard/device-wizard-review-checks.types';
import DeviceWizardReviewChecks from '../../../modules/devices/components/wizard/device-wizard-review-checks.vue';
import DeviceWizardSteps from '../../../modules/devices/components/wizard/device-wizard-steps.vue';
import type { IWizardAction } from '../../../modules/devices/components/wizard/device-wizard.types';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	DevicesVirtualPluginConfigureAggregateOperator as AggregateOperator,
	DevicesVirtualPluginNumericTransformPolicyOperator as TransformOperator,
} from '../../../openapi';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { useMeasurementAuthoring } from '../composables/use-measurement-authoring';
import { usePlacementNames } from '../composables/use-placement-names';
import { useVirtualWizardError } from '../composables/use-virtual-wizard-error';
import { provideVirtualWizardPlacement } from '../composables/use-virtual-wizard-placement';
import {
	type MeasurementMode,
	aggregateCandidates,
	isBlockingTransformPreviewError,
	measurementCandidates,
	preferCanonicalMeasurementSources,
} from '../utils/measurement-authoring.utils';
import { formatSourceSampleAge, sourceSampleAge } from '../utils/source-sample-age';
import { transformDraftChecks } from '../utils/transform-draft-validation';

import VirtualPlacementFields from './virtual-placement-fields.vue';
import VirtualWizardCard from './virtual-wizard-card.vue';
import VirtualWizardDescriptions from './virtual-wizard-descriptions.vue';
import VirtualWizardLayout from './virtual-wizard-layout.vue';
import VirtualWizardRemoveButton from './virtual-wizard-remove-button.vue';
import VirtualWizardReviewSection from './virtual-wizard-review-section.vue';
import type { VirtualWizardSource } from './virtual-wizard-source-picker.types';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';
import VirtualWizardSummary from './virtual-wizard-summary.vue';

// `temperature` defaults to `undefined` explicitly: Vue casts an absent boolean prop to `false`, which
// made the `?? true` below dead code and opened every new conversion on the generic profile.
const props = withDefaults(defineProps<{ mode: MeasurementMode; outputId?: string; temperature?: boolean; wizard?: boolean }>(), {
	outputId: undefined,
	temperature: undefined,
});
const emit = defineEmits<{ created: [deviceId: string]; busy: [value: boolean] }>();
const { t, te, locale } = useI18n();
const stores = injectStoresManager(),
	devices = stores.getStore(devicesStoreKey),
	channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey);
const {
	numericOperators,
	selectedOperator,
	selectOperator,
	profiles,
	invalidatePreview,
	previewExpired,
	canSavePreview,
	selectedProfile,
	numericPolicy,
	sources,
	sourcesLoading,
	sourcesError,
	loadCapabilities,
	model,
	busy,
	error,
	conflict,
	current,
	preview,
	lastPreview,
	isTransform,
	canPreview,
	load,
	previewDraft,
	evaluateDraft,
	save,
} = useMeasurementAuthoring(props.mode, props.outputId);
watch(busy, (value) => emit('busy', value), { immediate: true });
model.temperature = props.temperature ?? true;
// The generic output slot refuses `temperature` as its quantity (that is what the temperature profile
// is for), so the two profiles cannot share one pre-filled quantity: carrying `temperature / °C` over
// to the generic profile produced a draft the backend always rejected as `incompatible_output`.
const syncProfileQuantity = (temperature: boolean): void => {
	if (props.outputId) return;
	if (temperature) {
		model.quantity = 'temperature';
		model.unit = '°C';
	} else if (model.quantity === 'temperature') {
		model.quantity = '';
		model.unit = '';
	}
};
syncProfileQuantity(model.temperature);
watch(() => model.temperature, syncProfileQuantity);
if (isTransform) model.inputs = [{ source_property: null }];
// A new aggregate asks for every configured source until the user picks a quorum of their own: an
// average of three sensors should not silently become the reading of whichever one still answers.
const { roomName, zoneNames } = usePlacementNames();
const quorumChosen = ref(false);
watch(
	() => model.inputs.length,
	(count) => {
		if (!isTransform && !props.outputId && !quorumChosen.value) model.minimumValidInputs = Math.max(1, count);
	},
	{ immediate: true }
);
const loading = ref(false),
	catalogError = ref<string | null>(null);
const catalogLoading = computed(() => loading.value || (!isTransform && sourcesLoading.value));
const candidates = computed(() =>
	isTransform
		? measurementCandidates(props.mode, devices.findAll(), channels.findAll(), properties.findAll()).filter(
				(candidate) =>
					model.operator !== 'extension' ||
					!selectedOperator.value ||
					(candidate.quantity === selectedOperator.value.input.quantity && candidate.unit === selectedOperator.value.input.unit)
			)
		: selectedProfile.value
			? aggregateCandidates(sources.value, devices.findAll(), channels.findAll(), properties.findAll(), selectedProfile.value)
			: []
);
const sidebarPreview = ref<Awaited<ReturnType<typeof evaluateDraft>> | null>(null);
const previewPending = ref(false);

const displayPreview = computed(() => (stepped.value ? (step.value === 3 ? lastPreview.value : sidebarPreview.value) : preview.value));
const aggregatePreview = computed(() => (displayPreview.value && 'inputs' in displayPreview.value ? displayPreview.value.preview_result : null));
const aggregateSummaryReasons = computed(() => {
	const snapshot = aggregatePreview.value;
	if (!snapshot) return [];
	const inputReasons = new Set(snapshot.inputs.filter((input) => input.exclusion).map((input) => `${input.exclusion}:${input.id}`));
	return snapshot.reasons.filter((reason) => !inputReasons.has(reason));
});
// Creation in the wizard walks the same form in four steps — output, sources, processing, review —
// by showing one section at a time. Editing an existing measurement keeps the single page.
const stepped = computed<boolean>(() => props.wizard === true && !props.outputId);
const step = ref(0);
const submitting = ref(false);
const REVIEW_STEP = 3;
const at = (index: number): boolean => !stepped.value || step.value === index;
const stepLabels = computed<string[]>(() =>
	['output', 'sources', 'processing', 'review'].map((key) => t(`devicesVirtualPlugin.wizard.steps.${key}`))
);
const canAdvance = computed(() => !catalogLoading.value && !catalogError.value && (step.value !== 1 || !sourcesError.value));

const profileLabel = computed<string>(() =>
	isTransform
		? model.temperature
			? t('devicesVirtualPlugin.measurement.temperature')
			: `${t('devicesVirtualPlugin.measurement.generic')} · ${model.quantity} (${model.unit})`
		: selectedProfile.value
			? t(`devicesVirtualPlugin.measurement.profiles.${selectedProfile.value.profile}`)
			: ''
);
const inputLabels = computed<string[]>(() =>
	model.inputs.map((input) => {
		const candidate = candidates.value.find((entry) => entry.id === input.source_property);
		const label = candidate ? `${candidate.label} (${candidate.unit})` : String(input.source_property ?? '—');
		return !isTransform && model.aggregateOperator === AggregateOperator.weighted_mean
			? `${label} · ${t('devicesVirtualPlugin.measurement.weight')}: ${input.weight ?? 1}`
			: label;
	})
);

const weightLabels = computed(() => {
	const selected = model.inputs.map((input, index) => {
		const property = input.source_property ? properties.findById(input.source_property) : null;
		const channel = property ? channels.findById(property.channel) : null;
		const device = channel ? devices.findById(channel.device) : null;
		const candidate = candidates.value.find((entry) => entry.id === input.source_property);
		return {
			property,
			channel,
			device,
			index,
			fullLabel: candidate ? `${candidate.label} (${candidate.unit})` : String(input.identity ?? input.source_property ?? '—'),
		};
	});
	return selected.map((source) => {
		let label = source.device?.name || `${t('devicesVirtualPlugin.measurement.selectSource')} ${source.index + 1}`;
		if (source.device && selected.filter((entry) => entry.device?.id === source.device!.id).length > 1) {
			const channelName = source.channel?.name || (source.channel ? t(`devicesModule.categories.channels.${source.channel.category}`) : '');
			const propertyName =
				source.property?.name || (source.property ? t(`devicesModule.categories.channelsProperties.${source.property.category}`) : '');
			label += ` · ${channelName || source.index + 1}`;
			if (selected.filter((entry) => entry.channel?.id === source.channel?.id).length > 1) label += ` · ${propertyName || source.index + 1}`;
		}
		return { label, fullLabel: source.fullLabel };
	});
});
const operatorLabel = computed<string>(() =>
	isTransform
		? model.operator === 'extension'
			? (selectedOperator.value?.operatorId ?? t('devicesVirtualPlugin.measurement.extensionOperator'))
			: t(`devicesVirtualPlugin.measurement.operators.${model.operator}`)
		: t(`devicesVirtualPlugin.measurement.operators.${model.aggregateOperator}`)
);
const previewValue = (value: number | boolean | null | undefined, step?: number | null): string => {
	if (value == null) return '—';
	if (typeof value === 'boolean') return t(`devicesVirtualPlugin.measurement.${value ? 'detected' : 'notDetected'}`);
	// Presentation precision only: the backend has already evaluated and rounded this value.
	if (!(step && step > 0)) return String(value);
	const [coefficient, exponent] = String(step).split('e');
	const digits = Math.max(0, (coefficient.split('.')[1] ?? '').length - Number(exponent ?? 0));
	if (digits > 20) return String(value);
	return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
};
// Live sample changes affect inline calculations, not configuration validity in the creation wizard.
watch(
	() =>
		model.inputs.map((input) => {
			if (stepped.value || !input.source_property) return null;
			const property = input.source_property ? properties.findById(input.source_property) : null;
			const channel = property ? channels.findById(property.channel) : null;
			const device = channel ? devices.findById(channel.device) : null;
			return { property, channel, device };
		}),
	() => {
		if (!stepped.value) invalidatePreview();
	},
	{ deep: true, flush: 'sync' }
);
watch(() => (props.outputId ? properties.findById(props.outputId)?.value?.producer?.revision : undefined), invalidatePreview, { flush: 'sync' });
const effectiveStep = computed(() =>
	current.value && 'output_step' in current.value ? current.value.output_step : (selectedProfile.value?.output_step ?? null)
);
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
onUnmounted(() => clearInterval(clock));
const liveProducer = computed(() => (props.outputId ? properties.findById(props.outputId) : null)?.value?.producer);
const liveReasons = computed(() => [
	...(liveProducer.value?.reasons ?? []),
	...(liveProducer.value?.expiresAt && Date.parse(liveProducer.value.expiresAt) <= now.value ? ['stale'] : []),
]);
const liveQuality = computed(() => {
	const producer = liveProducer.value;
	return producer &&
		producer.quality !== 'unavailable' &&
		producer.sampledAt &&
		producer.expiresAt &&
		Date.parse(producer.sampledAt) <= now.value &&
		Date.parse(producer.evaluatedAt) >= Date.parse(producer.sampledAt) &&
		Date.parse(producer.evaluatedAt) <= now.value &&
		Date.parse(producer.expiresAt) > now.value
		? producer.quality
		: 'unavailable';
});
const availableCandidates = (index: number) =>
	candidates.value.filter((candidate) => !model.inputs.some((input, other) => other !== index && input.source_property === candidate.id));
const thermistorAllowed = computed(
	() =>
		!!model.inputs[0]?.source_property &&
		model.temperature &&
		candidates.value.some((candidate) => candidate.id === model.inputs[0]?.source_property && candidate.thermistorVoltage === true)
);
const Divider = { low: 'low', high: 'high' } as const;
const rangeFields = ['inputMinimum', 'inputMaximum', 'outputMinimum', 'outputMaximum'] as const;
const affineFields = ['scale', 'offset'] as const;
const ntcFields = ['referenceVoltage', 'seriesResistance', 'nominalResistance', 'nominalTemperatureCelsius', 'beta'] as const;
const steinhartFields = ['referenceVoltage', 'seriesResistance', 'coefficientA', 'coefficientB', 'coefficientC'] as const;
const isThermistor = computed(() => [TransformOperator.ntc_beta, TransformOperator.steinhart_hart].includes(model.operator as TransformOperator));
const localChecks = computed(() => (isTransform ? transformDraftChecks(model, selectedOperator.value) : []));
const localConfigurationValid = computed(() => localChecks.value.every((check) => check.valid) && (!isThermistor.value || thermistorAllowed.value));
const reviewChecks = computed<IWizardReviewCheck[]>(() => {
	const checks: IWizardReviewCheck[] = [
		{
			id: 'source',
			label: t('devicesVirtualPlugin.measurement.inputs'),
			value: inputLabels.value.join(', ') || '—',
			status: model.inputs.length > 0 && model.inputs.every((input) => !!input.source_property) ? 'success' : 'error',
			detail:
				model.inputs.every((input) => !!input.source_property) && model.inputs.length
					? undefined
					: t('devicesVirtualPlugin.conversion.validation.sourceRequired'),
		},
	];
	for (const check of localChecks.value)
		checks.push({
			id: check.id,
			label: check.literalLabel ?? t(`devicesVirtualPlugin.${check.label}`),
			value: check.value,
			status: !check.valid ? 'error' : check.info ? 'info' : 'success',
			detail: check.message && (!check.valid || check.info) ? t(`devicesVirtualPlugin.conversion.validation.${check.message}`) : undefined,
		});
	if (isThermistor.value)
		checks.push({
			id: 'compatibility',
			label: t('devicesVirtualPlugin.conversion.sourceCompatibility'),
			status: thermistorAllowed.value ? 'success' : 'error',
			detail: thermistorAllowed.value ? undefined : t('devicesVirtualPlugin.conversion.thermistorRequirement'),
		});
	const failure = error.value ?? catalogError.value;
	const sampleError = displayPreview.value && 'policy' in displayPreview.value ? displayPreview.value.preview_result?.error : undefined;
	checks.push({
		id: 'backend',
		label: t('devicesVirtualPlugin.conversion.backendCheck'),
		status: failure || isBlockingTransformPreviewError(sampleError) ? 'error' : displayPreview.value ? 'success' : 'info',
		detail: failure
			? message(failure)
			: isBlockingTransformPreviewError(sampleError)
				? diagnosticLabel(sampleError)
				: displayPreview.value
					? undefined
					: t(`devicesVirtualPlugin.conversion.validation.${busy.value ? 'checking' : 'notChecked'}`),
	});
	return checks;
});
const checkDraft = async () => {
	if (isTransform && !localConfigurationValid.value) {
		invalidatePreview();
		return;
	}
	await previewDraft();
};
const requiredField = () => t('devicesModule.wizard.validation.required');
const invalidField = () => t('devicesModule.wizard.validation.invalidValue');
const validation = useWizardValidation(step, () => {
	if (step.value === 0)
		return {
			name: model.name.trim() ? undefined : t('devicesModule.fields.devices.name.validation.required'),
			profile: isTransform || selectedProfile.value ? undefined : requiredField(),
			quantity: !isTransform || model.temperature || model.quantity.trim() ? undefined : requiredField(),
			unit: !isTransform || model.temperature || model.unit.trim() ? undefined : requiredField(),
		};
	if (step.value === 1)
		return {
			inputs:
				(isTransform ? model.inputs.length === 1 : model.inputs.length >= 2) &&
				model.inputs.every((input) => !!input.source_property) &&
				new Set(model.inputs.map((input) => input.source_property)).size === model.inputs.length
					? undefined
					: t('devicesModule.wizard.validation.minimumItems', { count: isTransform ? 1 : 2 }),
		};
	const errors: Record<string, string | undefined> = {};
	for (const check of localChecks.value) if (!check.valid) errors[check.id] = t(`devicesVirtualPlugin.conversion.validation.${check.message}`);
	if (isThermistor.value && !thermistorAllowed.value) errors.operator = t('devicesVirtualPlugin.conversion.thermistorRequirement');
	if (!isTransform) {
		if (!aggregateOperators.value.includes(model.aggregateOperator as (typeof aggregateOperators.value)[number])) errors.operator = invalidField();
		if (!Number.isInteger(model.minimumValidInputs) || model.minimumValidInputs < 1 || model.minimumValidInputs > model.inputs.length)
			errors.quorum = t('devicesModule.wizard.validation.numberRange', { minimum: 1, maximum: model.inputs.length });
		if (!Number.isInteger(model.maximumAgeSeconds) || model.maximumAgeSeconds < 1 || model.maximumAgeSeconds > 86400)
			errors.age = t('devicesVirtualPlugin.conversion.validation.ageBounds');
		if (numericPolicy.value && model.filterEnabled && !(Number.isFinite(model.filterThreshold) && model.filterThreshold! > 0))
			errors.filterThreshold = invalidField();
		if (model.aggregateOperator === AggregateOperator.weighted_mean)
			model.inputs.forEach((input, index) => {
				if (!(Number.isFinite(input.weight) && input.weight! > 0)) errors[`weight:${index}`] = invalidField();
			});
	}
	return errors;
});
const beforeNext = async (): Promise<boolean> => {
	if (!validation.validate()) return false;
	if (step.value !== REVIEW_STEP - 1) return true;
	await checkDraft();
	const checked = lastPreview.value;
	return !!checked && !error.value && !catalogError.value && !('policy' in checked && isBlockingTransformPreviewError(checked.preview_result?.error));
};
const transformOperators = Object.values(TransformOperator),
	aggregateOperators = computed(() => selectedProfile.value?.operators ?? []);
const message = (key: string | null) => (key?.startsWith('measurement') ? t(`devicesVirtualPlugin.measurement.${key}`) : (key ?? ''));
const diagnosticLabel = (value: string | null | undefined): string => {
	if (!value) return '—';
	const [code, identity] = value.split(':', 2);
	const key = `devicesVirtualPlugin.measurement.states.${code}`;
	return te(key) ? `${t(key)}${identity ? ` · ${identity}` : ''}` : `${t('devicesVirtualPlugin.measurement.states.unknown')} (${value})`;
};
const formatTime = (value: string | null): string => (value ? new Date(value).toLocaleString() : '—');
const sourceLabel = (input: { id: string; source_property?: string | null; source_identity: string }): string => {
	const property = input.source_property ?? model.inputs.find((entry) => entry.id === input.id)?.source_property ?? input.source_identity;
	return candidates.value.find((candidate) => candidate.id === property)?.label ?? input.source_identity;
};
const reload = async () => {
	loading.value = true;
	catalogError.value = null;
	try {
		// One request: the devices list embeds every channel and its properties and the store cascades
		// them into the channel and property stores. Fetching properties per channel on top of that is
		// hundreds of requests on a real installation, which the backend rate limiter answers with 429s.
		await devices.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
		await load();
		await loadCapabilities();
		if (stepped.value && step.value === REVIEW_STEP) step.value = REVIEW_STEP - 1;
	} catch {
		catalogError.value = 'measurementCatalog';
	} finally {
		loading.value = false;
	}
};
const submit = async () => {
	if (!localConfigurationValid.value || (stepped.value && !lastPreview.value)) return;
	submitting.value = true;
	try {
		// The server still validates source contracts and graph revisions atomically. A sample
		// being offline, stale or unavailable does not invalidate the reviewed configuration.
		const deviceId = await save();
		if (deviceId) emit('created', deviceId);
	} finally {
		submitting.value = false;
	}
};

const conversionReviewItems = computed(() => {
	const fields = [
		'inputMinimum',
		'inputMaximum',
		'outputMinimum',
		'outputMaximum',
		...(model.operator === 'affine' ? ['scale', 'offset'] : []),
		...(model.operator === 'ntc_beta' ? ntcFields : model.operator === 'steinhart_hart' ? steinhartFields : []),
	];
	const entries = [...new Set(fields)].map((field) => ({
		label: t(`devicesVirtualPlugin.measurement.${field}`),
		value: String(model[field as keyof typeof model] ?? '—'),
	}));
	if (isThermistor.value)
		entries.push({ label: t('devicesVirtualPlugin.measurement.divider'), value: t(`devicesVirtualPlugin.measurement.${model.thermistorLeg}`) });
	if (model.operator === 'piecewise_linear')
		entries.push({
			label: t('devicesVirtualPlugin.conversion.calibration'),
			value: model.points.map((point) => `${point.x} → ${point.y}`).join(', '),
		});
	if (model.operator === 'extension') entries.push(...Object.entries(model.parameters).map(([label, value]) => ({ label, value: String(value) })));
	return entries;
});
const layoutTitle = computed(() =>
	step.value === 3
		? t('devicesVirtualPlugin.wizard.layout.reviewTitle')
		: !isTransform || step.value === 0
			? t(`devicesVirtualPlugin.wizard.layout.${['outputTitle', 'sourcesTitle', 'processingTitle'][step.value]}`)
			: stepLabels.value[step.value]
);
const layoutDescription = computed(() =>
	t(
		`devicesVirtualPlugin.wizard.layout.${['measurementDescription', 'sourcesDescription', 'processingDescription', 'reviewDescription'][step.value]}`
	)
);
const sidebarItems = computed(() => [
	{ label: t('devicesVirtualPlugin.measurement.profile'), value: profileLabel.value },
	{
		label: t('devicesVirtualPlugin.measurement.inputs'),
		value: t('devicesVirtualPlugin.wizard.layout.selectedCount', { count: model.inputs.filter((input) => input.source_property).length }),
	},
	{ label: t('devicesVirtualPlugin.measurement.operator'), value: operatorLabel.value },
]);
const pickerSources = computed<VirtualWizardSource[]>(() => {
	const propertyById = new Map(properties.findAll().map((property) => [property.id, property]));
	const channelById = new Map(channels.findAll().map((channel) => [channel.id, channel]));
	const deviceById = new Map(devices.findAll().map((device) => [device.id, device]));
	return candidates.value.map((candidate) => {
		const property = propertyById.get(candidate.id);
		const channel = property && channelById.get(property.channel);
		const device = channel && deviceById.get(channel.device);
		const age = sourceSampleAge(property?.value?.lastUpdated, Date.now());
		const value = property?.value?.value;
		const hasReading = device?.status?.online !== false && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)));
		return {
			id: candidate.id,
			name: device?.name ?? candidate.label,
			detail:
				channel && property
					? `${channel.name ?? t(`devicesModule.categories.channels.${channel.category}`)} › ${property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`)}`
					: candidate.label,
			roomId: device?.roomId ?? null,
			zoneIds: device?.zoneIds ?? [],
			room: roomName(device?.roomId ?? null),
			online: device?.status?.online ?? null,
			reading: hasReading ? `${previewValue(value as number | boolean)} ${candidate.unit ?? ''}`.trim() : '—',
			readingHint: hasReading && age === null ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTimeHint') : undefined,
			age: hasReading && age === null ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTime') : formatSourceSampleAge(age, locale?.value),
		};
	});
});
// Keep all metadata for saved bindings; collapse duplicate physical readings only in the add list.
const availablePickerSources = computed(() =>
	preferCanonicalMeasurementSources(pickerSources.value, devices.findAll(), channels.findAll(), properties.findAll())
);
const selectedPickerSources = computed(() =>
	model.inputs
		.filter((input) => input.source_property)
		.map((input) => {
			const source = pickerSources.value.find((source) => source.id === input.source_property);
			const property = properties.findById(input.source_property!);
			const age = sourceSampleAge(property?.value?.lastUpdated, now.value);
			return source
				? {
						...source,
						age:
							source.reading !== '—' && age === null
								? t('devicesVirtualPlugin.wizard.layout.unknownSampleTime')
								: formatSourceSampleAge(age, locale?.value),
					}
				: {
						id: input.source_property!,
						name: t('devicesVirtualPlugin.measurement.missing', { id: input.identity ?? input.source_property }),
						detail: '',
						roomId: null,
						room: '—',
						reading: '—',
						age: '—',
						online: null,
					};
		})
);

const reviewSources = ref<VirtualWizardSource[]>([]);
watch(
	lastPreview,
	(snapshot) => {
		if (!stepped.value || !snapshot) {
			reviewSources.value = [];
			return;
		}
		const evaluatedAt = 'inputs' in snapshot ? Date.parse(snapshot.preview_result?.evaluated_at ?? '') : now.value;
		reviewSources.value = model.inputs.map((input) => {
			const metadata = selectedPickerSources.value.find((source) => source.id === input.source_property);
			const evidence =
				'inputs' in snapshot
					? snapshot.preview_result?.inputs.find((source) => (source.source_property ?? source.source_identity) === input.source_property)
					: snapshot.source;
			const age =
				evidence?.sampled_at !== undefined
					? sourceSampleAge(evidence.sampled_at, Number.isFinite(evaluatedAt) ? evaluatedAt : now.value)
					: (evidence?.age_seconds ?? null);
			const exclusion = evidence?.exclusion;
			return {
				id: input.source_property ?? input.id ?? '',
				name: metadata?.name ?? '—',
				detail: metadata?.detail ?? '',
				roomId: metadata?.roomId ?? null,
				room: metadata?.room ?? '—',
				online: metadata?.online ?? null,
				reading: evidence?.current_value == null ? '—' : `${previewValue(evidence.current_value)} ${evidence.unit ?? ''}`.trim(),
				age: formatSourceSampleAge(age, locale?.value),
				...(!isTransform && model.aggregateOperator === AggregateOperator.weighted_mean ? { weight: input.weight ?? 1 } : {}),
				...(evidence
					? {
							state: {
								label: exclusion ? diagnosticLabel(exclusion) : t('devicesVirtualPlugin.measurement.help.included'),
								type: exclusion ? ('warning' as const) : ('success' as const),
							},
						}
					: {}),
			};
		});
	},
	{ flush: 'sync' }
);
const addSource = (id: string) => {
	if (busy.value || model.inputs.some((input) => input.source_property === id)) return;
	if (isTransform) model.inputs = [{ source_property: id }];
	else model.inputs.push({ source_property: id, weight: 1 });
};
const removeSource = (id: string) => {
	if (busy.value) return;
	model.inputs = isTransform ? [{ source_property: null }] : model.inputs.filter((input) => input.source_property !== id);
};
// Background evaluation never changes the reviewed snapshot or authorization to save. A generation
// fence also covers transports that do not observe AbortSignal promptly.
let sidebarGeneration = 0;
let sidebarRequest: AbortController | undefined;
let sidebarTimer: ReturnType<typeof setTimeout> | undefined;
const stopSidebar = () => {
	sidebarGeneration++;
	clearTimeout(sidebarTimer);
	sidebarRequest?.abort();
	previewPending.value = false;
};
const refreshSidebar = async (reportFailure = false) => {
	if (step.value === 3) {
		await checkDraft();
		return;
	}
	stopSidebar();
	if (!stepped.value || busy.value || !canPreview.value || !localConfigurationValid.value) return;
	const generation = sidebarGeneration;
	const request = (sidebarRequest = new AbortController());
	const timeout = setTimeout(() => request.abort(), 10000);
	previewPending.value = true;

	try {
		const value = await evaluateDraft(request.signal);
		if (generation === sidebarGeneration) sidebarPreview.value = value;
	} catch {
		if (generation === sidebarGeneration && reportFailure) notifyError(t('devicesVirtualPlugin.wizard.layout.previewError'));
	} finally {
		clearTimeout(timeout);
		if (generation === sidebarGeneration) previewPending.value = false;
	}
};
watch(
	[
		() => JSON.stringify(model),
		step,
		busy,
		() =>
			JSON.stringify(
				model.inputs.map((input) => {
					if (!input.source_property) return null;
					const property = input.source_property ? properties.findById(input.source_property) : null;
					const channel = property ? channels.findById(property.channel) : null;
					return [property?.value, (channel ? devices.findById(channel.device) : null)?.status];
				})
			),
	],
	() => {
		stopSidebar();

		if (!stepped.value || step.value === 0 || step.value === 3 || busy.value) return;
		// Keep the previous calculation visible while refreshing. It never authorizes saving.
		previewPending.value = true;
		sidebarTimer = setTimeout(
			() => {
				if (canPreview.value && localConfigurationValid.value) void refreshSidebar();
				else {
					previewPending.value = false;
					sidebarPreview.value = null;
				}
			},
			isTransform ? 700 : 350
		);
	},
	{ flush: 'post' }
);
onUnmounted(stopSidebar);
onMounted(() => {
	void reload();
	clock = setInterval(() => {
		now.value = Date.now();
	}, 1000);
});
const wizardFinalActions = computed<IWizardAction[]>(() => [
	{
		id: 'create',
		label: t('devicesVirtualPlugin.measurement.create'),
		variant: 'primary',
		disabled:
			!lastPreview.value ||
			!canPreview.value ||
			!localConfigurationValid.value ||
			(isTransform &&
				!!displayPreview.value &&
				'policy' in displayPreview.value &&
				isBlockingTransformPreviewError(displayPreview.value.preview_result?.error)) ||
			loading.value ||
			!!catalogError.value ||
			conflict.value,
		handler: submit,
	},
]);

provideVirtualWizardPlacement(computed(() => (stepped.value ? { roomId: model.roomId, zoneIds: model.zoneIds } : {})));
const notifyError = useVirtualWizardError(() => message(error.value ?? catalogError.value ?? sourcesError.value));
</script>

<style scoped>
.measurement-weight {
	min-width: 0;
}
.measurement-weight :deep(.el-form-item__label) {
	min-width: 0;
	max-width: 100%;
}

.aggregate-operator {
	container-type: inline-size;
	width: 100%;
	min-width: 0;
}
.aggregate-operator__buttons {
	display: inline-flex;
	flex-wrap: nowrap;
	max-width: 100%;
}
.aggregate-operator__buttons :deep(.el-radio-button__inner) {
	padding-inline: 12px;
	white-space: nowrap;
}
.aggregate-operator__select {
	display: none;
}
@container (max-width: 560px) {
	.aggregate-operator__buttons {
		display: none;
	}
	.aggregate-operator__select {
		display: block;
	}
}
</style>
