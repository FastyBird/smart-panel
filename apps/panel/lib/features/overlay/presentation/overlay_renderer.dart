import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';

/// Renders active overlays from the [OverlayManager] as a Stack layer.
///
/// Place this widget as a child in the main app Stack. It listens to
/// the [OverlayManager] and renders all active overlays sorted by priority,
/// with appropriate positioning based on their [OverlayDisplayType].
///
/// Closable overlays get a dismiss tap on the background area.
class OverlayRenderer extends StatelessWidget {
	const OverlayRenderer({super.key});

	@override
	Widget build(BuildContext context) {
		return Consumer<OverlayManager>(
			builder: (context, manager, _) {
				final active = manager.activeEntries;

				if (active.isEmpty) {
					return const SizedBox.shrink();
				}

				final children = <Widget>[];

				for (final entry in active) {
					switch (entry.displayType) {
						case OverlayDisplayType.banner:
							children.add(
								Positioned(
									top: 0,
									left: 0,
									right: 0,
									child: KeyedSubtree(
										key: ValueKey(entry.id),
										child: entry.builder(context),
									),
								),
							);
							break;

						case OverlayDisplayType.overlay:
						case OverlayDisplayType.fullScreen:
							Widget content = KeyedSubtree(
								key: ValueKey(entry.id),
								child: entry.builder(context),
							);

							if (entry.closable) {
								content = GestureDetector(
									onTap: () => manager.hide(entry.id),
									behavior: HitTestBehavior.opaque,
									child: content,
								);
							}

							children.add(
								Positioned.fill(child: content),
							);
							break;
					}
				}

				return Stack(children: children);
			},
		);
	}
}
