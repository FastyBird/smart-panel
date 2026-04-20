import type { SpaceType } from '../spaces.constants';
import type { ISpace } from '../store';

export interface ISpaceAddFormProps {
	/**
	 * Pre-selected space type. When set, the form hides its internal type
	 * dropdown and seeds `model.type` with this value — used by the
	 * dashboard-style plugin-picker flow where the parent view chooses the
	 * type before dispatching the plugin's `spaceAddForm` component.
	 *
	 * Narrowed to ROOM/ZONE because the generic add form validates against
	 * the Room/Zone add-form schema. Plugin-contributed types (signage,
	 * master, entry) register their own `spaceAddForm` component.
	 */
	type?: SpaceType.ROOM | SpaceType.ZONE;
	hideActions?: boolean;
}

export const spaceAddFormEmits = {
	saved: (space: ISpace): boolean => typeof space === 'object',
	cancel: (): boolean => true,
	'update:remote-form-changed': (formChanged: boolean): boolean => typeof formChanged === 'boolean',
};
