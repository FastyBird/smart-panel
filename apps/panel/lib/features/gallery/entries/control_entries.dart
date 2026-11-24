import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/app_stepper.dart';
import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/intent_mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_slider.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_popup.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// DR-7: the slider, switch, stepper, segmented control, mode chip and
/// popup, and the thermostat dial.
const List<GalleryEntry> controlEntries = [
  GalleryEntry(
    title: 'Slider: accent, domain, gradient; pending, not confirmed, disabled',
    builder: _sliders,
  ),
  GalleryEntry(title: 'Hero slider', builder: _heroSlider),
  GalleryEntry(title: 'Card slider and settings slider', builder: _cardSliders),
  GalleryEntry(
    title: 'Switch: off, on, domain; pending, not confirmed, disabled',
    builder: _switches,
  ),
  GalleryEntry(
    title: 'Stepper: idle, pending, not confirmed, disabled',
    builder: _steppers,
  ),
  GalleryEntry(
    title: 'Segmented control: accent, domain, icons only; states',
    builder: _segments,
  ),
  GalleryEntry(title: 'Intent mode selector', builder: _intentModes),
  GalleryEntry(title: 'Mode chip and popup', builder: _modeChip),
  GalleryEntry(title: 'Value row', builder: _valueRow),
  GalleryEntry(
    title: 'Thermostat dial: heating, cooling, two thumbs, off, pending',
    builder: _dials,
  ),
];

ScreenSizeClass _class(BuildContext context) =>
    GalleryScope.of(context).sizeClass;

Widget _label(BuildContext context, String text) => Text(
  text,
  style: TextStyle(
    fontSize: AppFontSize.extraSmall,
    color: Theme.of(context).neutrals.textSecondary,
  ),
);

/// A labelled sample in a fixed width.
Widget _sample(BuildContext context, String label, Widget child, {double width = 220}) =>
    SizedBox(
      width: AppSpacings.scale(width),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pSm,
        children: [_label(context, label), child],
      ),
    );

Widget _wrap(List<Widget> children) => Wrap(
  spacing: AppSpacings.pLg,
  runSpacing: AppSpacings.pMd,
  children: children,
);

Widget _sliders(BuildContext context) => _wrap([
  _sample(context, 'Accent', const _DemoSlider(value: 0.6)),
  _sample(
    context,
    'Lights domain',
    const _DemoSlider(value: 0.5, color: ThemeColors.lights),
  ),
  _sample(
    context,
    'Colour temperature',
    _DemoSlider(
      value: 0.35,
      color: ThemeColors.lights,
      gradient: AppSliderGallery.colourTemperature,
    ),
  ),
  _sample(
    context,
    'Pending',
    const _DemoSlider(value: 0.5, state: ControlState.pending),
  ),
  _sample(
    context,
    'Not confirmed',
    const _DemoSlider(value: 0.5, state: ControlState.unconfirmed),
  ),
  _sample(
    context,
    'Disabled',
    const _DemoSlider(value: 0.5, state: ControlState.disabled),
  ),
]);

/// Sample gradients for the gallery.
class AppSliderGallery {
  AppSliderGallery._();

  /// Warm to cool white (design canvas, "Domain views").
  static List<Color> get colourTemperature => [
    HSLColor.fromAHSL(1, 32, 1, 0.68).toColor(),
    HSLColor.fromAHSL(1, 36, 1, 0.93).toColor(),
    HSLColor.fromAHSL(1, 214, 1, 0.9).toColor(),
  ];
}

Widget _heroSlider(BuildContext context) => _sample(
  context,
  'Shading domain, ${_class(context).name}',
  _DemoSlider(
    value: 0.4,
    color: ThemeColors.shading,
    hero: true,
    sizeClass: _class(context),
  ),
  width: 320,
);

Widget _cardSliders(BuildContext context) => _wrap([
  SizedBox(
    width: AppSpacings.scale(260),
    child: const _DemoCardSlider(),
  ),
  _sample(
    context,
    'Settings',
    const _DemoSettingsSlider(),
    width: 260,
  ),
]);

