import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// DR-5: the page header, its buttons, the icon tile and the state icon.
const List<GalleryEntry> headerEntries = [
  GalleryEntry(title: 'Screen header', builder: _screenHeader),
  GalleryEntry(title: 'Pushed page with the power button', builder: _pushedPage),
  GalleryEntry(title: 'Offline device', builder: _offlineDevice),
  GalleryEntry(title: 'Long title and state', builder: _longTitle),
  GalleryEntry(
    title: 'Header buttons: back, plain, active, accent, disabled, power off and on',
    builder: _buttons,
  ),
  GalleryEntry(title: 'Icon tiles by domain', builder: _iconTiles),
  GalleryEntry(title: 'State icon', builder: _stateIcons),
];

void _noop() {}

Widget _screenHeader(BuildContext context) => PageHeader(
      sizeClass: GalleryScope.of(context).sizeClass,
      title: 'Lights',
      subtitle: '3 of 5 on · Relax',
      icon: MdiIcons.lightbulbOutline,
      iconColor: ThemeColors.lights,
      trailing: const HeaderIconButton(
        icon: Icons.tune,
        onTap: _noop,
      ),
    );

Widget _pushedPage(BuildContext context) => PageHeader(
      sizeClass: GalleryScope.of(context).sizeClass,
      title: 'Ceiling fan',
      subtitle: 'On · speed 2 of 5',
      icon: MdiIcons.fan,
      iconColor: ThemeColors.climate,
      onBack: _noop,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pMd,
        children: [
          HeaderIconButton(icon: MdiIcons.cog, onTap: _noop),
          const DevicePowerButton(
            isOn: true,
            themeColor: ThemeColors.climate,
            onTap: _noop,
          ),
        ],
      ),
    );

Widget _offlineDevice(BuildContext context) => PageHeader(
      sizeClass: GalleryScope.of(context).sizeClass,
      title: 'Ceiling light',
      subtitle: 'Offline · last seen 21:10',
      subtitleIcon: MdiIcons.alert,
      subtitleColor: Theme.of(context).status(AppStatus.warning).text,
      icon: MdiIcons.lightbulbOutline,
      iconColor: ThemeColors.neutral,
      onBack: _noop,
      trailing: const DevicePowerButton(isOn: false),
    );

Widget _longTitle(BuildContext context) => PageHeader(
      sizeClass: GalleryScope.of(context).sizeClass,
      title: 'Living room ceiling light above the dining table',
      subtitle: 'On · 80 % · warm white · scene Evening, set by the schedule',
      icon: MdiIcons.lightbulbOutline,
      iconColor: ThemeColors.lights,
      onBack: _noop,
      trailing: const DevicePowerButton(
        isOn: true,
        themeColor: ThemeColors.lights,
        onTap: _noop,
      ),
    );

Widget _buttons(BuildContext context) => Wrap(
      spacing: AppSpacings.pMd,
      runSpacing: AppSpacings.pMd,
      children: [
        const HeaderBackButton(onTap: _noop),
        HeaderIconButton(icon: MdiIcons.cog, onTap: _noop),
        HeaderIconButton(
          icon: MdiIcons.television,
          color: ThemeColors.media,
          onTap: _noop,
        ),
        HeaderIconButton(
          icon: MdiIcons.lightbulbGroup,
          color: ThemeColors.primary,
          onTap: _noop,
        ),
        HeaderIconButton(icon: MdiIcons.refresh),
        const DevicePowerButton(isOn: false, onTap: _noop),
        const DevicePowerButton(isOn: true, onTap: _noop),
      ],
    );

Widget _iconTiles(BuildContext context) {
  final sizeClass = GalleryScope.of(context).sizeClass;

  return Wrap(
    spacing: AppSpacings.pMd,
    runSpacing: AppSpacings.pMd,
    children: [
      for (final (icon, color) in [
        (MdiIcons.lightbulbOutline, ThemeColors.lights),
        (MdiIcons.thermometer, ThemeColors.climate),
        (MdiIcons.blindsHorizontal, ThemeColors.shading),
        (MdiIcons.television, ThemeColors.media),
        (MdiIcons.accessPoint, ThemeColors.sensors),
        (MdiIcons.flash, ThemeColors.energy),
        (MdiIcons.cctv, ThemeColors.cameras),
        (MdiIcons.home, ThemeColors.primary),
        (MdiIcons.lightbulbOffOutline, ThemeColors.neutral),
      ])
        HeaderMainIcon(icon: icon, color: color, sizeClass: sizeClass),
    ],
  );
}

Widget _stateIcons(BuildContext context) {
  final theme = Theme.of(context);
  final sizeClass = GalleryScope.of(context).sizeClass;
  final screenService = locator<ScreenService>();

  return Wrap(
    spacing: AppSpacings.pMd,
    runSpacing: AppSpacings.pMd,
    children: [
      for (final status in [AppStatus.danger, AppStatus.warning, AppStatus.info])
        IconContainer(
          screenService: screenService,
          icon: MdiIcons.alertCircleOutline,
          color: theme.status(status).text,
          softColor: theme.status(status).soft,
          isLandscape: false,
          sizeClass: sizeClass,
        ),
      IconContainer(
        screenService: screenService,
        icon: MdiIcons.accessPointNetwork,
        color: theme.accent.text,
        softColor: theme.accent.soft,
        isLandscape: false,
        sizeClass: sizeClass,
      ),
    ],
  );
}
