import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_banner.dart';
import 'package:fastybird_smart_panel/core/widgets/app_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/list_row.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_tile.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// DR-8: the list row and section label, the sheet and drawer, the dialogs,
/// toasts and the alert banner.
const List<GalleryEntry> listEntries = [
  GalleryEntry(
    title: 'List row: value, switch, button; selected, danger, disabled',
    builder: _rows,
  ),
  GalleryEntry(title: 'Section label', builder: _labels),
  GalleryEntry(title: 'Settings tile and settings row', builder: _settings),
  GalleryEntry(title: 'Bottom sheet', builder: _sheet),
  GalleryEntry(title: 'Right drawer', builder: _drawer),
  GalleryEntry(title: 'Confirm dialog: default and danger', builder: _confirm),
  GalleryEntry(title: 'Selection dialog', builder: _selection),
  GalleryEntry(
    title: 'Toast: success, info, warning, error, with an action',
    builder: _toasts,
  ),
  GalleryEntry(
    title: 'Alert banner: warning, danger, ok, info',
    builder: _banners,
  ),
];

ScreenSizeClass _class(BuildContext context) =>
    GalleryScope.of(context).sizeClass;

/// Samples are at most this wide, so they fit the narrowest canvas.
Widget _narrow(Widget child, {double width = 360}) => ConstrainedBox(
  constraints: BoxConstraints(maxWidth: AppSpacings.scale(width)),
  child: child,
);

Widget _column(List<Widget> children) => Column(
  crossAxisAlignment: CrossAxisAlignment.stretch,
  spacing: AppSpacings.pMd,
  children: children,
);

Widget _value(BuildContext context, String text) {
  final neutrals = Theme.of(context).neutrals;

  return Row(
    mainAxisSize: MainAxisSize.min,
    spacing: AppSpacings.pXs,
    children: [
      Flexible(
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: AppFontSize.small,
            color: neutrals.textSecondary,
          ),
        ),
      ),
      Icon(
        MdiIcons.chevronRight,
        size: AppSpacings.scale(14),
        color: neutrals.textSecondary,
      ),
    ],
  );
}

Widget _rows(BuildContext context) {
  final sizeClass = _class(context);

  return _narrow(
    _column([
      AppListRow(
        title: 'Screen lock delay',
        trailing: _value(context, '5 minutes'),
        onTap: () {},
        sizeClass: sizeClass,
      ),
      AppListRow(
        title: 'Screen saver',
        subtitle: 'Flip clock after the lock delay',
        trailing: AppSwitch(value: true, onChanged: (_) {}),
        sizeClass: sizeClass,
      ),
      AppListRow(
        title: 'Restart panel',
        subtitle: 'Only this display restarts',
        trailing: SectionTitleButton(label: 'Restart', onTap: () {}),
        sizeClass: sizeClass,
      ),
      AppListRow(
        title: 'Relax',
        icon: MdiIcons.sofaOutline,
        selected: true,
        onTap: () {},
        sizeClass: sizeClass,
      ),
      AppListRow(
        title: 'Factory reset',
        subtitle: 'Forgets the gateway and the room',
        danger: true,
        trailing: SectionTitleButton(label: 'Reset', onTap: () {}),
        sizeClass: sizeClass,
      ),
      AppListRow(
        title: 'Wake word',
        subtitle: 'This panel has no microphone',
        enabled: false,
        trailing: const AppSwitch(value: false),
        sizeClass: sizeClass,
      ),
    ]),
  );
}

Widget _labels(BuildContext context) {
  final theme = Theme.of(context);

  return _narrow(
    _column([
      const SectionLabel(label: 'Units'),
      SectionLabel(
        label: 'Other lights',
        trailing: SectionTitleButton(
          label: 'All off',
          icon: MdiIcons.power,
          onTap: () {},
        ),
      ),
      SectionTitle(
        title: 'Danger',
        icon: MdiIcons.alertOutline,
        color: theme.status(AppStatus.danger).text,
      ),
      SectionHeader(title: 'Climate devices', icon: MdiIcons.devices, count: 5),
    ]),
  );
}

Widget _settings(BuildContext context) {
  final sizeClass = _class(context);
  final accent = Theme.of(context).accent;
  final neutrals = Theme.of(context).neutrals;

  return _narrow(
    _column([
      Row(
        spacing: AppSpacings.pMd,
        children: [
          for (final (icon, label, maintenance) in [
            (MdiIcons.weatherSunny, 'Display', false),
            (MdiIcons.wrenchOutline, 'Maintenance', true),
          ])
            Expanded(
              child: SizedBox(
                height: AppSpacings.scale(96),
                child: SettingsTile(
                  label: label,
                  icon: icon,
                  iconColor: maintenance ? neutrals.textSecondary : accent.text,
                  iconBgColor: maintenance ? neutrals.fillBase : accent.soft,
                  sizeClass: sizeClass,
                  onTap: () {},
                ),
              ),
            ),
        ],
      ),
      SettingsCard(
        icon: MdiIcons.microphone,
        iconColor: accent.text,
        iconBgColor: accent.soft,
        label: 'Sensitivity',
        description: 'How easily the wake word is heard',
        bottom: AppSlider(value: 0.5, onChanged: (_) {}),
      ),
    ]),
  );
}

