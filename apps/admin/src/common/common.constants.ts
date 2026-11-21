export const SUBMIT_FORM_SM = 'fb-form-sm-submit';
export const SUBMIT_FORM_MD = 'fb-form-md-submit';

/**
 * The five size classes of the design (docs/admin-ui-design-spec.md, section 6): phone below 720 px, then tablet
 * portrait, tablet landscape, desktop and wide. They match the `tp:`, `tl:`, `dt:` and `wd:` UnoCSS prefixes.
 */
export const SIZE_CLASS_BREAKPOINTS = {
	tp: 720,
	tl: 1024,
	dt: 1280,
	wd: 1600,
} as const;
