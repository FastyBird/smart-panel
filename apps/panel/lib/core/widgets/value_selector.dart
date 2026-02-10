import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_bottom_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
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

  /// When set together with [sliderMax], the landscape dialog shows a
  /// continuous slider instead of the option grid.
  final double? sliderMin;

  /// Upper bound for the continuous slider in landscape dialog.
  final double? sliderMax;

  /// Number of discrete divisions for the slider (null = continuous).
  final int? sliderDivisions;

  /// Unit suffix shown next to the slider value (e.g. "%" or "°").
  final String? sliderUnit;

  /// Step labels shown below the slider (e.g. ['0%', '50%', '100%']).
  /// When null, default labels from [SliderWithSteps] are used.
  final List<String>? sliderSteps;

  /// Custom formatter for the live value indicator in the slider dialog header.
  /// Receives the raw 0.0–1.0 slider position. When null, the indicator shows
  /// the slider position as a percentage (e.g. "60%").
  final String Function(double)? sliderValueFormatter;

  /// Theme color for the slider track and thumb. Defaults to [ThemeColors.primary].
  final ThemeColors sliderThemeColor;

  const ValueSelectorRow({
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
    this.sliderMin,
    this.sliderMax,
    this.sliderDivisions,
    this.sliderUnit,
    this.sliderSteps,
    this.sliderValueFormatter,
    this.sliderThemeColor = ThemeColors.primary,
  });

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
        isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;
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
              width: AppSpacings.scale(1),
            ),
          ),
          child: Row(
            spacing: AppSpacings.pMd,
            children: [
              // Icon with background container (matching UniversalTile style)
              Container(
                width: AppSpacings.scale(32),
                height: AppSpacings.scale(32),
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Icon(
                  icon,
                  color: iconColor,
                  size: AppSpacings.scale(18),
                ),
              ),
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
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showSelectorSheet(BuildContext context, bool isDark) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      _showSelectorDialog(context, isDark);
    } else {
      _showSelectorBottomSheet(context, isDark);
    }
  }

  void _showSelectorBottomSheet(BuildContext context, bool isDark) {
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final found = options.indexWhere((o) => o.value == currentValue);
    final initialIndex = options.isEmpty
        ? -1
        : (found < 0 ? 0 : found.clamp(0, options.length - 1));
    final selectedIndexNotifier = ValueNotifier<int>(initialIndex);

    showAppBottomSheet(
      context,
      title: sheetTitle,
      scrollable: false,
      content: ValueSelectorSheet<T>(
        currentValue: currentValue,
        options: options,
        title: sheetTitle,
        activeColor: effectiveActiveColor,
        columns: columns,
        selectedIndexNotifier: selectedIndexNotifier,
      ),
      bottomSection: _buildDoneButton(
        context,
        isDark,
        selectedIndexNotifier,
      ),
    );
  }

  bool get _hasSliderConfig => sliderMin != null && sliderMax != null;

  void _showSelectorDialog(BuildContext context, bool isDark) {
    if (_hasSliderConfig) {
      _showSliderDialog(context, isDark);
    } else {
      _showGridDialog(context, isDark);
    }
  }

  void _showGridDialog(BuildContext context, bool isDark) {
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final found = options.indexWhere((o) => o.value == currentValue);
    final initialIndex = options.isEmpty
        ? -1
        : (found < 0 ? 0 : found.clamp(0, options.length - 1));
    final selectedIndexNotifier = ValueNotifier<int>(initialIndex);

    final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

    showDialog(
      context: context,
      builder: (dialogContext) {
        return Center(
          child: Material(
            color: bgColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            elevation: 8,
            child: Container(
              constraints: BoxConstraints(
                maxWidth: AppSpacings.scale(360),
                maxHeight: MediaQuery.of(context).size.height * 0.7,
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                border: Border.all(
                  color: borderColor,
                  width: AppSpacings.scale(1),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header
                  _buildDialogHeader(dialogContext, isDark, textColor, borderColor),
                  // Content
                  Flexible(
                    child: ValueSelectorSheet<T>(
                      currentValue: currentValue,
                      options: options,
                      title: sheetTitle,
                      activeColor: effectiveActiveColor,
                      columns: columns,
                      selectedIndexNotifier: selectedIndexNotifier,
                    ),
                  ),
                  Divider(
                    height: AppSpacings.scale(1),
                    color: borderColor,
                  ),
                  // Done button
                  Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pLg,
                      vertical: AppSpacings.pMd,
                    ),
                    child: _buildDoneButton(
                      dialogContext,
                      isDark,
                      selectedIndexNotifier,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showSliderDialog(BuildContext context, bool isDark) {
    final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

    // Convert current value to 0.0–1.0 normalized slider position
    double rawValue;
    if (currentValue is int) {
      rawValue = (currentValue as int).toDouble();
    } else if (currentValue is double) {
      rawValue = currentValue as double;
    } else {
      rawValue = sliderMin!;
    }

    final range = sliderMax! - sliderMin!;
    final normalizedValue = range > 0
        ? ((rawValue - sliderMin!) / range).clamp(0.0, 1.0)
        : 0.0;

    final sliderValueNotifier = ValueNotifier<double>(normalizedValue);

    showDialog(
      context: context,
      builder: (dialogContext) {
        return Center(
          child: Material(
            color: bgColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            elevation: 8,
            child: Container(
              constraints: BoxConstraints(
                maxWidth: AppSpacings.scale(360),
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                border: Border.all(
                  color: borderColor,
                  width: AppSpacings.scale(1),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header with live value
                  _buildDialogHeader(
                    dialogContext,
                    isDark,
                    textColor,
                    borderColor,
                    valueIndicator: _buildSliderValueIndicator(
                      sliderValueNotifier,
                      isDark,
                    ),
                  ),
                  // Slider content
                  _ValueSelectorSliderContent(
                    sliderValueNotifier: sliderValueNotifier,
                    themeColor: sliderThemeColor,
                    steps: sliderSteps,
                  ),
                  Divider(
                    height: AppSpacings.scale(1),
                    color: borderColor,
                  ),
                  // Done button
                  Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pLg,
                      vertical: AppSpacings.pMd,
                    ),
                    child: _buildSliderDoneButton(
                      dialogContext,
                      isDark,
                      sliderValueNotifier,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDialogHeader(
    BuildContext context,
    bool isDark,
    Color textColor,
    Color borderColor, {
    Widget? valueIndicator,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pLg,
            right: AppSpacings.pMd,
            top: AppSpacings.pMd,
            bottom: AppSpacings.pMd,
          ),
          child: Row(
            children: [
              Text(
                sheetTitle.toUpperCase(),
                style: TextStyle(
                  color: textColor,
                  fontSize: AppFontSize.large,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (valueIndicator != null) ...[
                AppSpacings.spacingMdHorizontal,
                valueIndicator,
              ],
              const Spacer(),
              _buildDialogCloseButton(context, isDark),
            ],
          ),
        ),
        Divider(
          height: AppSpacings.scale(1),
          color: borderColor,
        ),
      ],
    );
  }

  Widget _buildSliderValueIndicator(
    ValueNotifier<double> sliderValueNotifier,
    bool isDark,
  ) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    String formatSliderValue(double value) {
      if (sliderValueFormatter != null) {
        return sliderValueFormatter!(value);
      }
      final percentage = (value.clamp(0.0, 1.0) * 100).round();
      return '$percentage${sliderUnit ?? ''}';
    }

    return ValueListenableBuilder<double>(
      valueListenable: sliderValueNotifier,
      builder: (context, value, _) {
        return Text(
          formatSliderValue(value),
          style: TextStyle(
            color: secondaryColor,
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w500,
          ),
        );
      },
    );
  }

  Widget _buildDialogCloseButton(BuildContext context, bool isDark) {
    return Theme(
      data: isDark
          ? ThemeData(
              brightness: Brightness.dark,
              filledButtonTheme: AppFilledButtonsDarkThemes.neutral,
            )
          : ThemeData(
              filledButtonTheme: AppFilledButtonsLightThemes.neutral,
            ),
      child: FilledButton(
        onPressed: () {
          HapticFeedback.lightImpact();
          Navigator.pop(context);
        },
        style: FilledButton.styleFrom(
          padding: EdgeInsets.zero,
          minimumSize: Size(AppSpacings.scale(32), AppSpacings.scale(32)),
          maximumSize: Size(AppSpacings.scale(32), AppSpacings.scale(32)),
          shape: const CircleBorder(),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: Icon(
          MdiIcons.close,
          size: AppSpacings.scale(18),
          color: isDark
              ? AppFilledButtonsDarkThemes.neutralForegroundColor
              : AppFilledButtonsLightThemes.neutralForegroundColor,
        ),
      ),
    );
  }

  Widget _buildDoneButton(
    BuildContext context,
    bool isDark,
    ValueNotifier<int> selectedIndexNotifier,
  ) {
    final localizations = AppLocalizations.of(context)!;
    return ValueListenableBuilder<int>(
      valueListenable: selectedIndexNotifier,
      builder: (context, index, _) {
        return SizedBox(
          width: double.infinity,
          child: Theme(
            data: isDark
                ? ThemeData(
                    brightness: Brightness.dark,
                    filledButtonTheme: AppFilledButtonsDarkThemes.primary,
                  )
                : ThemeData(
                    filledButtonTheme: AppFilledButtonsLightThemes.primary,
                  ),
            child: FilledButton(
              onPressed: options.isEmpty || index < 0
                  ? null
                  : () {
                      Navigator.pop(context);
                      onChanged?.call(options[index].value);
                    },
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
        );
      },
    );
  }

  Widget _buildSliderDoneButton(
    BuildContext context,
    bool isDark,
    ValueNotifier<double> sliderValueNotifier,
  ) {
    final localizations = AppLocalizations.of(context)!;
    return SizedBox(
      width: double.infinity,
      child: Theme(
        data: isDark
            ? ThemeData(
                brightness: Brightness.dark,
                filledButtonTheme: AppFilledButtonsDarkThemes.primary,
              )
            : ThemeData(
                filledButtonTheme: AppFilledButtonsLightThemes.primary,
              ),
        child: FilledButton(
          onPressed: () {
            Navigator.pop(context);
            // Denormalize 0.0–1.0 back to sliderMin–sliderMax range
            final normalized = sliderValueNotifier.value;
            final mapped =
                sliderMin! + normalized * (sliderMax! - sliderMin!);
            if (currentValue is int) {
              onChanged?.call(mapped.round() as T);
            } else {
              onChanged?.call(mapped as T);
            }
          },
          style: FilledButton.styleFrom(
            padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
/// When used with [showAppBottomSheet], pass [selectedIndexNotifier] so the
/// Done button in [bottomSection] can read the current selection.
class ValueSelectorSheet<T> extends StatefulWidget {
  /// Currently selected value
  final T? currentValue;

  /// Available options to select from
  final List<ValueOption<T>> options;

  /// Title shown at the top of the sheet
  final String title;

  /// Accent color for selection
  final Color? activeColor;

  /// Callback when selection is confirmed (used when sheet has its own button).
  final ValueChanged<T?>? onConfirm;

  /// Notifier for the selected option index. When provided, the sheet does not
  /// build a Done button; the caller should use [bottomSection] and read from this.
  final ValueNotifier<int>? selectedIndexNotifier;

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
    this.selectedIndexNotifier,
    this.columns = 4,
    this.optionStyle = ValueSelectorOptionStyle.grid,
  });

  @override
  State<ValueSelectorSheet<T>> createState() => _ValueSelectorSheetState<T>();
}

class _ValueSelectorSheetState<T> extends State<ValueSelectorSheet<T>> {
  late int _selectedIndex;

  @override
  void initState() {
    super.initState();
    if (widget.options.isEmpty) {
      _selectedIndex = -1;
    } else {
      final index = widget.options.indexWhere((o) => o.value == widget.currentValue);
      _selectedIndex = index < 0 ? 0 : index.clamp(0, widget.options.length - 1);
    }
    widget.selectedIndexNotifier?.value = _selectedIndex;
  }

  void _setSelectedIndex(int index) {
    setState(() => _selectedIndex = index);
    widget.selectedIndexNotifier?.value = index;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor = widget.activeColor ??
        (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return Padding(
      padding: EdgeInsets.symmetric(
        vertical: AppSpacings.pMd,
        horizontal: AppSpacings.pLg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          // Options Grid or Buttons
          Flexible(
            child: SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              child: LayoutBuilder(
                      builder: (context, constraints) {
                        final spacing = AppSpacings.scale(10);
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
                                      _setSelectedIndex(index);
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
                              onTap: () {
                                HapticFeedback.lightImpact();
                                _setSelectedIndex(index);
                              },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                width: itemWidth,
                                decoration: BoxDecoration(
                                  borderRadius:
                                      BorderRadius.circular(AppBorderRadius.base),
                                  border: Border.all(
                                    color:
                                        isSelected ? effectiveActiveColor : borderColor,
                                    width: AppSpacings.scale(1),
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
                                      width: AppSpacings.scale(1),
                                    ),
                                  ),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    spacing: AppSpacings.pMd,
                                    children: [
                                      if (option.icon != null) ...[
                                        Icon(
                                          option.icon,
                                          color: isSelected
                                              ? effectiveActiveColor
                                              : secondaryColor,
                                          size: AppSpacings.scale(20),
                                        ),
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
          if (widget.selectedIndexNotifier == null) ...[
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
        ],
      ),
    );
  }
}

/// Wraps [SliderWithSteps] for use inside the landscape value selector dialog.
///
/// Keeps [sliderValueNotifier] in sync with the slider position.
class _ValueSelectorSliderContent extends StatefulWidget {
  final ValueNotifier<double> sliderValueNotifier;
  final ThemeColors themeColor;
  final List<String>? steps;

  const _ValueSelectorSliderContent({
    required this.sliderValueNotifier,
    this.themeColor = ThemeColors.primary,
    this.steps,
  });

  @override
  State<_ValueSelectorSliderContent> createState() =>
      _ValueSelectorSliderContentState();
}

class _ValueSelectorSliderContentState
    extends State<_ValueSelectorSliderContent> {
  late double _value;

  @override
  void initState() {
    super.initState();
    _value = widget.sliderValueNotifier.value;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
        vertical: AppSpacings.pMd,
      ),
      child: SliderWithSteps(
        value: _value.clamp(0.0, 1.0),
        themeColor: widget.themeColor,
        steps: widget.steps ?? const ['0%', '25%', '50%', '75%', '100%'],
        onChanged: (value) {
          setState(() => _value = value);
          widget.sliderValueNotifier.value = value;
        },
      ),
    );
  }
}
