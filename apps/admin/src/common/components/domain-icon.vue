<template>
	<span
		:class="['inline-flex items-center justify-center shrink-0 rounded-[8px]', TONES[props.domain]]"
		:style="{ width: `${props.size}px`, height: `${props.size}px` }"
		:data-domain="props.domain"
		aria-hidden="true"
		data-test-id="domain-icon"
	>
		<icon
			:icon="ICONS[props.domain]"
			:width="Math.round(props.size * 0.6)"
			:height="Math.round(props.size * 0.6)"
		/>
	</span>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

import type { Domain, DomainIconProps } from './domain-icon.types';

defineOptions({
	name: 'DomainIcon',
});

const props = withDefaults(defineProps<DomainIconProps>(), {
	size: 32,
});

// The wall display's domain icons (apps/panel domain_type.dart); cameras added for the admin
const ICONS: Record<Domain, string> = {
	lights: 'mdi:lightbulb-outline',
	climate: 'mdi:thermometer',
	covers: 'mdi:blinds-horizontal',
	media: 'mdi:play-circle-outline',
	sensors: 'mdi:access-point',
	energy: 'mdi:flash-outline',
	cameras: 'mdi:cctv',
};

// A tinted tile beside a domain name, never a status (spec section 2)
const TONES: Record<Domain, string> = {
	lights: 'text-[var(--fb-domain-lights)] bg-[var(--fb-domain-lights-soft)]',
	climate: 'text-[var(--fb-domain-climate)] bg-[var(--fb-domain-climate-soft)]',
	covers: 'text-[var(--fb-domain-covers)] bg-[var(--fb-domain-covers-soft)]',
	media: 'text-[var(--fb-domain-media)] bg-[var(--fb-domain-media-soft)]',
	sensors: 'text-[var(--fb-domain-sensors)] bg-[var(--fb-domain-sensors-soft)]',
	energy: 'text-[var(--fb-domain-energy)] bg-[var(--fb-domain-energy-soft)]',
	cameras: 'text-[var(--fb-domain-cameras)] bg-[var(--fb-domain-cameras-soft)]',
};
</script>
