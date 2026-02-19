import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Responsive two-column layout for settings sub-screens in landscape mode.
///
/// When there are 2 or fewer cards, displays them side by side.
/// When there are more, the first two share a row and the rest stack full-width.
class SettingsTwoColumnLayout extends StatelessWidget {
	final List<Widget> cards;

	const SettingsTwoColumnLayout({
		super.key,
		required this.cards,
	});

	@override
	Widget build(BuildContext context) {
		if (cards.length <= 2) {
			return Row(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					for (int i = 0; i < cards.length; i++) ...[
						if (i > 0) SizedBox(width: AppSpacings.pMd),
						Expanded(child: cards[i]),
					],
				],
			);
		}

		return ConstrainedBox(
			constraints: BoxConstraints(maxWidth: AppSpacings.scale(640)),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				mainAxisSize: MainAxisSize.min,
				children: [
					Row(
						crossAxisAlignment: CrossAxisAlignment.start,
						children: [
							Expanded(child: cards[0]),
							SizedBox(width: AppSpacings.pMd),
							Expanded(child: cards[1]),
						],
					),
					for (int i = 2; i < cards.length; i++) ...[
						SizedBox(height: AppSpacings.pMd),
						cards[i],
					],
				],
			),
		);
	}
}
