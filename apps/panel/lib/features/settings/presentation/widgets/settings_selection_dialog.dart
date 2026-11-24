import 'package:fastybird_smart_panel/core/widgets/app_dialog.dart';
import 'package:flutter/material.dart';

export 'package:fastybird_smart_panel/core/widgets/app_dialog.dart'
    show SelectionOption;

/// Shows the selection dialog ([showAppSelectionDialog]): a tap selects and
/// closes, with no buttons. When options have [SelectionOption.group] set,
/// they are rendered under group headings.
///
/// Returns the selected value, or null if dismissed.
Future<T?> showSettingsSelectionDialog<T>({
  required BuildContext context,
  required String title,
  required List<SelectionOption<T>> options,
  T? currentValue,
}) => showAppSelectionDialog<T>(
  context: context,
  title: title,
  options: options,
  currentValue: currentValue,
);
