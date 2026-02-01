import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaSourceCard extends StatelessWidget {
	final String? currentSource;
	final List<String> availableSources;
	final bool isEnabled;
	final String Function(String) sourceLabel;
	final ValueChanged<String> onSourceChanged;
	final double Function(double) scale;
	final Color? accentColor;

	const MediaSourceCard({
		super.key,
		this.currentSource,
		required this.availableSources,
		required this.isEnabled,
		required this.sourceLabel,
		required this.onSourceChanged,
		required this.scale,
		this.accentColor,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.round),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							Icon(MdiIcons.videoInputHdmi, size: AppFontSize.small, color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
							AppSpacings.spacingSmHorizontal,
							Text(
								localizations.media_detail_input.toUpperCase(),
								style: TextStyle(fontSize: AppFontSize.small, fontWeight: FontWeight.bold, color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
							),
						],
					),
					AppSpacings.spacingMdVertical,
					ModeSelector<String>(
						modes: availableSources
							.map((s) => ModeOption<String>(
								value: s,
								icon: MdiIcons.videoInputHdmi,
								label: sourceLabel(s),
							))
							.toList(),
						selectedValue: currentSource,
						onChanged: isEnabled ? onSourceChanged : (_) {},
						orientation: ModeSelectorOrientation.horizontal,
						color: ModeSelectorColor.info,
						showIcon: false,
						scrollable: true,
					),
				],
			),
		);
	}
}
