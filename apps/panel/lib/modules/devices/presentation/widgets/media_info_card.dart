import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_card.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaInfoCard extends StatelessWidget {
	final IconData icon;
	final String name;
	final bool isOn;
	final String? displaySource;
	final ThemeColors themeColor;

	/// Whether the card should expand to fill available height
	final bool expanded;

	/// Optional source selector parameters (for landscape inline source select)
	final List<String>? availableSources;
	final String? currentSource;
	final String Function(String)? sourceLabel;
	final ValueChanged<String>? onSourceChanged;
	final bool sourceEnabled;

	const MediaInfoCard({
		super.key,
		required this.icon,
		required this.name,
		required this.isOn,
		this.displaySource,
		this.themeColor = ThemeColors.primary,
		this.expanded = false,
		this.availableSources,
		this.currentSource,
		this.sourceLabel,
		this.onSourceChanged,
		this.sourceEnabled = true,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final iconContainer = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			themeColor,
		).iconContainer;

		final hasSourceSelector = availableSources != null &&
			availableSources!.isNotEmpty &&
			sourceLabel != null &&
			onSourceChanged != null;

		return AppCard(
			width: double.infinity,
			expanded: expanded,
			child: Column(
				mainAxisAlignment: expanded ? MainAxisAlignment.center : MainAxisAlignment.start,
				spacing: AppSpacings.pMd,
				children: [
					Container(
						width: AppSpacings.scale(64),
						height: AppSpacings.scale(64),
						decoration: BoxDecoration(
							color: iconContainer.backgroundColor,
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
						child: Icon(
							icon,
							color: iconContainer.iconColor,
							size: AppSpacings.scale(32),
						),
					),
					Text(
						name,
						style: TextStyle(
							fontSize: AppFontSize.base,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					Row(
						mainAxisAlignment: MainAxisAlignment.center,
						mainAxisSize: MainAxisSize.min,
						spacing: AppSpacings.pSm,
						children: [
							Container(
								width: AppSpacings.scale(8),
								height: AppSpacings.scale(8),
								decoration: BoxDecoration(
									color: isOn
										? (isDark ? AppColorsDark.success : AppColorsLight.success)
										: secondaryColor,
									shape: BoxShape.circle,
								),
							),
							Text(
								isOn ? localizations.on_state_on : localizations.on_state_off,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									color: secondaryColor,
								),
							),
							if (displaySource != null && !hasSourceSelector) ...[
								Padding(
									padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm),
									child: Text(
										'·',
										style: TextStyle(
											fontSize: AppFontSize.extraSmall,
											fontWeight: FontWeight.bold,
											color: secondaryColor,
										),
									),
								),
								Text(
									displaySource!,
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										color: secondaryColor,
									),
								),
							],
						],
					),
					if (hasSourceSelector)
						ModeSelector<String>(
							modes: availableSources!
								.map((s) => ModeOption<String>(
									value: s,
									icon: MdiIcons.videoInputHdmi,
									label: sourceLabel!(s),
								))
								.toList(),
							selectedValue: currentSource,
							onChanged: sourceEnabled ? onSourceChanged! : (_) {},
							orientation: ModeSelectorOrientation.horizontal,
							color: themeColor,
							showIcon: false,
							scrollable: true,
						),
				],
			),
		);
	}
}
