import 'package:flutter/widgets.dart';

/// Abstract suggestion that any module can implement.
///
/// The global [SuggestionNotificationService] works exclusively with
/// this interface so it stays module-agnostic.
abstract class AppSuggestion {
	/// Unique identifier for this suggestion.
	String get id;

	/// Short human-readable title.
	String get title;

	/// Longer explanation of why this suggestion was made.
	String get reason;

	/// Icon displayed in the toast notification.
	IconData get icon;

	/// Whether this suggestion represents a conflict or anomaly
	/// that should be displayed with warning styling.
	bool get isWarning;

	/// Whether this suggestion has expired and should be skipped.
	bool get isExpired;

	/// Label for the positive action button (e.g. "Got it", "Apply").
	String get actionLabel;
}
