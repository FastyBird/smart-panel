export type SettingsLayoutSection = {
	/** The `id` of the section card it scrolls to */
	id: string;
	label: string;
	icon?: string;
	/** Shown after the label, for example the number of advisories */
	count?: number;
};

export type SettingsLayoutProps = {
	sections: SettingsLayoutSection[];
};

export type SettingsSectionProps = {
	/** Anchor target of the settings layout's nav */
	id: string;
	title: string;
	description?: string;
	icon?: string;
};
