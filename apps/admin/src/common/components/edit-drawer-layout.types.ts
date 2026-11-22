export type EditDrawerLayoutProps = {
	/** The form is showing */
	open: boolean;
	/** Called on Escape or a click on the scrim, with `done` to let the drawer close (an unsaved-changes guard) */
	beforeClose?: (done: () => void) => void;
	/** A panel without a route of its own (list adjustment): on phone it opens in a full-width drawer, as there is no page to show it on */
	routeless?: boolean;
};
