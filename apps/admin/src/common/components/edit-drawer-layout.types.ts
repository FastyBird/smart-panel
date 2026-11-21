export type EditDrawerLayoutProps = {
	/** The form is showing */
	open: boolean;
	/** Called on Escape or a click on the scrim, with `done` to let the drawer close (an unsaved-changes guard) */
	beforeClose?: (done: () => void) => void;
};
