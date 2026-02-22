import 'package:flutter/widgets.dart';

import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// A function that resolves a localized string from [AppLocalizations].
typedef LocalizedString = String Function(AppLocalizations localizations);

/// Color scheme for config-driven overlays.
///
/// Mapped to theme colors by [OverlayRenderer]:
/// - [error]: red tones (auth error, connection lost, security alert)
/// - [warning]: amber tones (reconnecting, server unavailable)
/// - [info]: blue tones (informational overlays)
/// - [success]: green tones (recovery, positive feedback)
/// - [primary]: brand accent tones
enum OverlayColorScheme { error, warning, info, success, primary }

/// Visual style for overlay action buttons.
enum OverlayActionStyle { filled, outlined }

/// Describes a single action button rendered by [OverlayRenderer].
class OverlayAction {
	final LocalizedString label;
	final IconData? icon;
	final VoidCallback? onPressed;
	final OverlayActionStyle style;

	/// When true, the button shows a spinner and is disabled.
	final bool loading;

	const OverlayAction({
		required this.label,
		this.icon,
		this.onPressed,
		this.style = OverlayActionStyle.filled,
		this.loading = false,
	});
}

/// Display type for an overlay entry.
///
/// Determines how the overlay is rendered in the UI stack:
/// - [banner]: Non-blocking top bar (e.g., reconnecting indicator)
/// - [overlay]: Semi-blocking overlay with dimmed content visible underneath
/// - [fullScreen]: Full-screen blocking overlay requiring user action
enum OverlayDisplayType {
	/// Non-blocking top banner
	banner,

	/// Semi-blocking overlay with dimmed content
	overlay,

	/// Full-screen blocking overlay
	fullScreen,
}

/// A registered overlay in the [OverlayManager].
///
/// Named [AppOverlayEntry] to avoid conflict with Flutter's built-in
/// [OverlayEntry] class from the widgets library.
///
/// Each module/provider registers one entry per logical overlay. When
/// the overlay is shown, the provider updates [displayType] and other
/// properties to reflect the current state. For example, the connection
/// provider registers a single `'connection'` entry and escalates its
/// [displayType] from [banner] -> [overlay] -> [fullScreen] over time.
///
/// ## Config-driven rendering
///
/// Providers supply **configuration** (icon, title, message, actions) and
/// the [OverlayRenderer] handles all visual rendering through standard
/// layout templates for each [OverlayDisplayType].
///
/// For cases that need full control over rendering, set [customBuilder]
/// which bypasses the standard layout entirely.
class AppOverlayEntry {
	/// Unique identifier for this overlay registration.
	final String id;

	/// How this overlay is currently rendered.
	OverlayDisplayType displayType;

	/// Priority for z-ordering. Higher values render on top.
	///
	/// Recommended ranges:
	/// - 0-99: Low priority (informational)
	/// - 100-199: Module overlays (security, etc.)
	/// - 200-299: Core overlays (connection, etc.)
	/// - 300+: Critical system overlays
	final int priority;

	/// Whether this overlay is currently active/visible.
	bool isActive;

	/// Whether the user can dismiss this overlay.
	bool closable;

	// -- Config fields (standard layout) --

	/// Standard icon shown in a circular container.
	IconData? icon;

	/// Theme-mapped color for icon background and banner color.
	OverlayColorScheme colorScheme;

	/// Whether to show a progress spinner (ring around icon or inline spinner).
	bool showProgress;

	/// Title text, resolved with [AppLocalizations] from [BuildContext].
	LocalizedString? title;

	/// Body text, resolved with [AppLocalizations] from [BuildContext].
	LocalizedString? message;

	/// Custom widget replacing the message area (e.g. alert list).
	Widget? content;

	/// Action buttons rendered below the message/content area.
	List<OverlayAction> actions;

	// -- Escape hatch --

	/// When set, the standard layout is bypassed and this builder is
	/// rendered directly. Used for lock screen, screen saver, recovery toast.
	WidgetBuilder? customBuilder;

	AppOverlayEntry({
		required this.id,
		required this.displayType,
		required this.priority,
		this.isActive = false,
		this.closable = false,
		this.icon,
		this.colorScheme = OverlayColorScheme.primary,
		this.showProgress = false,
		this.title,
		this.message,
		this.content,
		this.actions = const [],
		this.customBuilder,
	});
}
