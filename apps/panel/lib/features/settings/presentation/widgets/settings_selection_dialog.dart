import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A selection option for [showSettingsSelectionDialog].
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

/// Shows a modal dialog with a list of tappable options.
///
/// When options have [SelectionOption.group] set, they are rendered
/// under group headings.
///
/// Returns the selected value, or null if dismissed.
Future<T?> showSettingsSelectionDialog<T>({
	required BuildContext context,
	required String title,
	required List<SelectionOption<T>> options,
	T? currentValue,
}) {
	return showDialog<T>(
		context: context,
		builder: (context) {
			final isDark = Theme.of(context).brightness == Brightness.dark;

			final bgColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
			final borderColor = isDark ? AppFillColorDark.light : AppBorderColorLight.light;
			final titleColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
			final textColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
			final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
			final dividerColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
			final groupColor = isDark ? AppColorsDark.info : AppColorsLight.info;

			// Build list items — flat or grouped
			final hasGroups = options.any((o) => o.group != null);
			final List<Widget> items = [];

			if (hasGroups) {
				// Preserve insertion order by collecting groups as we encounter them
				final groupOrder = <String>[];
				final grouped = <String, List<SelectionOption<T>>>{};

				for (final option in options) {
					final key = option.group ?? '';
					if (!grouped.containsKey(key)) {
						groupOrder.add(key);
						grouped[key] = [];
					}
					grouped[key]!.add(option);
				}

				for (int gi = 0; gi < groupOrder.length; gi++) {
					final groupName = groupOrder[gi];
					final groupOptions = grouped[groupName]!;

					if (gi > 0) {
						items.add(Divider(height: 1, color: dividerColor));
					}

					// Group heading
					if (groupName.isNotEmpty) {
						items.add(
							Padding(
								padding: EdgeInsets.only(
									left: AppSpacings.pLg,
									right: AppSpacings.pLg,
									top: AppSpacings.pMd,
									bottom: AppSpacings.pXs,
								),
								child: Text(
									groupName.toUpperCase(),
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										fontWeight: FontWeight.w600,
										color: groupColor,
										letterSpacing: 0.8,
									),
								),
							),
						);
					}

					// Group options (indented when under a group heading)
					final indented = groupName.isNotEmpty;
					for (int i = 0; i < groupOptions.length; i++) {
						final option = groupOptions[i];
						items.add(
							_SelectionItem<T>(
								option: option,
								isSelected: option.value == currentValue,
								accentColor: accentColor,
								textColor: textColor,
								indented: indented,
								onTap: () {
									HapticFeedback.lightImpact();
									Navigator.of(context).pop(option.value);
								},
							),
						);
						if (i < groupOptions.length - 1) {
							items.add(Divider(
								height: 1,
								color: dividerColor,
								indent: indented ? AppSpacings.pLg + AppSpacings.pMd : AppSpacings.pLg,
								endIndent: AppSpacings.pLg,
							));
						}
					}
				}
			} else {
				// Flat list
				for (int i = 0; i < options.length; i++) {
					items.add(
						_SelectionItem<T>(
							option: options[i],
							isSelected: options[i].value == currentValue,
							accentColor: accentColor,
							textColor: textColor,
							onTap: () {
								HapticFeedback.lightImpact();
								Navigator.of(context).pop(options[i].value);
							},
						),
					);
					if (i < options.length - 1) {
						items.add(Divider(
							height: 1,
							color: dividerColor,
							indent: AppSpacings.pLg,
							endIndent: AppSpacings.pLg,
						));
					}
				}
			}

			return Dialog(
				backgroundColor: bgColor,
				shape: RoundedRectangleBorder(
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					side: BorderSide(color: borderColor),
				),
				child: ConstrainedBox(
					constraints: BoxConstraints(
						maxWidth: AppSpacings.scale(280),
						maxHeight: MediaQuery.of(context).size.height * 0.7,
					),
					child: Column(
						mainAxisSize: MainAxisSize.min,
						crossAxisAlignment: CrossAxisAlignment.stretch,
						children: [
							// Title
							Padding(
								padding: EdgeInsets.symmetric(
									horizontal: AppSpacings.pLg,
									vertical: AppSpacings.pMd,
								),
								child: Text(
									title,
									style: TextStyle(
										fontSize: AppFontSize.base,
										fontWeight: FontWeight.w600,
										color: titleColor,
									),
								),
							),
							Divider(height: 1, color: dividerColor),
							// Options
							Flexible(
								child: SingleChildScrollView(
									child: Column(
										mainAxisSize: MainAxisSize.min,
										crossAxisAlignment: CrossAxisAlignment.stretch,
										children: items,
									),
								),
							),
						],
					),
				),
			);
		},
	);
}

class _SelectionItem<T> extends StatelessWidget {
	final SelectionOption<T> option;
	final bool isSelected;
	final Color accentColor;
	final Color textColor;
	final bool indented;
	final VoidCallback onTap;

	const _SelectionItem({
		required this.option,
		required this.isSelected,
		required this.accentColor,
		required this.textColor,
		this.indented = false,
		required this.onTap,
	});

	@override
	Widget build(BuildContext context) {
		return InkWell(
			onTap: onTap,
			child: Padding(
				padding: EdgeInsets.only(
					left: indented ? AppSpacings.pLg + AppSpacings.pMd : AppSpacings.pLg,
					right: AppSpacings.pLg,
					top: AppSpacings.pMd,
					bottom: AppSpacings.pMd,
				),
				child: Row(
					children: [
						Expanded(
							child: Text(
								option.label,
								style: TextStyle(
									fontSize: AppFontSize.small,
									fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
									color: isSelected ? accentColor : textColor,
								),
							),
						),
						if (isSelected)
							Icon(
								Icons.check,
								size: AppFontSize.large,
								color: accentColor,
							),
					],
				),
			),
		);
	}
}
