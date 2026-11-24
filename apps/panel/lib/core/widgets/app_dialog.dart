import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The dialogs' sizes (design canvas, "Settings and weather").
class AppDialogMetrics {
  AppDialogMetrics._();

  /// The dialog's width, held inside the screen less two page paddings on
  /// each side.
  static double widthFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 228,
    ScreenSizeClass.regular => 320,
    ScreenSizeClass.expanded => 400,
  };

  static double paddingFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.compact ? 10 : 16;

  /// Space between the title, the message or options and the actions: the
  /// page gap (6 / 8 / 12).
  static double gapFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 6,
    ScreenSizeClass.regular => 8,
    ScreenSizeClass.expanded => 12,
  };

  /// The title: 14 / 16 / 18, 500 (the header title of the class).
  static double titleFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 14,
    ScreenSizeClass.regular => 16,
    ScreenSizeClass.expanded => 18,
  };

  /// Cancel and confirm.
  static double actionFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.compact ? 36 : 44;

  /// A selection option; 36 on Compact, the touch floor.
  static double optionFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 36,
    ScreenSizeClass.regular => 40,
    ScreenSizeClass.expanded => 48,
  };

  static const double actionGap = 6;
  static const double optionGap = 4;
  static const double radio = 14;
  static const double radioRing = 2;
  static const double radioRingSelected = 4;

  /// The danger icon before a destructive title.
  static const double dangerCircle = 28;
  static const double dangerIcon = 16;
}

/// A choice in a selection dialog.
class SelectionOption<T> {
  final T value;
  final String label;

  /// Optional group name. Options with the same group are displayed
  /// under a shared heading.
  final String? group;

  const SelectionOption({
    required this.value,
    required this.label,
    this.group,
  });
}

/// The dialog surface (docs/display-ui-design-spec.md §5): `surface.raised`
/// with a `border.light` outline, radius 12, 228 / 320 / 400 wide. A title
/// (with a danger icon, or a close button), then an optional message, the
/// [child] and the [actions].
class AppDialog extends StatelessWidget {
  const AppDialog({
    super.key,
    required this.title,
    this.message,
    this.child,
    this.actions,
    this.danger = false,
    this.showCloseButton = false,
    this.sizeClass,
  });

  final String title;
  final String? message;
  final Widget? child;
  final Widget? actions;

  /// A destructive dialog: an alert icon on the danger tint leads the title.
  final bool danger;

  final bool showCloseButton;

  /// The class to size the dialog for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final dangerColors = theme.status(AppStatus.danger);
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final gap = AppSpacings.scale(AppDialogMetrics.gapFor(resolvedClass));

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: AppSpacings.scale(AppDialogMetrics.widthFor(resolvedClass)),
        maxHeight: screen.logicalHeight * 0.85,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: neutrals.surfaceRaised,
          border: Border.all(
            color: neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          boxShadow: AppRaisedShadow.of(theme.brightness),
        ),
        padding: EdgeInsets.all(
          AppSpacings.scale(AppDialogMetrics.paddingFor(resolvedClass)),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: gap,
            children: [
              Row(
                spacing: AppSpacings.pMd,
                children: [
                  if (danger)
                    Container(
                      width: AppSpacings.scale(AppDialogMetrics.dangerCircle),
                      height: AppSpacings.scale(AppDialogMetrics.dangerCircle),
                      decoration: BoxDecoration(
                        color: dangerColors.soft,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        MdiIcons.alertOutline,
                        size: AppSpacings.scale(AppDialogMetrics.dangerIcon),
                        color: dangerColors.text,
                      ),
                    ),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        title,
                        style: TextStyle(
                          color: neutrals.textPrimary,
                          fontSize: AppSpacings.scale(
                            AppDialogMetrics.titleFor(resolvedClass),
                          ),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                  if (showCloseButton) const SheetCloseButton(),
                ],
              ),
              if (message != null)
                Flexible(
                  child: SingleChildScrollView(
                    child: Text(
                      message!,
                      style: TextStyle(
                        color: neutrals.textSecondary,
                        fontSize: AppFontSize.small,
                        height: 1.4,
                      ),
                    ),
                  ),
                ),
              if (child != null) Flexible(child: child!),
              if (actions != null) actions!,
            ],
          ),
        ),
      ),
    );
  }
}

/// A dialog button: `surface.card` with a `border.base` outline (cancel),
/// the accent fill with white text (confirm), or the danger tint with danger
/// text, outline and an alert icon (a destructive confirm).
class AppDialogButton extends StatelessWidget {
  const AppDialogButton({
    super.key,
    required this.label,
    required this.onTap,
    this.primary = false,
    this.danger = false,
    this.sizeClass,
  });

  final String label;
  final VoidCallback onTap;
  final bool primary;
  final bool danger;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final dangerColors = theme.status(AppStatus.danger);
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;

    final (background, outline, foreground) = danger
        ? (dangerColors.soft, dangerColors.text, dangerColors.text)
        : primary
        ? (theme.accent.fill, theme.accent.fill, AppColors.white)
        : (neutrals.surfaceCard, neutrals.borderBase, neutrals.textPrimary);
    final radius = BorderRadius.circular(AppBorderRadius.base);

