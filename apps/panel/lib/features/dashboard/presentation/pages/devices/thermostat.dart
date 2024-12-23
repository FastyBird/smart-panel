import 'dart:async';
import 'dart:math';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/state/interaction_manager.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ThermostatDeviceDetailPage extends StatefulWidget {
  final DeviceDataModel device;

  const ThermostatDeviceDetailPage({
    super.key,
    required this.device,
  });

  @override
  State<ThermostatDeviceDetailPage> createState() =>
      _ThermostatDeviceDetailPageState();
}

class _ThermostatDeviceDetailPageState
    extends State<ThermostatDeviceDetailPage> {
  bool _isLocked = false;
  int _thermostatMode = 0;

  Timer? _debounceTimer;

  final Map<int, String> _thermostatModes = {
    0: 'off',
    1: 'heat',
    2: 'cool',
    3: 'auto',
    4: 'manual',
  };

  @override
  void initState() {
    super.initState();

    _isLocked = false;
    _thermostatMode = 0;
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ScreenAppBar(
        title: widget.device.name,
        actions: [
          Padding(
            padding: EdgeInsets.only(
              left: AppSpacings.pSm,
              right: AppSpacings.pSm,
            ),
            child: IconSwitch(
              switchState: !_isLocked,
              iconOn: Icons.lock_open,
              iconOff: Icons.lock,
              onChanged: (value) {
                setState(() {
                  _isLocked = !value;
                });

                if (kDebugMode) {
                  print('Set thermostat lock state to: $_isLocked');
                }

                // TODO: Handle set lock state
              },
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pSm,
          ),
          child: LayoutBuilder(builder: (
            BuildContext context,
            BoxConstraints constraints,
          ) {
            final availableWidth = constraints.maxWidth;
            final availableHeight = constraints.maxHeight;

            return ThermostatDial(
              targetRoomTemperature: 18,
              currentRoomTemperature: 22.5,
              currentRoomHumidity: 40.5,
              tempUnit: '°C',
              minValue: 16,
              maxValue: 30,
              isLocked: _isLocked,
              availableWidth: availableWidth,
              availableHeight: availableHeight,
              onValueChanged: _onValueChanged,
            );
          }),
        ),
      ),
      bottomNavigationBar: IgnorePointer(
        ignoring: _isLocked,
        child: BottomNavigationBar(
          selectedItemColor: Theme.of(context).brightness == Brightness.light
              ? (_isLocked
                  ? AppColorsLight.primaryLight3
                  : AppColorsLight.primary)
              : (_isLocked
                  ? AppColorsDark.primaryLight3
                  : AppColorsDark.primary),
          currentIndex: _thermostatMode,
          onTap: _onModeSelect,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.power_settings_new),
              label: 'Off',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.whatshot),
              label: 'Heat',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.ac_unit),
              label: 'Cool',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.thermostat_auto),
              label: 'Auto',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.touch_app),
              label: 'Manual',
            ),
          ],
        ),
      ),
    );
  }

  void _onValueChanged(double value) {
    if (kDebugMode) {
      print('User adjusting temperature: $value');
    }

    _debounceTimer?.cancel();

    _debounceTimer = Timer(const Duration(milliseconds: 500), () {
      if (kDebugMode) {
        print('Set thermostat temperature to: $value');
      }

      // TODO: Handle set thermostat temperature
    });
  }

  void _onModeSelect(int index) {
    setState(() {
      _thermostatMode = index;
    });

    final identifier = _thermostatModes[index];

    if (kDebugMode) {
      print('Set thermostat mode to: $identifier');
    }

    // TODO: Handle set thermostat mode
  }
}

class ThermostatDial extends StatefulWidget {
  final double targetRoomTemperature;
  final double currentRoomTemperature;
  final double? currentRoomHumidity;
  final double minValue;
  final double maxValue;

  final bool isLocked;

  final String tempUnit;

  final double availableWidth;
  final double availableHeight;

  final ValueChanged<double> onValueChanged;