Widget _switches(BuildContext context) => _wrap([
  _sample(context, 'Off', const _DemoSwitch(value: false), width: 90),
  _sample(context, 'On', const _DemoSwitch(value: true), width: 90),
  _sample(
    context,
    'Climate',
    const _DemoSwitch(value: true, color: ThemeColors.climate),
    width: 90,
  ),
  _sample(
    context,
    'Pending',
    const _DemoSwitch(value: true, state: ControlState.pending),
    width: 90,
  ),
  _sample(
    context,
    'Not confirmed',
    const _DemoSwitch(value: true, state: ControlState.unconfirmed),
    width: 90,
  ),
  _sample(
    context,
    'Disabled on',
    const _DemoSwitch(value: true, state: ControlState.disabled),
    width: 90,
  ),
  _sample(
    context,
    'Disabled off',
    const _DemoSwitch(value: false, state: ControlState.disabled),
    width: 90,
  ),
]);

Widget _steppers(BuildContext context) => _wrap([
  for (final (label, state) in const [
    ('Idle', ControlState.idle),
    ('Pending', ControlState.pending),
    ('Not confirmed', ControlState.unconfirmed),
    ('Disabled', ControlState.disabled),
  ])
    _sample(
      context,
      label,
      _DemoStepper(state: state, sizeClass: _class(context)),
      width: 240,
    ),
]);

List<ModeOption<String>> _modes() => [
  ModeOption(value: 'heat', icon: MdiIcons.fire, label: 'Heat'),
  ModeOption(value: 'cool', icon: MdiIcons.snowflake, label: 'Cool'),
  ModeOption(value: 'auto', icon: MdiIcons.thermostatAuto, label: 'Auto'),
  ModeOption(value: 'off', icon: MdiIcons.power, label: 'Off'),
];

Widget _segments(BuildContext context) => Column(
  crossAxisAlignment: CrossAxisAlignment.start,
  spacing: AppSpacings.pMd,
  children: [
    _sample(context, 'Accent', const _DemoSegments(), width: 360),
    _sample(
      context,
      'Climate domain',
      const _DemoSegments(color: ThemeColors.climate),
      width: 360,
    ),
    _sample(
      context,
      'Icons only (narrow)',
      const _DemoSegments(),
      width: 200,
    ),
    _sample(
      context,
      'Pending',
      const _DemoSegments(state: ControlState.pending),
      width: 360,
    ),
    _sample(
      context,
      'Not confirmed',
      const _DemoSegments(state: ControlState.unconfirmed),
      width: 360,
    ),
    _sample(
      context,
      'Disabled',
      const _DemoSegments(state: ControlState.disabled),
      width: 360,
    ),
  ],
);

Widget _intentModes(BuildContext context) => _sample(
  context,
  'Active Heat, last intent Off',
  IntentModeSelector<String>(
    modes: _modes(),
    activeValue: 'heat',
    lastIntentValue: 'off',
    color: ThemeColors.lights,
    onChanged: (_) {},
  ),
  width: 360,
);

Widget _modeChip(BuildContext context) {
  final sizeClass = _class(context);
  final config = BottomNavModeConfig(
    icon: MdiIcons.weatherNight,
    label: 'Relax',
    title: 'Lights mode',
    color: ThemeColors.lights,
    popupBuilder: (context, dismiss) => const SizedBox.shrink(),
  );

  // A Wrap, so the popup drops under the chip on the narrow Compact canvas.
  return Wrap(
    spacing: AppSpacings.pLg,
    runSpacing: AppSpacings.pLg,
    children: [
      DeckModeChipButton(config: config, onTap: (_) {}, sizeClass: sizeClass),
      DeckModePopupFrame(
        title: 'Lights mode',
        sizeClass: sizeClass,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: AppSpacings.scale(DeckModePopupMetrics.gap),
          children: [
            for (final (icon, label, selected) in [
              (MdiIcons.power, 'Off', false),
              (MdiIcons.briefcaseOutline, 'Work', false),
              (MdiIcons.sofaOutline, 'Relax', true),
              (MdiIcons.weatherNight, 'Night', false),
            ])
              DeckModePopupOption(
                icon: icon,
                label: label,
                isSelected: selected,
                color: ThemeColors.lights,
                sizeClass: sizeClass,
                onTap: () {},
              ),
          ],
        ),
      ),
    ],
  );
}

