import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/offline_note.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// DR-6: cards, the hero card, tiles and the offline treatment.
const List<GalleryEntry> cardEntries = [
  GalleryEntry(title: 'Card, plain and with a header', builder: _cards),
  GalleryEntry(
    title: 'Hero: badge, numeral, feedback, slider, buttons',
    builder: _hero,
  ),
  GalleryEntry(title: 'Hero: pending (dimmed numeral)', builder: _heroPending),
  GalleryEntry(
    title: 'Hero: little height left (value beside the badge)',
    builder: _heroInline,
  ),
  GalleryEntry(title: 'Hero: offline', builder: _heroOffline),
  GalleryEntry(
    title: 'Hero in landscape (badge dropped on Compact)',
    builder: _heroLandscape,
  ),
  GalleryEntry(
    title: 'Horizontal tiles: default, active, selected, sensor, offline',
    builder: _horizontalTiles,
  ),
  GalleryEntry(
    title: 'Vertical tiles: default, active, selected, sensor, offline',
    builder: _verticalTiles,
  ),
  GalleryEntry(
    title:
        'Dashboard tiles: 1 × 1, 2 × 1 and 2 × 2; off, on, offline, disabled',
    builder: _dashboardTiles,
  ),
  GalleryEntry(title: 'Offline note', builder: _offlineNote),
  GalleryEntry(title: 'Offline device detail', builder: _offlineDetail),
];

void _noop() {}

ScreenSizeClass _class(BuildContext context) =>
    GalleryScope.of(context).sizeClass;

Widget _cards(BuildContext context) {
  final sizeClass = _class(context);
  final text = TextStyle(
    fontSize: AppFontSize.small,
    color: Theme.of(context).neutrals.textPrimary,
  );

  return Wrap(
    spacing: AppSpacings.pMd,
    runSpacing: AppSpacings.pMd,
    children: [
      SizedBox(
        width: AppSpacings.scale(200),
        child: BaseCard(
          sizeClass: sizeClass,
          child: Text('Card content', style: text),
        ),
      ),
      SizedBox(
        width: AppSpacings.scale(200),
        child: BaseCard(
          sizeClass: sizeClass,
          headerIcon: MdiIcons.thermometer,
          headerTitle: 'Room readings',
          child: Text('21.4° · 46 %', style: text),
        ),
      ),
    ],
  );
}

/// A stand-in for the slider until DR-7 re-skins it.
class _Track extends StatelessWidget {
  const _Track({required this.fraction, required this.color});

  final double fraction;
  final ThemeColors color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final family = ThemeColorFamily.get(theme.brightness, color);

