import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Layout options for ValueSelectorRow
enum ValueSelectorRowLayout {
  /// Icon and name on left, value and arrow on right (default)
  horizontal,

  /// Icon on left, name and value stacked vertically, arrow on right
  /// Better for smaller screens where horizontal space is limited
  compact,
}

/// Represents a selectable option in the value selector
class ValueOption<T> {
  /// The actual value this option represents
  final T value;

  /// Display label for this option
  final String label;

  /// Optional icon to show with the label
  final IconData? icon;

  const ValueOption({
    required this.value,
    required this.label,
    this.icon,
  });
}

/// A row widget that displays current value and opens a selector sheet on tap.
///
/// Use this as a trigger to open [ValueSelectorSheet].
class ValueSelectorRow<T> extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Current selected value
  final T? currentValue;

  /// List of available options
  final List<ValueOption<T>> options;

  /// Label shown on the left side
  final String label;

  /// Icon shown before the label
  final IconData icon;

  /// Accent color for active state
  final Color? activeColor;

  /// Title shown in the selector sheet
  final String sheetTitle;

  /// Callback when value changes
  final ValueChanged<T?>? onChanged;

  /// Function to format the display value (if not provided, uses option label)
  final String Function(T? value)? displayFormatter;

  /// Number of columns in the selector grid (default: 4)
  final int columns;

  /// Layout style for the row (default: horizontal)
  final ValueSelectorRowLayout layout;

  /// Whether to show the chevron icon on the right (default: true)
  final bool showChevron;

  ValueSelectorRow({
    super.key,
    required this.currentValue,
    required this.options,
    required this.label,
    required this.icon,
    this.activeColor,
    required this.sheetTitle,
    this.onChanged,
    this.displayFormatter,
    this.columns = 4,
    this.layout = ValueSelectorRowLayout.horizontal,
    this.showChevron = true,
  });

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  String _getDisplayValue(AppLocalizations localizations) {
    if (displayFormatter != null) {
      return displayFormatter!(currentValue);
    }
    final option = options.where((o) => o.value == currentValue).firstOrNull;
    return option?.label ?? localizations.on_state_off;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isDisabled = onChanged == null;

    // Use disabled colors when onChanged is null
    final cardColor = isDisabled
        ? (isDark ? AppFillColorDark.darker : AppFillColorLight.darker)
        : (isDark ? AppFillColorDark.light : AppFillColorLight.blank);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isDark ? AppTextColorDark.primary : AppTextColorLight.primary);
    final secondaryColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);
    final iconBgColor = isDisabled
        ? (isDark ? AppFillColorDark.light : AppFillColorLight.light)
        : (isDark ? AppFillColorDark.darker : AppFillColorLight.light);
    final iconColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular);

    return Material(
      color: cardColor,
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      child: InkWell(
        onTap: onChanged != null
            ? () {
                HapticFeedback.lightImpact();
                _showSelectorSheet(context, isDark);
              }
            : null,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: layout == ValueSelectorRowLayout.compact
                ? AppSpacings.pSm
                : AppSpacings.pMd,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: Border.all(
              color: borderColor,
              width: _scale(1),
            ),
          ),
          child: Row(
            children: [
              // Icon with background container (matching UniversalTile style)
              Container(
                width: _scale(32),
                height: _scale(32),
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Icon(
                  icon,
                  color: iconColor,
                  size: _scale(18),
                ),
              ),
              AppSpacings.spacingMdHorizontal,
              Expanded(
                child: layout == ValueSelectorRowLayout.compact
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            label,
                            style: TextStyle(
                              color: textColor,
                              fontSize: AppFontSize.base,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                          Text(
                            _getDisplayValue(localizations),
                            style: TextStyle(
                              color: secondaryColor,
                              fontSize: AppFontSize.extraSmall,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        ],
                      )
                    : Text(
                        label,
                        style: TextStyle(
                          color: textColor,
                          fontSize: AppFontSize.base,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
              ),
              if (layout == ValueSelectorRowLayout.horizontal) ...[
                Text(
                  _getDisplayValue(localizations),
                  style: TextStyle(
                    color: secondaryColor,
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (showChevron) AppSpacings.spacingXsHorizontal,
              ],
              if (showChevron)
                Icon(
                  MdiIcons.chevronRight,
                  color: secondaryColor,
                  size: _scale(20),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSelectorSheet(BuildContext context, bool isDark) {
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.blank,
      builder: (context) => ValueSelectorSheet<T>(
        currentValue: currentValue,
        options: options,
        title: sheetTitle,
        activeColor: effectiveActiveColor,
        columns: columns,
        onConfirm: (value) {
          Navigator.pop(context);
          onChanged?.call(value);
        },
      ),
    );
  }
}

/// How options are rendered in [ValueSelectorSheet].
enum ValueSelectorOptionStyle {
  /// Grid of tappable cards (default)
  grid,

  /// OutlinedButton for unselected, OutlinedButton (primary) for selected
  buttons,
}

/// A bottom sheet widget for selecting a value from a grid of options.
class ValueSelectorSheet<T> extends StatefulWidget {
  /// Currently selected value
  final T? currentValue;

  /// Available options to select from
  final List<ValueOption<T>> options;

  /// Title shown at the top of the sheet
  final String title;

  /// Accent color for selection
  final Color? activeColor;

  /// Callback when selection is confirmed
  final ValueChanged<T?>? onConfirm;

  /// Number of columns in the grid
  final int columns;

  /// How to render options: [ValueSelectorOptionStyle.grid] (cards) or
  /// [ValueSelectorOptionStyle.buttons] (outlined / primary filled).
  final ValueSelectorOptionStyle optionStyle;

  const ValueSelectorSheet({
    super.key,
    required this.currentValue,
    required this.options,
    required this.title,
    this.activeColor,
    this.onConfirm,
    this.columns = 4,
    this.optionStyle = ValueSelectorOptionStyle.grid,
  });

  @override
  State<ValueSelectorSheet<T>> createState() => _ValueSelectorSheetState<T>();
}

class _ValueSelectorSheetState<T> extends State<ValueSelectorSheet<T>> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late int _selectedIndex;

  @override
  void initState() {
    super.initState();
    if (widget.options.isEmpty) {
      _selectedIndex = -1; // No selection when options is empty
    } else {
      final index = widget.options.indexWhere((o) => o.value == widget.currentValue);
      _selectedIndex = index < 0 ? 0 : index.clamp(0, widget.options.length - 1);
    }
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor = widget.activeColor ??
        (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final handleColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;

    final maxHeight = MediaQuery.of(context).size.height * 0.7;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.base : AppFillColorLight.blank,
          borderRadius: BorderRadius.vertical(top: Radius.circular(_scale(24))),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacings.pLg,
              _scale(12),
              AppSpacings.pLg,
              AppSpacings.pXl,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
              // Handle
              Center(
                child: Container(
                  width: _scale(36),
                  height: _scale(4),
                  decoration: BoxDecoration(
                    color: handleColor,
                    borderRadius: BorderRadius.circular(AppBorderRadius.small),
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,

              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.title,
                    style: TextStyle(
                      color: textColor,
                      fontSize: AppFontSize.extraLarge,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Theme(
                    data: isDark
                        ? ThemeData(brightness: Brightness.dark, filledButtonTheme: AppFilledButtonsDarkThemes.neutral)
                        : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral),
                    child: FilledButton(
                      onPressed: () => Navigator.pop(context),
                      style: FilledButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size(_scale(32), _scale(32)),
                        maximumSize: Size(_scale(32), _scale(32)),
                        shape: const CircleBorder(),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Icon(
                        MdiIcons.close,
                        size: _scale(18),
                        color: isDark
                            ? AppFilledButtonsDarkThemes.neutralForegroundColor
                            : AppFilledButtonsLightThemes.neutralForegroundColor,
                      ),
                    ),
                  ),
                ],
              ),
              AppSpacings.spacingLgVertical,

              // Options Grid or Buttons
              Flexible(
                child: SingleChildScrollView(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final spacing = _scale(10);
                      final totalSpacing = spacing * (widget.columns - 1);
                      final itemWidth =
                          (constraints.maxWidth - totalSpacing) / widget.columns;

                      if (widget.optionStyle == ValueSelectorOptionStyle.buttons) {
                        return Wrap(
                          spacing: spacing,
                          runSpacing: spacing,
                          children: List.generate(widget.options.length, (index) {
                            final option = widget.options[index];
                            final isSelected = _selectedIndex == index;
                            final isDark = Theme.of(context).brightness == Brightness.dark;
                            final themeData = isSelected
                                ? (isDark
                                    ? ThemeData(brightness: Brightness.dark, outlinedButtonTheme: AppOutlinedButtonsDarkThemes.primary)
                                    : ThemeData(outlinedButtonTheme: AppOutlinedButtonsLightThemes.primary))
                                : (isDark
                                    ? ThemeData(brightness: Brightness.dark, outlinedButtonTheme: AppOutlinedButtonsDarkThemes.base)
                                    : ThemeData(outlinedButtonTheme: AppOutlinedButtonsLightThemes.base));

                            final buttonChild = Text(
                              option.label,
                              style: TextStyle(
                                fontSize: AppFontSize.small,
                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                              ),
                              textAlign: TextAlign.center,
                            );

                            return SizedBox(
                              width: itemWidth,
                              child: Theme(
                                data: themeData,
                                child: OutlinedButton(
                                  onPressed: () {
                                    HapticFeedback.lightImpact();
                                    setState(() => _selectedIndex = index);
                                  },
                                  style: OutlinedButton.styleFrom(
                                    padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(AppBorderRadius.base),
                                    ),
                                  ),
                                  child: buttonChild,
                                )
                              ),
                            );
                          }),
                        );
                      }

                      return Wrap(
                        spacing: spacing,
                        runSpacing: spacing,
                        children: List.generate(widget.options.length, (index) {
                          final option = widget.options[index];
                          final isSelected = _selectedIndex == index;

                          // Double-border technique to prevent UI jumping on selection
                          final innerBgColor = isSelected
                              ? effectiveActiveColor.withValues(alpha: 0.12)
                              : cardColor;

                          return GestureDetector(
                            onTap: () => setState(() => _selectedIndex = index),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: itemWidth,
                              decoration: BoxDecoration(
                                borderRadius:
                                    BorderRadius.circular(AppBorderRadius.base),
                                border: Border.all(
                                  color:
                                      isSelected ? effectiveActiveColor : borderColor,
                                  width: _scale(1),
                                ),
                              ),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
                                decoration: BoxDecoration(
                                  color: innerBgColor,
                                  borderRadius:
                                      BorderRadius.circular(AppBorderRadius.base - 1),
                                  border: Border.all(
                                    color:
                                        isSelected ? effectiveActiveColor : innerBgColor,
                                    width: _scale(1),
                                  ),
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (option.icon != null) ...[
                                      Icon(
                                        option.icon,
                                        color: isSelected
                                            ? effectiveActiveColor
                                            : secondaryColor,
                                        size: _scale(20),
                                      ),
                                      AppSpacings.spacingXsVertical,
                                    ],
                                    Text(
                                      option.label,
                                      style: TextStyle(
                                        color: isSelected
                                            ? effectiveActiveColor
                                            : textColor,
                                        fontSize: AppFontSize.small,
                                        fontWeight: isSelected
                                            ? FontWeight.w600
                                            : FontWeight.w500,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                      );
                    },
                  ),
                ),
              ),
              AppSpacings.spacingLgVertical,

              // Confirm Button
              SizedBox(
                width: double.infinity,
                child: Theme(
                  data: isDark
                      ? ThemeData(brightness: Brightness.dark, filledButtonTheme: AppFilledButtonsDarkThemes.primary)
                      : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.primary),
                  child: FilledButton(
                    onPressed: widget.options.isEmpty || _selectedIndex < 0
                        ? null
                        : () => widget.onConfirm?.call(widget.options[_selectedIndex].value),
                    style: FilledButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.base),
                      ),
                    ),
                    child: Text(
                      localizations.button_done,
                      style: TextStyle(
                        fontSize: AppFontSize.base,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}
