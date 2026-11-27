import type { RouteLocationRaw } from 'vue-router';

export type StandaloneLayoutProps = {
	title: string;
	subtitle?: string;
	/** Where the brand mark leads, and what the link is called; without them the mark is not a link */
	logoTo?: RouteLocationRaw;
	logoLabel?: string;
	/** false hides the project links and the copyright below the card */
	links?: boolean;
};
