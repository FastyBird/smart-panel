import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_domain_classifier.dart';

/// Result of building a navigation deck.
///
/// Contains the ordered list of deck items and the index of the item
/// that should be shown first based on display settings.
class DeckResult {
  /// The ordered list of deck items (system views + domain views + dashboard pages).
  final List<DeckItem> items;

  /// The index of the item to show first.
  ///
  /// For homeMode=auto, this points to the first system view.
  /// For homeMode=explicit with valid homePageId, this points to that page.
  /// Falls back to system view (index 0) if explicit page is not found.
  final int startIndex;

  /// Whether a fallback was used for the start index.
  ///
  /// True if homeMode=explicit but the specified homePageId was not found
  /// in the deck, resulting in a fallback to the system view.
  final bool didFallback;

  /// Warning message if configuration had issues.
  final String? warningMessage;

  /// Map from view key to deck index.
  ///
  /// Keys include:
  /// - 'room-overview:{roomId}' for room overview
  /// - 'domain:{roomId}:{domainType}' for domain views
  /// - 'master-overview' for master overview
  /// - 'entry-overview' for entry overview
  /// - 'page:{pageId}' for dashboard pages
  final Map<String, int> indexByViewKey;

  /// Domain counts for ROOM role displays (null for other roles).
  final DomainCounts? domainCounts;

  const DeckResult({
    required this.items,
    required this.startIndex,
    this.didFallback = false,
    this.warningMessage,
    this.indexByViewKey = const {},
    this.domainCounts,
  });

  /// Returns true if the deck is empty (no items to display).
  bool get isEmpty => items.isEmpty;

  /// Returns true if the deck has at least one item.
  bool get isNotEmpty => items.isNotEmpty;

  /// Returns the deck item at the start index, or null if empty.
  DeckItem? get startItem =>
      items.isNotEmpty && startIndex < items.length ? items[startIndex] : null;

  /// Returns the first system view item if present.
  SystemViewItem? get systemView {
    for (final item in items) {
      if (item is SystemViewItem) return item;
    }
    return null;
  }

  /// Returns all system view items (room overview).
  List<SystemViewItem> get systemViews =>
      items.whereType<SystemViewItem>().toList();

  /// Returns all domain view items.
  List<DomainViewItem> get domainViews =>
      items.whereType<DomainViewItem>().toList();

  /// Returns the energy view item if present.
  EnergyViewItem? get energyView {
    for (final item in items) {
      if (item is EnergyViewItem) return item;
    }
    return null;
  }

  /// Returns all dashboard page items.
  List<DashboardPageItem> get dashboardPages =>
      items.whereType<DashboardPageItem>().toList();

  /// Gets the deck index for a view key.
  ///
  /// Returns -1 if the view key is not found.
  int getIndexByViewKey(String viewKey) {
    return indexByViewKey[viewKey] ?? -1;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! DeckResult) return false;
    if (items.length != other.items.length) return false;
    for (var i = 0; i < items.length; i++) {
      if (items[i] != other.items[i]) return false;
    }
    return startIndex == other.startIndex && didFallback == other.didFallback;
  }

  @override
  int get hashCode => Object.hash(
        Object.hashAll(items),
        startIndex,
        didFallback,
      );
}
