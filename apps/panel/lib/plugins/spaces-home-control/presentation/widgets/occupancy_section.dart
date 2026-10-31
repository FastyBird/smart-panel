import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/occupancy.dart';
import 'package:flutter/material.dart';

class OccupancySection extends StatefulWidget {
  const OccupancySection({super.key, required this.spaceId, this.repository});
  final String spaceId;
  final OccupancyRepository? repository;
  @override
  State<OccupancySection> createState() => _OccupancySectionState();
}

class _OccupancySectionState extends State<OccupancySection> {
  late OccupancyRepository _repository;
  OccupancyRegistry? _registry;
  @override
  void initState() {
    super.initState();
    _registry = widget.repository == null ? locator<OccupancyRegistry>() : null;
    _repository = widget.repository ?? _registry!.create();
    _repository.bind(widget.spaceId);
  }

  @override
  void didUpdateWidget(covariant OccupancySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.spaceId != widget.spaceId) _repository.bind(widget.spaceId);
  }

  @override
  void dispose() {
    _registry?.release(_repository);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _repository,
    builder: (context, _) {
      final r = _repository;
      final state = r.state;
      if (r.spaceId != widget.spaceId || (r.fresh && state?.enabled == false)) {
        return const SizedBox.shrink();
      }
      final l = AppLocalizations.of(context)!;
      final status = r.fresh && state?.running == true
          ? state?.status.json
          : null;
      final label = switch (status) {
        'occupied' => l.space_occupancy_occupied,
        'vacant' => l.space_occupancy_vacant,
        _ => l.space_occupancy_unknown,
      };
      return Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l.space_occupancy_title,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            Text(label, key: const ValueKey('occupancy-status')),
            if (r.fresh && state?.manualOverride == true)
              Text(
                l.space_occupancy_manual,
                key: const ValueKey('occupancy-manual'),
              )
            else if (r.fresh && state?.running == true)
              Text(
                l.space_occupancy_automatic,
                key: const ValueKey('occupancy-automatic'),
              ),
          ],
        ),
      );
    },
  );
}