    return Center(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppSpacings.scale(7)),
        child: SizedBox(
          height: AppSpacings.scale(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: (fraction * 100).round(),
                child: ColoredBox(color: family.base),
              ),
              Expanded(
                flex: 100 - (fraction * 100).round(),
                child: ColoredBox(color: theme.neutrals.fillBase),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A stand-in for the hero's preset buttons until DR-7 re-skins them.
class _Presets extends StatelessWidget {
  const _Presets({required this.labels, required this.selected});

  final List<String> labels;
  final int selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lights = ThemeColorFamily.get(theme.brightness, ThemeColors.lights);
    final neutrals = theme.neutrals;

    return Row(
      spacing: AppSpacings.pSm,
      children: [
        for (var i = 0; i < labels.length; i++)
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: i == selected ? lights.soft : neutrals.fillLight,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: Border.all(
                  color: i == selected ? lights.base : neutrals.borderLight,
                  width: AppSpacings.scale(1),
                ),
              ),
              child: Center(
                child: Text(
                  labels[i],
                  style: TextStyle(
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w500,
                    color: i == selected ? lights.base : neutrals.textPrimary,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

Widget _lightsHero(
  BuildContext context, {
  double height = 320,
  bool dimmed = false,
  bool offline = false,
  String feedback = 'Brightness · Main',
  IconData? feedbackIcon,
  Orientation? orientation,
}) {
  final sizeClass = _class(context);

  return SizedBox(
    height: AppSpacings.scale(height),
    child: HeroCard.slots(
      sizeClass: sizeClass,
      orientation: orientation ?? GalleryScope.of(context).orientation,
      value: '50',
      unit: ' %',
      dimmed: dimmed,
      offline: offline,
      lastSeenText: '21:10',
      badge: HeroBadge(
        icon: MdiIcons.lightbulbOutline,
        label: 'Main',
        color: ThemeColors.lights,
        onTap: _noop,
        sizeClass: sizeClass,
      ),
      feedback: HeroFeedback(
        text: feedback,
        icon: feedbackIcon,
        sizeClass: sizeClass,
      ),
      slider: const _Track(fraction: 0.5, color: ThemeColors.lights),
      buttons: const _Presets(
        labels: ['25%', '50%', '75%', '100%'],
        selected: 1,
      ),
    ),
  );
}

Widget _hero(BuildContext context) => _lightsHero(context);

Widget _heroPending(BuildContext context) => _lightsHero(
  context,
  dimmed: true,
  feedback: 'Setting',
  feedbackIcon: MdiIcons.refresh,
);

/// Just under 50 design px left for the numeral at the gallery's class.
Widget _heroInline(BuildContext context) {
  final m = HeroCardMetrics.of(_class(context));
  final fixed = m.badgeHeight + m.sliderHeight + m.buttonsHeight + 3 * m.gap;

  return _lightsHero(
    context,
    height: 2 * (m.padding + 1) + fixed + 30,
    orientation: Orientation.portrait,
  );
}

Widget _heroOffline(BuildContext context) =>
    _lightsHero(context, offline: true);

Widget _heroLandscape(BuildContext context) =>
    _lightsHero(context, height: 220, orientation: Orientation.landscape);

List<
  ({
    String name,
    String? status,
    bool active,
    bool selected,
    bool offline,
    ThemeColors? accent,
  })
>
_tileStates() => [
  (
    name: 'Task',
    status: 'Off',
    active: false,
    selected: false,
    offline: false,
    accent: null,
  ),
  (
    name: 'Main',
    status: '50 %',
    active: true,
    selected: false,
    offline: false,
    accent: null,
  ),
  (
    name: 'Ambient',
    status: '30 %',
    active: true,
    selected: true,
    offline: false,
    accent: null,
  ),
  (
    name: 'Temperature',
    status: '21.4°',
    active: false,
    selected: false,
    offline: false,
    accent: ThemeColors.sensors,
  ),
  (
    name: 'Desk lamp',
    status: 'Offline · last seen 21:10',
    active: false,
    selected: false,
    offline: true,
    accent: null,
  ),
];

Widget _horizontalTiles(BuildContext context) {
  final sizeClass = _class(context);

  return Wrap(
    spacing: AppSpacings.pMd,
    runSpacing: AppSpacings.pMd,
    children: [
      for (final s in _tileStates())
        SizedBox(
          width: AppSpacings.scale(190),
          height: AppSpacings.scale(AppTileHeight.horizontal),
          child: UniversalTile(
            layout: TileLayout.horizontal,
            sizeClass: sizeClass,
            icon: s.accent == null
                ? MdiIcons.lightbulbOutline
                : MdiIcons.thermometer,
            name: s.name,
            status: s.status,
            isActive: s.active,
            isSelected: s.selected,
            isOffline: s.offline,
            activeColor: ThemeColors.lights,
            iconAccentColor: s.accent,
            showSelectionIndicator: s.selected,
            onIconTap: _noop,
            onTileTap: _noop,
          ),
        ),
    ],
  );
}

Widget _verticalTiles(BuildContext context) {
  final sizeClass = _class(context);

  return Wrap(
    spacing: AppSpacings.pMd,
    runSpacing: AppSpacings.pMd,
    children: [
      for (final s in _tileStates())
        SizedBox.square(
          dimension: AppSpacings.scale(96),
          child: UniversalTile(
            layout: TileLayout.vertical,
            sizeClass: sizeClass,
            icon: s.accent == null
                ? MdiIcons.lightbulbOutline
                : MdiIcons.thermometer,
            name: s.name,
            status: s.offline ? 'Offline' : s.status,
            isActive: s.active,
            isSelected: s.selected,
            isOffline: s.offline,
            activeColor: ThemeColors.lights,
            iconAccentColor: s.accent,
            showSelectionIndicator: s.selected,
            onTileTap: _noop,
          ),
        ),
    ],
  );
}

Widget _dashboardTiles(BuildContext context) {
  final cell = AppSpacings.scale(88);
  final gap = AppSpacings.pMd;

  Widget tile({
    required int cols,
    required int rows,
    required String title,
    required String sub,
    required IconData icon,
    bool on = false,
    bool offline = false,
    bool disabled = false,
    ThemeColors? color,
  }) => SizedBox(
    width: cols * cell + (cols - 1) * gap,
    height: rows * cell + (rows - 1) * gap,
    child: ButtonTileWidget(
      onTap: _noop,
      onIconTap: _noop,
      title: title,
      subTitle: Text(sub),
      icon: icon,
      isOn: on,
      isOffline: offline,
      isDisabled: disabled,
      activeColor: color,
      colSpan: cols,
      rowSpan: rows,
    ),
  );

  return Wrap(
    spacing: gap,
    runSpacing: gap,
    children: [
      tile(cols: 1, rows: 1, title: 'Fan', sub: 'Off', icon: MdiIcons.fan),
      tile(
        cols: 1,
        rows: 1,
        title: 'TV',
        sub: 'On',
        icon: MdiIcons.television,
        on: true,
        color: ThemeColors.media,
      ),
      tile(
        cols: 2,
        rows: 1,
        title: 'Floor lamp',
        sub: 'On · 60 %',
        icon: MdiIcons.lightbulbOutline,
        on: true,
        color: ThemeColors.lights,
      ),
      tile(
        cols: 2,
        rows: 1,
        title: 'Desk lamp',
        sub: 'Offline',
        icon: MdiIcons.lightbulbOutline,
        offline: true,
      ),
      tile(
        cols: 2,
        rows: 1,
        title: 'Heater',
        sub: 'Unavailable',
        icon: MdiIcons.radiator,
        disabled: true,
      ),
      tile(
        cols: 2,
        rows: 2,
        title: 'Floor lamp',
        sub: 'On · 60 %',
        icon: MdiIcons.lightbulbOutline,
        on: true,
        color: ThemeColors.lights,
      ),
    ],
  );
}

Widget _offlineNote(BuildContext context) => SizedBox(
  width: AppSpacings.scale(420),
  child: OfflineNote(lastSeenText: '21:10', sizeClass: _class(context)),
);

Widget _offlineDetail(BuildContext context) {
  final sizeClass = _class(context);

  return SizedBox(
    height: AppSpacings.scale(220),
    child: Stack(
      children: [
        Row(
          spacing: AppSpacings.pMd,
          children: [
            for (final s in _tileStates().take(3))
              Expanded(
                child: UniversalTile(
                  sizeClass: sizeClass,
                  icon: MdiIcons.lightbulbOutline,
                  name: s.name,
                  status: s.status,
                  isActive: s.active,
                  activeColor: ThemeColors.lights,
                ),
              ),
          ],
        ),
        DeviceOfflineState(
          isDark: Theme.of(context).brightness == Brightness.dark,
          lastSeenText: '21:10',
          sizeClass: sizeClass,
        ),
      ],
    ),
  );
}
