import type { SpaceType } from '../spaces.constants';
import type { ISpace } from '../store';

export interface ISpaceAddFormProps {
	/**
	 * Pre-selected space type. When set, the form hides its internal type
	 * dropdown and seeds `model.type` with this value — used by the
	 * dashboard-style plugin-picker flow where the parent view chooses the
	 * type before dispatching the plugin's `spaceAddForm` component.
	 *
	 * Narrowed to ROOM / ZONE because the internal `SpaceAddFormSchema`
	 * (see `composables/schemas.ts`) only validates those two values, and
	 * the form's `submit()` calls `schema.safeParse(model)` — passing any
	 * other `SpaceType` here would make validation throw. The home-control
	 * plugin only registers this form against ROOM / ZONE elements, and the
	 * view's dynamic-dispatch `<component :is>` boundary is where the cast
	 * from the picker's wider `SpaceType` narrows (see `view-space-add.vue`).
	 * Plugin-contributed types (signage, etc.) contribute their own add-form
	 * components with their own prop shape.
	 */
	type?: SpaceType.ROOM | SpaceType.ZONE;
	hideActions?: boolean;
}

export const spaceAddFormEmits = {
	saved: (space: ISpace): boolean => typeof space === 'object',
	cancel: (): boolean => true,
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};
