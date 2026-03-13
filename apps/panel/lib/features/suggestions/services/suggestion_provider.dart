import 'package:fastybird_smart_panel/features/suggestions/types/suggestion.dart';

/// Interface for modules that produce suggestions.
///
/// Each module registers a [SuggestionProvider] with the global
/// [SuggestionNotificationService]. When the user taps or dismisses
/// a toast, the service looks up the originating provider and delegates
/// the callback.
abstract class SuggestionProvider {
	/// Unique identifier for this provider (e.g. 'buddy', 'spaces').
	String get providerId;

	/// Called when the user taps the suggestion toast.
	void onSuggestionTapped(AppSuggestion suggestion);

	/// Called when the suggestion is dismissed (swipe or auto-expire).
	void onSuggestionDismissed(AppSuggestion suggestion);
}
