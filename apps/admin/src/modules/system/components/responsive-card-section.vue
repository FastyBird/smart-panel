<template>
	<el-card
		v-if="isMDDevice"
		shadow="never"
		body-class="p-0!"
	>
		<template #header>
			<slot name="header" />
		</template>

		<slot />
	</el-card>

	<div v-else>
		<div class="mb-3">
			<slot name="header" />
		</div>

		<slot />
	</div>
</template>

<script setup lang="ts">
// Renders children as a bordered el-card (with the #header slot in its header
// region) on desktop, and as a plain div (with the header rendered inline
// above the body) on mobile. Callers supply the header content once via the
// named slot instead of duplicating it per breakpoint branch.
defineProps<{ isMDDevice: boolean }>();
</script>