Widget _valueRow(BuildContext context) => SizedBox(
  width: AppSpacings.scale(320),
  child: Column(
    spacing: AppSpacings.pMd,
    children: [
      ValueSelectorRow<int>(
        currentValue: 2,
        options: const [
          ValueOption(value: 1, label: 'Low'),
          ValueOption(value: 2, label: 'Medium'),
          ValueOption(value: 3, label: 'High'),
        ],
        label: 'Fan speed',
        icon: MdiIcons.fan,
        sheetTitle: 'Fan speed',
        onChanged: (_) {},
      ),
      ValueSelectorRow<int>(
        currentValue: 2,
        options: const [ValueOption(value: 2, label: 'Medium')],
        label: 'Fan speed (disabled)',
        icon: MdiIcons.fan,
        sheetTitle: 'Fan speed',
      ),
    ],
  ),
);

Widget _dials(BuildContext context) {
  final sizeClass = _class(context);
  final size = AppSpacings.scale(200);

  Widget dial(String label, Widget child) =>
      _sample(context, label, child, width: 200);

  return _wrap([
    dial(
      'Heating',
      CircularControlDial(
        value: 22,
        currentValue: 21.4,
        minValue: 10,
        maxValue: 30,
        step: 0.5,
        size: size,
        accentType: DialAccentColor.warning,
        modeLabel: 'Heating',
        displayFormat: DialDisplayFormat.temperature,
        temperatureUnitSymbol: '°',
        sizeClass: sizeClass,
        onChanged: (_) {},
      ),
    ),
    dial(
      'Cooling',
      CircularControlDial(
        value: 24,
        currentValue: 26.2,
        minValue: 10,
        maxValue: 30,
        step: 0.5,
        size: size,
        accentType: DialAccentColor.info,
        modeLabel: 'Cooling',
        displayFormat: DialDisplayFormat.temperature,
        temperatureUnitSymbol: '°',
        sizeClass: sizeClass,
        onChanged: (_) {},
      ),
    ),
    dial(
      'Auto, two thumbs',
      CircularControlDial(
        value: 20,
        secondValue: 24,
        currentValue: 21.4,
        minValue: 10,
        maxValue: 30,
        step: 0.5,
        size: size,
        accentType: DialAccentColor.warning,
        modeLabel: 'Idle',
        displayFormat: DialDisplayFormat.temperature,
        temperatureUnitSymbol: '°',
        sizeClass: sizeClass,
        onChanged: (_) {},
        onSecondChanged: (_) {},
      ),
    ),
    dial(
      'Off',
      CircularControlDial(
        value: 22,
        currentValue: 21.4,
        minValue: 10,
        maxValue: 30,
        step: 0.5,
        size: size,
        accentType: DialAccentColor.warning,
        isActive: false,
        enabled: false,
        modeLabel: 'Off',
        displayFormat: DialDisplayFormat.temperature,
        temperatureUnitSymbol: '°',
        sizeClass: sizeClass,
      ),
    ),
    dial(
      'Pending',
      CircularControlDial(
        value: 22.5,
        currentValue: 21.4,
        minValue: 10,
        maxValue: 30,
        step: 0.5,
        size: size,
        accentType: DialAccentColor.warning,
        modeLabel: 'Setting',
        displayFormat: DialDisplayFormat.temperature,
        temperatureUnitSymbol: '°',
        state: ControlState.pending,
        sizeClass: sizeClass,
        onChanged: (_) {},
      ),
    ),
  ]);
}

