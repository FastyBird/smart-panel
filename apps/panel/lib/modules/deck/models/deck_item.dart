import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_item_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';

/// Base class for items in the navigation deck.
///
/// The deck is the ordered list of views the user can swipe through.
/// It consists of exactly one system view followed by dashboard pages.
sealed class DeckItem {
  /// Unique identifier for this deck item.
  final String id;

  /// The type of this deck item.
  DeckItemType get type;

  const DeckItem({required this.id});

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DeckItem && other.id == id && other.type == type;
  }

  @override
  int get hashCode => Object.hash(id, type);
}

/// A system-generated overview view based on display role.
///
/// System views are automatically determined based on the display's role:
/// - Room displays show a room-centric overview
/// - Master displays show a whole-house overview
/// - Entry displays show house modes and security status
class SystemViewItem extends DeckItem {
  /// The type of system view to render.
  final SystemViewType viewType;

  /// The space ID for room views (required for room type, null for others).
  final String? spaceId;

  /// Human-readable title for this view.
  final String title;

  const SystemViewItem({
    required super.id,
    required this.viewType,
    this.spaceId,
    required this.title,
  });

  @override
  DeckItemType get type => DeckItemType.systemView;

  /// Factory to create a system view ID based on type and optional space.
  static String generateId(SystemViewType type, [String? spaceId]) {
    final base = 'system-view-${type.name}';
    if (spaceId != null) {
      return '$base-$spaceId';
    }
    return base;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SystemViewItem &&
        other.id == id &&
        other.viewType == viewType &&
        other.spaceId == spaceId;
  }

  @override
  int get hashCode => Object.hash(id, viewType, spaceId);
}

/// A user-configured dashboard page.
///
/// Dashboard pages are created and managed through the Admin interface.
/// They include tiles pages, cards pages, device detail pages, etc.
class DashboardPageItem extends DeckItem {
  /// The underlying page view model.
  final DashboardPageView pageView;

  const DashboardPageItem({
    required super.id,
    required this.pageView,
  });

  @override
  DeckItemType get type => DeckItemType.dashboardPage;

  /// The page title.
  String get title => pageView.title;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DashboardPageItem && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
