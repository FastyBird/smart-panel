/*
 * Plugin components barrel.
 *
 * During the Phase 3b migration the components still physically live under
 * `modules/spaces/components/`. The plugin re-exports them from here so that
 * consumers (and later the plugin manifest) import them via the plugin path.
 * A follow-up commit relocates the `.vue` files into this directory; this
 * indirection lets the relocation happen without touching callers.
 */
export { SpaceAddForm, SpaceDetail, SpaceEditForm } from '../../../modules/spaces/components/components';