  const ThermostatDial({
    super.key,
    required this.targetRoomTemperature,
    required this.currentRoomTemperature,
    required this.currentRoomHumidity,
    required this.minValue,
    required this.maxValue,
    required this.isLocked,
    required this.tempUnit,
    required this.availableWidth,
    required this.availableHeight,
    required this.onValueChanged,
  });

  @override
  State<ThermostatDial> createState() => _ThermostatDialState();
}

class _ThermostatDialState extends State<ThermostatDial> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  double targetRoomTemperature = 0;
  double currentRoomTemperature = 0;
  double? currentRoomHumidity = 0;

  String tempUnit = '°C';

  double knobAngle = 0;

  double startAngleDeg = 150;
  double endAngleDeg = 390;

  late double startAngle;
  late double endAngle;

  static const double knobSize = 14.0;
  static const double knobBorder = 3.0;
  static const double trackWidth = 8.0;
  static const double barWidth = 10.0;

  late double trackRadius;
  late Offset trackOffset;

  @override
  void initState() {
    super.initState();

    targetRoomTemperature = widget.targetRoomTemperature;
    currentRoomTemperature = widget.currentRoomTemperature;
    currentRoomHumidity = widget.currentRoomHumidity;

    tempUnit = widget.tempUnit;

    startAngle = startAngleDeg * pi / 180;
    endAngle = endAngleDeg * pi / 180;

    knobAngle = _valueToAngle(targetRoomTemperature);
  }

  @override
  Widget build(BuildContext context) {
    final interactionManager = Provider.of<InteractionManager>(context);

    final double dialWidth = widget.availableWidth;
    final double dialHeight = widget.availableHeight.clamp(0, dialWidth);

    double calculatedTrackRadius = min(dialWidth, dialHeight) / 2;
    double calculatedTrackOffset = _calculateCircleOffset(
      calculatedTrackRadius,
      0,
      _calculateDegreesBetween(startAngleDeg, endAngleDeg),
    );

    if ((calculatedTrackRadius * 2) + calculatedTrackOffset >
        min(dialWidth, dialHeight)) {
      calculatedTrackOffset =
          min(dialWidth, dialHeight) - (calculatedTrackRadius * 2);
    }

    setState(() {
      trackOffset = Offset(
        0,
        calculatedTrackOffset + scaler.scale(barWidth),
      );
      trackRadius = calculatedTrackRadius + calculatedTrackOffset;
    });

    return Center(
      child: SizedBox(
        width: dialWidth,
        height: widget.availableHeight,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (details) => _updateValue(details.globalPosition),
          onPanStart: (_) => interactionManager.startInteraction(),
          onPanUpdate: (details) => _updateValue(details.globalPosition),
          onPanEnd: (_) => interactionManager.stopInteraction(),
          child: CustomPaint(
            size: Size(dialWidth, dialHeight),
            painter: ThermostatDialPainter(
              targetRoomTemperature: targetRoomTemperature,
              minValue: widget.minValue,
              maxValue: widget.maxValue,
              tempUnit: tempUnit,
              barColor: Theme.of(context).brightness == Brightness.light
                  ? (widget.isLocked
                      ? AppTextColorLight.disabled
                      : AppColorsLight.primary)
                  : (widget.isLocked
                      ? AppTextColorDark.placeholder
                      : AppColorsDark.primary),
              barWidth: scaler.scale(barWidth),
              trackColor: Theme.of(context).brightness == Brightness.light
                  ? AppBorderColorLight.light
                  : AppBorderColorDark.light,
              knobColor: AppColors.white,
              knobAngle: knobAngle,
              knobSize: scaler.scale(knobSize),
              knobBorder: scaler.scale(knobBorder),
              startAngle: startAngle,
              endAngle: endAngle,
              trackRadius: trackRadius,
              trackOffset: trackOffset,
              trackWidth: scaler.scale(trackWidth),
              isLightTheme: Theme.of(context).brightness == Brightness.light,
            ),
            child: Center(
              child: ThermostatDialContent(
                currentRoomTemperature: currentRoomTemperature,
                currentRoomHumidity: currentRoomHumidity,
                targetRoomTemperature: targetRoomTemperature,
                tempUnit: tempUnit,
                onIncrease: !widget.isLocked
                    ? () {
                        setState(() {
                          targetRoomTemperature += 0.1;
                          knobAngle =
                              _valueToAngle(targetRoomTemperature + 0.1);
                        });

                        widget.onValueChanged(
                          double.parse(
                            targetRoomTemperature.toStringAsFixed(1),
                          ),
                        );
                      }
                    : null,
                onDecrease: !widget.isLocked
                    ? () {
                        setState(() {
                          targetRoomTemperature -= 0.1;
                          knobAngle =
                              _valueToAngle(targetRoomTemperature - 0.1);
                        });

                        widget.onValueChanged(
                          double.parse(
                            targetRoomTemperature.toStringAsFixed(1),
                          ),
                        );
                      }
                    : null,
                dialWidth: dialWidth,
                dialHeight: dialHeight,
                isLocked: widget.isLocked,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _updateValue(Offset globalPosition) {
    final RenderBox box = context.findRenderObject() as RenderBox;
    final Offset localPosition = box.globalToLocal(globalPosition);

    final Offset center = Offset(
      box.size.width / 2 + trackOffset.dx,
      box.size.height / 2 + trackOffset.dy,
    );
    final double angle = (localPosition - center).direction;

    // Normalize angle to [0, 2π] range
    final double normalizedAngle = (angle + 2 * pi) % (2 * pi);

    // Handle angle clamping
    double clampedAngle;

    if (normalizedAngle >= startAngle && normalizedAngle <= 2 * pi) {
      // Angle is between startAngle and 2π
      clampedAngle = normalizedAngle.clamp(startAngle, 2 * pi);
    } else if (normalizedAngle >= 0 && normalizedAngle <= endAngle % (2 * pi)) {
      // Angle is between 0 and endAngle (wrapped around)
      clampedAngle = normalizedAngle.clamp(0, endAngle % (2 * pi));
    } else {
      // Angle is out of range, could be ignored
      return;

      // Angle is out of range, determine the closer end
      // final double distanceToStart = (normalizedAngle - startAngle).abs(); // Distance to start angle
      // final double distanceToEnd = (normalizedAngle - (endAngle % (2 * pi))).abs(); // Distance to end angle

      // if (distanceToStart < distanceToEnd) {
      //  clampedAngle = startAngle;
      //} else {
      //  clampedAngle = endAngle % (2 * pi); // Wrap around end angle
      //}
    }

    // Calculate the new value based on the clamped angle
    final double angleRange = (endAngle - startAngle) % (2 * pi);
    final double valueRange = widget.maxValue - widget.minValue;
    final double value =
        ((clampedAngle - startAngle + 2 * pi) % (2 * pi) / angleRange) *
                valueRange +
            widget.minValue;

    final double touchDistance = (localPosition - center).distance;

    final double minRadius = trackRadius - (knobSize + knobSize / 2);
    final double maxRadius = trackRadius + (knobSize + knobSize / 2);

    // Check if touch is within slider path
    if (touchDistance < minRadius || touchDistance > maxRadius) {
      // Ignore touch outside the slider path
      return;
    }

    setState(() {
      targetRoomTemperature = value.clamp(widget.minValue, widget.maxValue);
      knobAngle = clampedAngle;
    });

    widget.onValueChanged(
      double.parse(targetRoomTemperature.toStringAsFixed(1)),
    );
  }

  double _valueToAngle(double value) {
    final double valueRange = widget.maxValue - widget.minValue;
    final double angleRange = endAngle - startAngle;

    return ((value - widget.minValue) / valueRange) * angleRange + startAngle;
  }

  double _calculateCircleOffset(
    double radius,
    double startAngleDeg,
    double endAngleDeg,
  ) {
    double startAngleRad = startAngleDeg * pi / 180;
    double endAngleRad = endAngleDeg * pi / 180;

    // Calculate the y-coordinates of the points
    double yStart = radius * sin(startAngleRad);
    double yEnd = radius * sin(endAngleRad);

    // Calculate and return the height
    return radius - (yEnd - yStart).abs();
  }

  double _calculateDegreesBetween(double startAngleDeg, double endAngleDeg) {
    double degreesBetween = (endAngleDeg - startAngleDeg) % 360;

    if (degreesBetween < 0) {
      degreesBetween += 360; // Wrap negative to positive
    }

    // Shortest path: use 360 - degreesBetween if the other side is shorter
    return degreesBetween > 180 ? 360 - degreesBetween : degreesBetween;
  }
}

class ThermostatDialPainter extends CustomPainter {
  final double targetRoomTemperature;
  final double minValue;
  final double maxValue;
  final String tempUnit;
  final double knobAngle;
  final Color trackColor;
  final double trackRadius;
  final Offset trackOffset;
  final double trackWidth;
  final Color barColor;
  final double barWidth;
  final Color knobColor;
  final double knobSize;
  final double knobBorder;
  final double startAngle;
  final double endAngle;
  final bool isLightTheme;

  ThermostatDialPainter({
    required this.targetRoomTemperature,
    required this.minValue,
    required this.maxValue,
    required this.tempUnit,
    required this.knobAngle,
    required this.trackColor,
    required this.trackRadius,
    required this.trackOffset,
    required this.trackWidth,
    required this.barColor,
    required this.barWidth,
    required this.knobColor,
    required this.knobSize,
    required this.knobBorder,
    required this.startAngle,
    required this.endAngle,
    required this.isLightTheme,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(
      size.width / 2 + trackOffset.dx,
      size.height / 2 + trackOffset.dy,
    );

    // Draw background circle
    final backgroundPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = trackWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: trackRadius),
      startAngle,
      endAngle - startAngle,
      false,
      backgroundPaint,
    );

    // Calculate sweep angle based on current value
    final double sliderSweepAngle = (targetRoomTemperature - minValue) /
        (maxValue - minValue) *
        (endAngle - startAngle);

    final sliderPaint = Paint()
      ..color = barColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = barWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: trackRadius),
      startAngle,
      sliderSweepAngle,
      false,
      sliderPaint,
    );

    // Draw knob
    final knobBorderPaint = Paint()
      ..color = barColor // Border color
      ..style = PaintingStyle.stroke
      ..strokeWidth = knobBorder; // Border width

    final knobPaint = Paint()
      ..color = knobColor
      ..style = PaintingStyle.fill;

    final Offset knobPosition = Offset(
      center.dx + trackRadius * cos(knobAngle),
      center.dy + trackRadius * sin(knobAngle),
    );

    // Draw the border (outer circle)
    canvas.drawCircle(knobPosition, knobSize, knobBorderPaint);

    // Draw the fill (inner circle)
    canvas.drawCircle(
      knobPosition,
      knobSize - knobBorder / 2,
      knobPaint,
    );

    // Draw min and max labels
    _drawLabel(
      canvas,
      center,
      trackRadius,
      startAngle,
      minValue.toStringAsFixed(1),
    );
    _drawLabel(
      canvas,
      center,
      trackRadius,
      endAngle,
      maxValue.toStringAsFixed(1),
    );
  }

  void _drawLabel(
    Canvas canvas,
    Offset center,
    double radius,
    double angle,
    String text,
  ) {
    final x = center.dx + radius * cos(angle);
    final y = center.dy + radius * sin(angle);

    final textPainter = TextPainter(
      text: TextSpan(
        text: '$text$tempUnit',
        style: TextStyle(
          color: isLightTheme
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          fontSize: AppFontSize.extraSmall,
          fontWeight: FontWeight.w400,
        ),
      ),
      textDirection: TextDirection.ltr,
    );

    textPainter.layout();

    if (x < center.dx) {
      final offset = Offset(
        x,
        (y - textPainter.height / 2) + AppFontSize.extraSmall + AppSpacings.pSm,
      );

      textPainter.paint(canvas, offset);
    } else {
      final offset = Offset(
        x - textPainter.width,
        (y - textPainter.height / 2) + AppFontSize.extraSmall + AppSpacings.pSm,
      );

      textPainter.paint(canvas, offset);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class ThermostatDialContent extends StatelessWidget {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  final double currentRoomTemperature;
  final double targetRoomTemperature;
  final double? currentRoomHumidity;
  final VoidCallback? onIncrease;
  final VoidCallback? onDecrease;
  final double dialWidth;
  final double dialHeight;
  final String tempUnit;
  final bool isLocked;

  ThermostatDialContent({
    super.key,
    required this.currentRoomTemperature,
    required this.targetRoomTemperature,
    required this.currentRoomHumidity,
    required this.onIncrease,
    required this.onDecrease,
    required this.dialWidth,
    required this.dialHeight,
    required this.tempUnit,
    required this.isLocked,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        LayoutBuilder(builder: (
          BuildContext context,
          BoxConstraints constraints,
        ) {
          List<Widget> children = [];

          children.addAll([
            Icon(
              Icons.device_thermostat,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
              size: AppFontSize.base,
            ),
            AppSpacings.spacingXsHorizontal,
            Text(
              '${currentRoomTemperature.toStringAsFixed(1)}$tempUnit',
              style: TextStyle(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
                fontSize: AppFontSize.base,
                fontWeight: FontWeight.w400,
              ),
            ),
          ]);

          if (currentRoomHumidity != null) {
            children.addAll([
              AppSpacings.spacingMdHorizontal,
              Icon(
                Icons.water_drop,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
                size: AppFontSize.base,
              ),
              AppSpacings.spacingXsHorizontal,
              Text(
                '${currentRoomHumidity!.toStringAsFixed(1)}%',
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ]);
          }

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: children,
          );
        }),

        AppSpacings.spacingXsVertical,

        // Set Temperature
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Decrease Button
            _buildButton(context, Icons.remove, onDecrease, isLocked),

            SizedBox(
              width: scaler.scale(120),
              // Constrain the width of the content
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Main Temperature
                  Text(
                    targetRoomTemperature.toStringAsFixed(1).split('.')[0],
                    style: TextStyle(
                      fontFamily: 'DIN1451',
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.primary
                          : AppTextColorDark.primary,
                      fontSize: scaler.scale(80),
                    ),
                  ),

                  SizedBox(
                    height: scaler.scale(80 - 8),
                    // Match the height of the main temperature text
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          tempUnit,
                          style: TextStyle(
                            fontFamily: 'DIN1451',
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.primary
                                    : AppTextColorDark.primary,
                            fontSize: scaler.scale(16),
                          ),
                        ),
                        Text(
                          '.${targetRoomTemperature.toStringAsFixed(1).split('.')[1]}',
                          style: TextStyle(
                            fontFamily: 'DIN1451',
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.primary
                                    : AppTextColorDark.primary,
                            fontSize: scaler.scale(26),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Increase Button
            _buildButton(context, Icons.add, onIncrease, isLocked),
          ],
        ),
      ],
    );
  }

  Widget _buildButton(
    BuildContext context,
    IconData icon,
    VoidCallback? onPressed,
    bool isLocked,
  ) {
    return Theme(
      data: ThemeData(
        iconButtonTheme: Theme.of(context).brightness == Brightness.light
            ? AppIconButtonsLightThemes.info
            : AppIconButtonsDarkThemes.info,
      ),
      child: IconButton(
        icon: Icon(
          icon,
          size: scaler.scale(14),
        ),
        style: ButtonStyle(
          padding: WidgetStateProperty.all(AppSpacings.paddingMd),
        ),
        onPressed: isLocked ? null : onPressed,
      ),
    );
  }
}