List<Widget> _sheetRows(BuildContext context, ScreenSizeClass sizeClass) => [
  for (final (label, value, selected) in [
    ('Main', '50 %', true),
    ('Task', 'Off', false),
    ('Ambient', '30 %', false),
  ])
    AppListRow(
      title: label,
      icon: MdiIcons.lightbulbOutline,
      selected: selected,
      trailing: Padding(
        padding: EdgeInsetsDirectional.only(end: AppSpacings.pMd),
        child: Text(
          value,
          style: TextStyle(
            fontSize: AppFontSize.small,
            color: Theme.of(context).neutrals.textSecondary,
          ),
        ),
      ),
      onTap: () {},
      sizeClass: sizeClass,
    ),
];

Widget _sheet(BuildContext context) {
  final sizeClass = _class(context);
  final padding = AppSpacings.scale(SheetMetrics.paddingFor(sizeClass));

  return _narrow(
    BottomSheetDialog(
      title: 'Light roles',
      subtitle: '3 roles · tap one to control it',
      sizeClass: sizeClass,
      content: Padding(
        padding: EdgeInsets.symmetric(horizontal: padding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: AppSpacings.scale(4),
          children: _sheetRows(context, sizeClass),
        ),
      ),
      bottomSection: AppDialogButton(
        label: 'Sync all',
        onTap: () {},
        sizeClass: sizeClass,
      ),
    ),
    width: 420,
  );
}

Widget _drawer(BuildContext context) {
  final sizeClass = _class(context);

  return SizedBox(
    height: AppSpacings.scale(260),
    child: RightDrawer(
      title: 'Light roles',
      subtitle: '3 roles',
      sizeClass: sizeClass,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.scale(4),
        children: _sheetRows(context, sizeClass),
      ),
    ),
  );
}

Widget _confirm(BuildContext context) {
  final sizeClass = _class(context);

  Widget actions(String confirm, {bool danger = false}) => Row(
    spacing: AppSpacings.scale(AppDialogMetrics.actionGap),
    children: [
      Expanded(
        child: AppDialogButton(label: 'Cancel', onTap: () {}, sizeClass: sizeClass),
      ),
      Expanded(
        child: AppDialogButton(
          label: confirm,
          primary: true,
          danger: danger,
          onTap: () {},
          sizeClass: sizeClass,
        ),
      ),
    ],
  );

  return Wrap(
    spacing: AppSpacings.pLg,
    runSpacing: AppSpacings.pLg,
    children: [
      AppDialog(
        title: 'Restart this panel?',
        message: 'Only this display restarts. It takes about a minute.',
        actions: actions('Restart'),
        sizeClass: sizeClass,
      ),
      AppDialog(
        title: 'Reset this panel?',
        message:
            'It forgets its gateway and its room. Devices and the admin app '
            'are not affected.',
        danger: true,
        actions: actions('Reset panel', danger: true),
        sizeClass: sizeClass,
      ),
    ],
  );
}

Widget _selection(BuildContext context) {
  final sizeClass = _class(context);

  return AppDialog(
    title: 'Screen lock delay',
    showCloseButton: true,
    sizeClass: sizeClass,
    child: AppSelectionList<int>(
      options: const [
        SelectionOption(value: 0, label: 'Never'),
        SelectionOption(value: 30, label: '30 seconds'),
        SelectionOption(value: 60, label: '1 minute'),
        SelectionOption(value: 300, label: '5 minutes'),
      ],
      currentValue: 300,
      onSelected: (_) {},
      sizeClass: sizeClass,
    ),
  );
}

Widget _toasts(BuildContext context) {
  final sizeClass = _class(context);
  final brightness = Theme.of(context).brightness;
  final bottom = AppSpacings.scale(
    ToastMetrics.bottomFor(sizeClass, portrait: false),
  );

  Widget toast(ToastType type, String message, {String? action}) => SizedBox(
    height: bottom + AppSpacings.scale(ToastMetrics.height),
    child: Stack(
      children: [
        ToastView(
          message: message,
          type: type,
          brightness: brightness,
          sizeClass: sizeClass,
          portrait: false,
          animate: false,
          actionLabel: action,
          onAction: action == null ? null : () {},
          onDismiss: () {},
        ),
      ],
    ),
  );

  return _column([
    toast(ToastType.success, 'Disarmed by Anna'),
    toast(ToastType.info, 'Scene saved'),
    toast(ToastType.warning, 'Not confirmed. Back to 50 %'),
    toast(ToastType.error, 'Floor lamp did not respond', action: 'Retry'),
  ]);
}

Widget _banners(BuildContext context) {
  final sizeClass = _class(context);

  return _narrow(
    _column([
      AlertBanner(
        text: 'Connection lost. Reconnecting',
        icon: MdiIcons.refresh,
        color: ThemeColors.warning,
        sizeClass: sizeClass,
      ),
      AlertBanner(
        title: 'High temperature',
        text: 'Kitchen sensor',
        color: ThemeColors.danger,
        onTap: () {},
        sizeClass: sizeClass,
      ),
      AlertBanner(
        text: 'All sensors report',
        icon: MdiIcons.checkCircleOutline,
        color: ThemeColors.success,
        sizeClass: sizeClass,
      ),
      AlertBanner(
        text: 'Updates paused',
        icon: MdiIcons.informationOutline,
        color: ThemeColors.info,
        sizeClass: sizeClass,
      ),
    ]),
    width: 480,
  );
}
