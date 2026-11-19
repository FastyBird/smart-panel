// FastyBird Smart Panel admin: UnoCSS theme and shortcuts.
// Spec: docs/admin-ui-design-spec.md (sections 2, 3 and 6). Used by ./uno.config.ts.
// Every colour points at an Element Plus or --fb-* variable, so utilities follow dark mode.

export const fbTheme = {
	colors: {
		primary: 'var(--el-color-primary)',
		success: 'var(--el-color-success)',
		warning: 'var(--el-color-warning)',
		danger: 'var(--el-color-danger)',
		info: 'var(--el-color-info)',
		brand: 'var(--fb-brand)',
		surface: 'var(--el-bg-color)',
		page: 'var(--el-bg-color-page)',
		overlay: 'var(--el-bg-color-overlay)',
		// Deprecated aliases, kept so existing classes keep working during the migration.
		// Replace them, then delete (see DEPRECATED_CLASSES below).
		'brand-primary': 'var(--fb-brand)', // bg-brand-primary, fill-brand-primary (sidebar logo block)
		'menu-background': 'var(--fb-sidebar-bg)', // bg-menu-background (sidebar and layout)
		domain: {
			lights: 'var(--fb-domain-lights)',
			climate: 'var(--fb-domain-climate)',
			covers: 'var(--fb-domain-covers)',
			media: 'var(--fb-domain-media)',
			sensors: 'var(--fb-domain-sensors)',
			energy: 'var(--fb-domain-energy)',
			cameras: 'var(--fb-domain-cameras)',
		},
	},
	boxShadow: {
		top: 'var(--fb-shadow-sticky)', // shadow-top: every sticky form footer (40 files)
		overlay: 'var(--fb-shadow-overlay)',
	},
	breakpoints: {
		xs: '0px', // still used by 4 files; keep
		sm: '576px',
		md: '768px',
		lg: '992px',
		xl: '1200px',
		xxl: '1400px',
		// Size classes: the only widths design rules may use. Phone has no prefix (0–719).
		// The Bootstrap keys above stay for existing code during the migration.
		tp: '720px', // tablet portrait 720–1023
		tl: '1024px', // tablet landscape 1024–1279 (also the Home Assistant panel)
		dt: '1280px', // desktop 1280–1599
		wd: '1600px', // wide 1600 and up
	},
};

// Opacity modifiers (bg-primary/10, text-danger/50) do NOT work: the colours are CSS variables, so
// UnoCSS renders them solid. They are forbidden by lint; use the *-soft shortcuts below instead.
//
// Status text: `text-primary`, `text-success`, `text-warning`, `text-danger` and `text-info` resolve to the
// readable text shades (--fb-primary-text, --fb-status-*-text), not to the filled-control base colours, which
// are below 4.5:1 as text on dark surfaces. `text-primary` stays blue. Main text colour is `text-default`.
export const fbShortcuts: Record<string, string> = {
	// Text colours
	'text-default': 'text-[var(--el-text-color-primary)]',
	'text-regular': 'text-[var(--el-text-color-regular)]',
	'text-secondary': 'text-[var(--el-text-color-secondary)]',
	'text-muted': 'text-[var(--fb-text-muted)]',
	'text-placeholder': 'text-[var(--el-text-color-placeholder)]',
	'text-link': 'text-[var(--fb-primary-text)]',
	'text-primary': 'text-[var(--fb-primary-text)]',
	'text-success': 'text-[var(--fb-status-ok-text)]',
	'text-warning': 'text-[var(--fb-status-warn-text)]',
	'text-danger': 'text-[var(--fb-status-danger-text)]',
	'text-info': 'text-[var(--fb-status-info-text)]',

	// Type scale
	'text-title': 'text-[20px] leading-[28px] font-600 text-default',
	'text-section': 'text-[16px] leading-[24px] font-600 text-default',
	'text-card-title': 'text-[14px] leading-[22px] font-600 text-default',
	'text-body': 'text-[14px] leading-[22px] text-regular',
	'text-label': 'text-[13px] leading-[20px] font-500 text-regular',
	'text-help': 'text-[13px] leading-[20px] text-secondary',
	'text-caption': 'text-[12px] leading-[16px] text-muted',
	'text-mono': 'font-mono text-[13px] leading-[20px]',
	'text-stat': 'text-[28px] leading-[34px] font-600 tabular-nums text-default',

	// Soft status backgrounds (instead of bg-primary/10 and friends)
	'bg-primary-soft': 'bg-[var(--fb-status-primary-soft)]',
	'border-primary-soft': 'border-[var(--fb-status-primary-border)]', // selected cards (Buddy setup, onboarding)
	'bg-success-soft': 'bg-[var(--fb-status-ok-soft)]',
	'bg-warning-soft': 'bg-[var(--fb-status-warn-soft)]',
	'bg-danger-soft': 'bg-[var(--fb-status-danger-soft)]',
	'bg-info-soft': 'bg-[var(--fb-status-info-soft)]',
	'text-success-strong': 'text-[var(--fb-status-ok-text)]',
	'text-warning-strong': 'text-[var(--fb-status-warn-text)]',
	'text-danger-strong': 'text-[var(--fb-status-danger-text)]',

	// Surfaces and borders
	'bg-fill': 'bg-[var(--el-fill-color)]',
	'bg-fill-light': 'bg-[var(--el-fill-color-light)]',
	'border-default': 'border-[var(--el-border-color)]',
	'border-light': 'border-[var(--el-border-color-light)]',

	// Layout
	'page-pad': 'px-3 py-3 tp:px-4 tp:py-4 dt:px-6 dt:py-6', // 12 px phone, 16 px from tp, 24 px from dt
	'card-grid': 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]',
	'tile-grid': 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]',
};

// Classes to migrate. The aliases above keep them working until every file is updated.
export const DEPRECATED_CLASSES: Record<string, string> = {
	'bg-brand-primary': 'bg-brand',
	'fill-brand-primary': 'fill-brand',
	'bg-menu-background': 'bg-[var(--fb-sidebar-bg)]',
	'text-gray-900': 'text-default',
	'text-gray-700': 'text-regular',
	'text-gray-500': 'text-secondary',
	'text-gray-400': 'text-muted',
	'bg-gray-50': 'bg-fill-light',
	'bg-gray-100': 'bg-fill',
	'border-gray-200': 'border-light',
	'border-gray-300': 'border-default',
	'bg-primary/10': 'bg-primary-soft',
	'bg-primary/5': 'bg-primary-soft', // 11 uses: Buddy setup wizard, onboarding Integrations step
	'border-primary/20': 'border-primary-soft',
};

// Lint (eslint/design-system.ts, configured in eslint.config.ts), error level once a folder is migrated:
//   - hex colours and gray-* utilities in .vue files
//   - opacity modifiers on theme colours: /\b(bg|text|border|fill)-(primary|success|warning|danger|info|brand)\/\d+/
//   - text-primary used for body text (it is the blue utility; main text is text-default)
//   - shadow="hover" / shadow="always" on el-card
//   - every key of DEPRECATED_CLASSES
