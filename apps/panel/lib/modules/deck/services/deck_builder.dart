import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_result.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';

/// Input parameters for deck building.
class DeckBuildInput {
  /// The display configuration.
  final DisplayModel display;

  /// Available dashboard pages (already filtered for this display).
  final List<DashboardPageView> pages;

  /// Localized title for room system view.
  final String roomViewTitle;

  /// Localized title for master system view.
  final String masterViewTitle;

  /// Localized title for entry system view.
  final String entryViewTitle;

  const DeckBuildInput({
    required this.display,
    required this.pages,
    this.roomViewTitle = 'Room Overview',
    this.masterViewTitle = 'Home Overview',
    this.entryViewTitle = 'Entry',
  });
}

/// Builds a navigation deck from display settings and dashboard pages.
///
/// This is a pure function with no side effects.
/// Given the same input, it always produces the same output.
///
/// The deck structure is:
/// - Index 0: System view (based on display role)
/// - Index 1+: Dashboard pages (sorted by order)
///
/// Start index determination:
/// - homeMode=auto → start on system view (index 0)
/// - homeMode=explicit → start on homePageId if found, else fallback to 0
DeckResult buildDeck(DeckBuildInput input) {
  final display = input.display;
  final pages = input.pages;

  // Build the deck items list
  final List<DeckItem> items = [];

  // 1. Add system view based on display role
  final systemViewType = display.role.toSystemViewType();
  final systemViewTitle = _getSystemViewTitle(systemViewType, input);
  final systemView = SystemViewItem(
    id: SystemViewItem.generateId(systemViewType, display.roomId),
    viewType: systemViewType,
    roomId: display.roomId,
    title: systemViewTitle,
  );
  items.add(systemView);

  // 2. Add dashboard pages sorted by order
  final sortedPages = List<DashboardPageView>.from(pages);
  sortedPages.sort((a, b) => a.order.compareTo(b.order));

  for (final page in sortedPages) {
    items.add(DashboardPageItem(
      id: page.id,
      pageView: page,
    ));
  }

  // 3. Determine start index based on homeMode
  int startIndex = 0;
  bool didFallback = false;
  String? warningMessage;

  if (display.homeMode == HomeMode.explicit) {
    final homePageId = display.homePageId ?? display.resolvedHomePageId;
    if (homePageId != null) {
      // Find the page index in the deck
      final pageIndex = items.indexWhere((item) => item.id == homePageId);
      if (pageIndex >= 0) {
        startIndex = pageIndex;
      } else {
        // Page not found, fallback to system view
        didFallback = true;
        warningMessage =
            'Home page "$homePageId" not found in deck. Falling back to system view.';
      }
    } else {
      // No homePageId specified in explicit mode, fallback to system view
      didFallback = true;
      warningMessage =
          'Explicit home mode but no home page specified. Falling back to system view.';
    }
  }
  // For homeMode=auto, startIndex stays at 0 (system view)

  return DeckResult(
    items: items,
    startIndex: startIndex,
    didFallback: didFallback,
    warningMessage: warningMessage,
  );
}

String _getSystemViewTitle(SystemViewType type, DeckBuildInput input) {
  switch (type) {
    case SystemViewType.room:
      return input.roomViewTitle;
    case SystemViewType.master:
      return input.masterViewTitle;
    case SystemViewType.entry:
      return input.entryViewTitle;
  }
}

/// Validates display configuration for deck building.
///
/// Returns a validation error message if the configuration is invalid,
/// or null if the configuration is valid.
String? validateDisplayConfig(DisplayModel display) {
  // Room role requires a non-empty roomId
  final roomId = display.roomId;
  if (display.role == DisplayRole.room &&
      (roomId == null || roomId.isEmpty)) {
    return 'Room display requires a space (room) to be assigned. '
        'Please configure this in Admin > Displays.';
  }

  return null;
}
