import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/activity_modes_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/mode_schedule_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/occupancy_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/activity_modes.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/mode_schedule.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/occupancy.dart';
import 'package:flutter/material.dart';

/// The room gives this stack a loose flex constraint, so enlarged labels scroll
/// instead of pushing the domain grid outside the room viewport.
class SpaceModeSections extends StatelessWidget {
  const SpaceModeSections({super.key, required this.spaceId});
  final String spaceId;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (locator.isRegistered<ActivityModesRegistry>())
          ActivityModesSection(spaceId: spaceId),
        if (locator.isRegistered<ModeScheduleRegistry>())
          ModeScheduleSection(spaceId: spaceId),
        if (locator.isRegistered<OccupancyRegistry>())
          OccupancySection(spaceId: spaceId),
      ],
    ),
  );
}
