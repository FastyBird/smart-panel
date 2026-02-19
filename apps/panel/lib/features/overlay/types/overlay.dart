import 'package:flutter/widgets.dart';

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

	/// Builder function that creates the overlay widget.
	WidgetBuilder builder;

	AppOverlayEntry({
		required this.id,
		required this.displayType,
		required this.priority,
		required this.builder,
		this.isActive = false,
		this.closable = false,
	});
}
