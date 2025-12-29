import { computed, type Ref, unref, type MaybeRef } from 'vue';

import {
	type CategoryGroup,
	getCategoriesForType,
	getGroupedCategoriesForType,
	getTemplatesForType,
	type SpaceCategoryTemplate,
	SpaceType,
} from '../spaces.constants';

interface UseSpaceCategoriesReturn {
	/**
	 * Get flat list of category options for a given type
	 */
	getCategoryOptions: (type: SpaceType) => string[];

	/**
	 * Get grouped categories for a given type (null for rooms)
	 */
	getCategoryGroups: (type: SpaceType) => CategoryGroup[] | null;

	/**
	 * Get category templates (icon, description) for a given type
	 */
	getCategoryTemplates: (type: SpaceType) => Record<string, Omit<SpaceCategoryTemplate, 'category'>>;

	/**
	 * Computed flat list of categories for the current type
	 * Only available when spaceType ref is provided
	 */
	categoryOptions: Ref<string[]>;

	/**
	 * Computed grouped categories for the current type (null for rooms)
	 * Only available when spaceType ref is provided
	 */
	categoryGroups: Ref<CategoryGroup[] | null>;

	/**
	 * Computed templates for the current type
	 * Only available when spaceType ref is provided
	 */
	currentTemplates: Ref<Record<string, Omit<SpaceCategoryTemplate, 'category'>>>;
}

/**
 * Composable for space category options management
 *
 * Provides both static functions (for use with dynamic types like in wizard)
 * and reactive computed properties (for use with forms where type is reactive)
 *
 * @param spaceType - Optional reactive space type for computed properties
 */
export function useSpaceCategories(spaceType?: MaybeRef<SpaceType>): UseSpaceCategoriesReturn {
	// Static functions that work with any type parameter
	const getCategoryOptions = (type: SpaceType): string[] => {
		const categories = getCategoriesForType(type);
		// Sort room categories alphabetically (zones use grouped display)
		if (type === SpaceType.ROOM) {
			return [...categories].sort((a, b) => a.localeCompare(b));
		}
		return categories;
	};

	const getCategoryGroups = (type: SpaceType): CategoryGroup[] | null => {
		const groups = getGroupedCategoriesForType(type);
		return groups && groups.length > 0 ? groups : null;
	};

	const getCategoryTemplates = (type: SpaceType): Record<string, Omit<SpaceCategoryTemplate, 'category'>> => {
		return getTemplatesForType(type);
	};

	// Reactive computed properties based on spaceType ref
	const categoryOptions = computed<string[]>(() => {
		const type = unref(spaceType) ?? SpaceType.ROOM;
		return getCategoryOptions(type); // Use the sorted version
	});

	const categoryGroups = computed<CategoryGroup[] | null>(() => {
		const type = unref(spaceType) ?? SpaceType.ROOM;
		return getCategoryGroups(type);
	});

	const currentTemplates = computed<Record<string, Omit<SpaceCategoryTemplate, 'category'>>>(() => {
		const type = unref(spaceType) ?? SpaceType.ROOM;
		return getTemplatesForType(type);
	});

	return {
		// Static functions
		getCategoryOptions,
		getCategoryGroups,
		getCategoryTemplates,
		// Reactive computed
		categoryOptions,
		categoryGroups,
		currentTemplates,
	};
}
