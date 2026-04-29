/*
 * Plugin components barrel.
 *
 * `SpaceAddForm`, `SpaceDetail`, and `SpaceEditForm` remain in the spaces
 * core module (they're the generic CRUD shells the plugin dispatches into),
 * so they're re-exported from here to keep the plugin manifest's imports
 * focused on a single path.
 *
 * Home-control-specific components (lighting/climate/covers/sensor role
 * panels, media activities, domain section cards, device/display/scene
 * add dialogs, scenes section, parent-zone picker) are exported directly
 * from their co-located files.
 */
export { SpaceAddForm, SpaceDetail, SpaceEditForm } from '../../../modules/spaces/components/components';

// Role panels
export { default as SpaceLightingRoles } from './space-lighting-roles.vue';
export { default as SpaceLightingRolesSummary } from './space-lighting-roles-summary.vue';
export { default as SpaceLightingRolesDialog } from './space-lighting-roles-dialog.vue';
export { default as SpaceClimateRoles } from './space-climate-roles.vue';
export { default as SpaceClimateRolesSummary } from './space-climate-roles-summary.vue';
export { default as SpaceClimateRolesDialog } from './space-climate-roles-dialog.vue';
export { default as SpaceCoversRoles } from './space-covers-roles.vue';
export { default as SpaceCoversRolesSummary } from './space-covers-roles-summary.vue';
export { default as SpaceCoversRolesDialog } from './space-covers-roles-dialog.vue';
export { default as SpaceSensorRoles } from './space-sensor-roles.vue';
export { default as SpaceSensorRolesSummary } from './space-sensor-roles-summary.vue';
export { default as SpaceSensorRolesDialog } from './space-sensor-roles-dialog.vue';

// Domain cards
export { default as SpaceDomainCard } from './space-domain-card.vue';
export { default as SpaceDomainsSection } from './space-domains-section.vue';

// Scenes + parent zone
export { default as SpaceDevicesSection } from './space-devices-section.vue';
export { default as SpaceDisplaysSection } from './space-displays-section.vue';
export { default as SpaceScenesSection } from './space-scenes-section.vue';
export { default as SpaceParentZoneSection } from './space-parent-zone-section.vue';

// Add dialogs
export { default as SpaceAddDeviceDialog } from './space-add-device-dialog.vue';
export { default as SpaceAddDisplayDialog } from './space-add-display-dialog.vue';
export { default as SpaceAddSceneDialog } from './space-add-scene-dialog.vue';

// Media sections
export { default as SpaceMediaActivitiesSummary } from './space-media-activities-summary.vue';
export { default as SpaceMediaActivitiesDialog } from './space-media-activities-dialog.vue';

// Setup wizard
export { default as SpacesWizard } from '../views/view-spaces-onboarding.vue';
