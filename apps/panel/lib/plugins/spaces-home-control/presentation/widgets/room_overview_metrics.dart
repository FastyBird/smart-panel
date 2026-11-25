import 'package:fastybird_smart_panel/core/services/screen.dart';

/// The room overview's sizes per class (docs/display-ui-design-spec.md §4,
/// design canvas "2 · Room overview"). Design px; scale them with
/// `AppSpacings.scale`.
class RoomOverviewMetrics {
  RoomOverviewMetrics._();

  static double _byClass(
    ScreenSizeClass sizeClass,
    double compact,
    double regular,
    double expanded,
  ) => switch (sizeClass) {
    ScreenSizeClass.compact => compact,
    ScreenSizeClass.regular => regular,
    ScreenSizeClass.expanded => expanded,
  };

  /// Page padding and the gaps between blocks: 6 / 8 / 12.
  static double padFor(ScreenSizeClass c) => _byClass(c, 6, 8, 12);

  /// The sky's share of the page: in landscape of the width (after the
  /// page padding), in portrait of the height.
  static const double skyLandscapeShare = 0.38;
  static const double skySquareShare = 0.38;
  static const double skyShortPortraitShare = 0.3;
  static const double skyPortraitShare = 0.34;

  /// A portrait page shorter than this (a 380 high screen less its 44 bar)
  /// takes the short share.
  static const double shortPortraitPage = 336;

  // ── Scene pills ──────────────────────────────────────────────────────

  /// 36 high (the touch floor), 40 on Expanded.
  static double pillHeightFor(ScreenSizeClass c) => _byClass(c, 36, 36, 40);
  static double pillFontFor(ScreenSizeClass c) => _byClass(c, 12, 12, 14);
  static const double pillPadding = 12;

  /// Compact's pills share the row with the room mode button.
  static const double pillPaddingCompact = 10;
  static const double pillIcon = 14;
  static const double pillGap = 6;

  // ── Room mode ────────────────────────────────────────────────────────

  /// The "Room mode" label row.
  static const double modeLabelHeight = 14;
  static const double modeLabelFont = 10;
  static const double modeLabelGap = 8;
  static const double modeGap = 6;

  /// The chips and the details button: 40, 44 on Expanded.
  static double chipHeightFor(ScreenSizeClass c) => _byClass(c, 40, 40, 44);
  static double chipFontFor(ScreenSizeClass c) => _byClass(c, 12, 12, 14);
  static const double chipPadding = 10;
  static const double chipIcon = 16;
  static const double chipGap = 6;

  /// The schedule and occupancy line.
  static const double scheduleHeight = 16;
  static double scheduleFontFor(ScreenSizeClass c) => _byClass(c, 10, 10, 12);
  static const double scheduleIcon = 12;
  static const double scheduleGap = 12;
  static const double scheduleIconGap = 4;

  /// Compact's room mode button: 36 high in the accent.
  static const double modeButtonHeight = 36;
  static const double modeButtonPadding = 8;
  static const double modeButtonFont = 12;
  static const double modeButtonIcon = 14;
  static const double modeButtonMark = 12;
  static const double modeButtonGap = 5;

  // ── Domain cards ─────────────────────────────────────────────────────

  static double cardPaddingFor(ScreenSizeClass c) => _byClass(c, 6, 8, 12);

  /// The domain icon's tile: 24 / 28 / 36, its icon 14 / 16 / 20.
  static double chipFor(ScreenSizeClass c) => _byClass(c, 24, 28, 36);
  static double chipIconFor(ScreenSizeClass c) => _byClass(c, 14, 16, 20);
  static const double chipRadius = 6;

  /// The value: 18 / 22 / 28; its unit at 60 %.
  static double valueFor(ScreenSizeClass c) => _byClass(c, 18, 22, 28);
  static const double unitShare = 0.6;

  /// The title and the state line (Regular and up).
  static double titleFor(ScreenSizeClass c) => _byClass(c, 12, 12, 14);
  static double stateFor(ScreenSizeClass c) => _byClass(c, 10, 10, 12);

  /// The head's gap: 6 on Compact and in a small card, 8 otherwise.
  static double headGapFor(ScreenSizeClass c) => _byClass(c, 6, 8, 8);
  static const double cardGap = 4;

  /// Quick actions: 36 high (40 on Expanded), 4 apart, at least 36 wide.
  static double actionHeightFor(ScreenSizeClass c) => _byClass(c, 36, 36, 40);
  static const double actionGap = 4;
  static const double actionMinWidth = 36;
  static const double actionRadius = 6;
  static const double actionFont = 12;
  static const double actionIcon = 16;

  /// A lone card's height (one domain): 80 / 92 / 116.
  static double singleCardHeightFor(ScreenSizeClass c) =>
      _byClass(c, 80, 92, 116);

  /// The shortest a card with quick actions gets before the cards scroll.
  static double cardMinHeightFor(ScreenSizeClass c) =>
      cardPaddingFor(c) * 2 + chipFor(c) + cardGap + actionHeightFor(c);

  /// Quick actions on a card [cardWidth] wide (spec §4): three when each is
  /// at least 36 wide, else two.
  static int actionsFor(double cardWidth, ScreenSizeClass c) {
    final inner = cardWidth - 2 * cardPaddingFor(c);

    return (inner - 2 * actionGap) / 3 >= actionMinWidth ? 3 : 2;
  }

  /// Small cards: on the square with more than two domains every card is
  /// icon and value only, four to a row, with no quick actions.
  static bool smallCards({required bool square, required int cards}) =>
      square && cards > 2;

  /// Columns: four small cards, one lone card, two otherwise.
  static int columnsFor({required bool square, required int cards}) {
    if (smallCards(square: square, cards: cards)) return 4;

    return cards == 1 ? 1 : 2;
  }

  /// The most of the content the room mode and the automations take before
  /// they scroll.
  static const double modeMaxShare = 0.5;
  static const double automationsMaxShare = 0.35;

  // ── Automations (Expanded) ───────────────────────────────────────────

  static const double automationRow = 44;
  static const double automationName = 14;
  static const double automationStatus = 12;
  static const double automationPadding = 12;

  // ── Status strip (Regular and up) ────────────────────────────────────

  static double statusHeightFor(ScreenSizeClass c) => _byClass(c, 36, 36, 40);
  static double statusFontFor(ScreenSizeClass c) => _byClass(c, 12, 12, 14);
  static const double statusPadding = 10;
  static const double statusIcon = 14;
  static const double statusChevron = 12;
  static const double statusGap = 5;
}
