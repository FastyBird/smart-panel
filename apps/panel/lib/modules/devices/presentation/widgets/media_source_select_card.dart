import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaSourceSelectCard extends StatelessWidget {
	final List<String> availableSources;
	final String? currentSource;
	final String Function(String) sourceLabel;
	final ValueChanged<String> onSourceChanged;
	final bool isEnabled;
	final ThemeColors themeColor;

	const MediaSourceSelectCard({
		super.key,
		required this.availableSources,
		required this.currentSource,
		required this.sourceLabel,
		required this.onSourceChanged,
		required this.isEnabled,
		this.themeColor = ThemeColors.primary,
	});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			spacing: AppSpacings.pMd,
			children: [
				SectionTitle(
					title: localizations.media_detail_section_source,
					icon: MdiIcons.videoInputHdmi,
				),
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
					color: themeColor,
					showIcon: false,
					scrollable: true,
				),
			],
		);
	}
}
