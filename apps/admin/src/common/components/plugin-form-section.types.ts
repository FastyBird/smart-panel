export type PluginFormSectionProps = {
	title: string;
	description?: string;
	/** Advanced options: the section starts collapsed and opens from its heading. Its fields stay mounted, so the form
	 * still validates them */
	advanced?: boolean;
	/** Open state of an advanced section (`v-model:expanded`); without it the section keeps its own */
	expanded?: boolean;
};