class _DemoSlider extends StatefulWidget {
  const _DemoSlider({
    required this.value,
    this.color,
    this.gradient,
    this.state = ControlState.idle,
    this.hero = false,
    this.sizeClass,
  });

  final double value;
  final ThemeColors? color;
  final List<Color>? gradient;
  final ControlState state;
  final bool hero;
  final ScreenSizeClass? sizeClass;

  @override
  State<_DemoSlider> createState() => _DemoSliderState();
}

class _DemoSliderState extends State<_DemoSlider> {
  late double _value = widget.value;

  @override
  Widget build(BuildContext context) => AppSlider(
    value: _value,
    color: widget.color,
    trackGradient: widget.gradient,
    state: widget.state,
    hero: widget.hero,
    sizeClass: widget.sizeClass,
    semanticLabel: 'Brightness',
    onChanged: (value) => setState(() => _value = value),
  );
}

class _DemoCardSlider extends StatefulWidget {
  const _DemoCardSlider();

  @override
  State<_DemoCardSlider> createState() => _DemoCardSliderState();
}

class _DemoCardSliderState extends State<_DemoCardSlider> {
  double _value = 0.5;

  @override
  Widget build(BuildContext context) => CardSlider(
    label: 'Speed',
    icon: MdiIcons.fan,
    value: _value,
    themeColor: ThemeColors.climate,
    onChanged: (value) => setState(() => _value = value),
  );
}

class _DemoSettingsSlider extends StatefulWidget {
  const _DemoSettingsSlider();

  @override
  State<_DemoSettingsSlider> createState() => _DemoSettingsSliderState();
}

class _DemoSettingsSliderState extends State<_DemoSettingsSlider> {
  double _value = 0.7;

  @override
  Widget build(BuildContext context) => SettingsSlider(
    value: _value,
    iconSmall: MdiIcons.brightness5,
    iconLarge: MdiIcons.brightness7,
    semanticLabel: 'Brightness',
    onChanged: (value) => setState(() => _value = value),
  );
}

class _DemoSwitch extends StatefulWidget {
  const _DemoSwitch({
    required this.value,
    this.color,
    this.state = ControlState.idle,
  });

  final bool value;
  final ThemeColors? color;
  final ControlState state;

  @override
  State<_DemoSwitch> createState() => _DemoSwitchState();
}

class _DemoSwitchState extends State<_DemoSwitch> {
  late bool _value = widget.value;

  @override
  Widget build(BuildContext context) => AppSwitch(
    value: _value,
    color: widget.color,
    state: widget.state,
    semanticLabel: 'Screen saver',
    onChanged: (value) => setState(() => _value = value),
  );
}

class _DemoStepper extends StatefulWidget {
  const _DemoStepper({required this.state, required this.sizeClass});

  final ControlState state;
  final ScreenSizeClass sizeClass;

  @override
  State<_DemoStepper> createState() => _DemoStepperState();
}

class _DemoStepperState extends State<_DemoStepper> {
  double _value = 21.5;

  @override
  Widget build(BuildContext context) => AppStepper(
    value: _value,
    min: 10,
    max: 30,
    step: 0.5,
    unit: '°',
    state: widget.state,
    sizeClass: widget.sizeClass,
    semanticLabel: 'Target temperature',
    onChanged: (value) => setState(() => _value = value),
  );
}

class _DemoSegments extends StatefulWidget {
  const _DemoSegments({
    this.color = ThemeColors.primary,
    this.state = ControlState.idle,
  });

  final ThemeColors color;
  final ControlState state;

  @override
  State<_DemoSegments> createState() => _DemoSegmentsState();
}

class _DemoSegmentsState extends State<_DemoSegments> {
  String _value = 'heat';

  @override
  Widget build(BuildContext context) => ModeSelector<String>(
    modes: _modes(),
    selectedValue: _value,
    color: widget.color,
    state: widget.state,
    onChanged: (value) => setState(() => _value = value),
  );
}
