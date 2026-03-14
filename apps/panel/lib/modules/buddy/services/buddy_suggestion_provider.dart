import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/features/suggestions/types/suggestion.dart';
import 'package:fastybird_smart_panel/features/suggestions/services/suggestion_provider.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';

/// Wraps [BuddySuggestionModel] as an [AppSuggestion].
class BuddyAppSuggestion implements AppSuggestion {
	final BuddySuggestionModel model;

	BuddyAppSuggestion(this.model);

	@override
	String get id => model.id;

	@override
	String get title => model.title;

	@override
	String get reason => model.reason;

	@override
	IconData get icon => model.type.icon;

	@override
	bool get isWarning => model.type.isWarning;

	@override
	bool get isExpired => model.isExpired;

	@override
	String get actionLabel => 'Got it';
}

/// Suggestion provider for the buddy module.
///
/// Tapping a buddy suggestion sends `applied` feedback via [BuddyService].
/// Dismissing sends `dismissed` feedback via [BuddyService].
class BuddySuggestionProvider implements SuggestionProvider {
	@override
	String get providerId => 'buddy';

	@override
	void onSuggestionTapped(AppSuggestion suggestion) {
		if (kDebugMode) {
			debugPrint('[BUDDY SUGGESTION] Accepted: ${suggestion.id}');
		}

		try {
			final service = locator<BuddyService>();
			service.acceptSuggestion(suggestion.id);
			service.removeSuggestion(suggestion.id);
		} catch (_) {
			// BuddyService not available
		}
	}

	@override
	void onSuggestionDismissed(AppSuggestion suggestion) {
		if (kDebugMode) {
			debugPrint('[BUDDY SUGGESTION] Dismissed: ${suggestion.id}');
		}

		try {
			final service = locator<BuddyService>();
			service.dismissSuggestion(suggestion.id);
			service.removeSuggestion(suggestion.id);
		} catch (_) {
			// BuddyService not available
		}
	}
}