    return Semantics(
      button: true,
      child: Material(
        color: background,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(color: outline, width: AppSpacings.scale(1)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: SizedBox(
            height: AppSpacings.scale(AppDialogMetrics.actionFor(resolvedClass)),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: AppSpacings.scale(5),
                children: [
                  if (danger)
                    Icon(
                      MdiIcons.alertOutline,
                      size: AppSpacings.scale(14),
                      color: foreground,
                    ),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: foreground,
                        fontSize: AppFontSize.small,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Shows a dialog in the app's frame: the scrim, centred, two page paddings
/// clear of the screen's edges.
Future<T?> showAppDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool barrierDismissible = true,
}) {
  final pagePadding = AppSpacings.scale(
    AppDialogMetrics.gapFor(locator<ScreenService>().sizeClass),
  );

  return showDialog<T>(
    context: context,
    barrierColor: AppScrim.color,
    barrierDismissible: barrierDismissible,
    builder: (context) => Dialog(
      backgroundColor: AppColors.blank,
      surfaceTintColor: AppColors.blank,
      shadowColor: AppColors.blank,
      elevation: 0,
      insetPadding: EdgeInsets.all(2 * pagePadding),
      // No 280 px floor: the dialog sizes itself for the class.
      constraints: const BoxConstraints(),
      child: Builder(builder: builder),
    ),
  );
}

/// Asks to confirm an action: the title, a one-line [message], and Cancel
/// beside [confirmLabel]. A [danger] action takes the danger look. Returns
/// true when confirmed; false when cancelled or dismissed.
Future<bool> showAppConfirmDialog({
  required BuildContext context,
  required String title,
  String? message,
  required String confirmLabel,
  String? cancelLabel,
  bool danger = false,
}) async {
  final confirmed = await showAppDialog<bool>(
    context: context,
    builder: (context) {
      final localizations = AppLocalizations.of(context)!;

      return AppDialog(
        title: title,
        message: message,
        danger: danger,
        actions: Row(
          spacing: AppSpacings.scale(AppDialogMetrics.actionGap),
          children: [
            Expanded(
              child: AppDialogButton(
                label: cancelLabel ?? localizations.button_cancel,
                onTap: () => Navigator.of(context).pop(false),
              ),
            ),
            Expanded(
              child: AppDialogButton(
                label: confirmLabel,
                primary: true,
                danger: danger,
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.of(context).pop(true);
                },
              ),
            ),
          ],
        ),
      );
    },
  );

  return confirmed ?? false;
}

/// A list of [options] to pick one from (docs/display-ui-design-spec.md §5):
/// the dialog with a close button and no actions; a tap selects and closes.
/// Options with a [SelectionOption.group] sit under its section label.
///
/// Returns the selected value, or null if dismissed.
Future<T?> showAppSelectionDialog<T>({
  required BuildContext context,
  required String title,
  required List<SelectionOption<T>> options,
  T? currentValue,
}) {
  return showAppDialog<T>(
    context: context,
    builder: (context) => AppDialog(
      title: title,
      showCloseButton: true,
      child: AppSelectionList<T>(
        options: options,
        currentValue: currentValue,
        onSelected: (value) {
          HapticFeedback.lightImpact();
          Navigator.of(context).pop(value);
        },
      ),
    ),
  );
}

/// The options of a selection dialog: rows on `fill.light` with a radio, the
/// selected one on the accent's soft tint with an accent outline.
class AppSelectionList<T> extends StatelessWidget {
  const AppSelectionList({
    super.key,
    required this.options,
    required this.onSelected,
    this.currentValue,
    this.sizeClass,
  });

  final List<SelectionOption<T>> options;
  final T? currentValue;
  final ValueChanged<T> onSelected;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    // Groups keep the order they first appear in; ungrouped options lead.
    final groups = <String, List<SelectionOption<T>>>{};
    for (final option in options) {
      groups.putIfAbsent(option.group ?? '', () => []).add(option);
    }

    final children = <Widget>[];
    for (final MapEntry(key: name, value: members) in groups.entries) {
      if (name.isNotEmpty) children.add(SectionLabel(label: name));
      for (final option in members) {
        children.add(
          _SelectionRow<T>(
            option: option,
            selected: option.value == currentValue,
            onTap: () => onSelected(option.value),
            sizeClass: resolvedClass,
          ),
        );
      }
    }

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.scale(AppDialogMetrics.optionGap),
        children: children,
      ),
    );
  }
}

class _SelectionRow<T> extends StatelessWidget {
  const _SelectionRow({
    required this.option,
    required this.selected,
    required this.onTap,
    required this.sizeClass,
  });

  final SelectionOption<T> option;
  final bool selected;
  final VoidCallback onTap;
  final ScreenSizeClass sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final accent = theme.accent;
    final radius = BorderRadius.circular(AppBorderRadius.base);

    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      button: true,
      child: Material(
        color: selected ? accent.soft : neutrals.fillLight,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(
            color: selected ? accent.text : neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: AppSpacings.scale(AppDialogMetrics.optionFor(sizeClass)),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.scale(10)),
              child: Row(
                spacing: AppSpacings.pMd,
                children: [
                  Container(
                    width: AppSpacings.scale(AppDialogMetrics.radio),
                    height: AppSpacings.scale(AppDialogMetrics.radio),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: selected ? accent.text : neutrals.textSecondary,
                        width: AppSpacings.scale(
                          selected
                              ? AppDialogMetrics.radioRingSelected
                              : AppDialogMetrics.radioRing,
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      option.label,
                      style: TextStyle(
                        color: neutrals.textPrimary,
                        fontSize: AppFontSize.small,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
