import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/features/suggestions/types/suggestion.dart';
import 'package:fastybird_smart_panel/features/suggestions/services/suggestion_provider.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';

/// Wraps [SuggestionModel] as an [AppSuggestion].
class SpaceAppSuggestion implements AppSuggestion {
	final SuggestionModel model;
	final String spaceId;

	SpaceAppSuggestion({
		required this.model,
		required this.spaceId,
	});

	@override
	String get id => 'space_${spaceId}_${model.type.name}';

	@override
	String get title => model.title;

	@override
	String get reason => model.reason ?? '';

	@override
	IconData get icon => Icons.lightbulb_outline;

	@override
	bool get isWarning => false;

	@override
	bool get isExpired => false;

	@override
	String get actionLabel => 'Apply';
}

/// Suggestion provider for the spaces module.
///
/// Tapping applies the suggestion, dismissing sends dismissed feedback.
class SpaceSuggestionProvider implements SuggestionProvider {
	@override
	String get providerId => 'spaces';

	@override
	void onSuggestionTapped(AppSuggestion suggestion) {
		if (suggestion is! SpaceAppSuggestion) return;

		if (kDebugMode) {
			debugPrint(
				'[SPACES SUGGESTION] Accepted: ${suggestion.id} type=${suggestion.model.type.name}',
			);
		}

		_executeSuggestionIntent(suggestion);
	}

	Future<void> _executeSuggestionIntent(SpaceAppSuggestion suggestion) async {
		// Execute the intent using intentType/intentMode from the suggestion model
		try {
			final spacesService = locator<SpacesService>();
			LightingIntentResult? result;

			result = await spacesService.executeLightingIntentRaw(
				suggestion.spaceId,
				suggestion.model.intentType ?? 'off',
				mode: suggestion.model.intentMode,
			);

			if (kDebugMode) {
				debugPrint(
					'[SPACES SUGGESTION] Intent result: success=${result?.success}, '
					'affected=${result?.affectedDevices}, failed=${result?.failedDevices}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[SPACES SUGGESTION] Intent error: $e');
			}
		}

		// Send dismissed feedback to set the backend cooldown without
		// triggering a second server-side intent execution.
		try {
			locator<SpaceStateRepository>().submitSuggestionFeedback(
				suggestion.spaceId,
				suggestion.model.type,
				SuggestionFeedback.dismissed,
			);
		} catch (_) {
			// SpaceStateRepository not available
		}
	}

	@override
	void onSuggestionDismissed(AppSuggestion suggestion) {
		if (suggestion is! SpaceAppSuggestion) return;

		if (kDebugMode) {
			debugPrint(
				'[SPACES SUGGESTION] Dismissed: ${suggestion.id} type=${suggestion.model.type.name}',
			);
		}

		try {
			locator<SpaceStateRepository>().submitSuggestionFeedback(
				suggestion.spaceId,
				suggestion.model.type,
				SuggestionFeedback.dismissed,
			);
		} catch (_) {
			// SpaceStateRepository not available
		}
	}
}
