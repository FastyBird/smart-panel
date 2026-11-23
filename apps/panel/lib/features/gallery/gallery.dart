import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/accent_swatch_picker.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Debug-only component gallery (docs/display-ui-design-spec.md §12).
///
/// Shows each shared component group on a reference canvas at a chosen size
/// class, orientation, theme and accent. Reached from Settings in debug builds
/// only; release builds have neither the route nor the entry. The labels are
/// English on purpose: this is a developer tool, not a panel screen.
class ComponentGalleryScreen extends StatefulWidget {
  const ComponentGalleryScreen({
    super.key,
    this.sections = gallerySections,
  });

  final List<GallerySection> sections;

  @override
  State<ComponentGalleryScreen> createState() => _ComponentGalleryScreenState();
}

class _ComponentGalleryScreenState extends State<ComponentGalleryScreen> {
  GalleryCanvas _canvas = GalleryCanvas.regular;
  Orientation _orientation = Orientation.landscape;
  late Brightness _brightness;
  AppAccent _accent = AppAccents.current;
  int _section = 0;
  bool _initialised = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (!_initialised) {
      // Start in the panel's own theme.
      _brightness = Theme.of(context).brightness;
      _initialised = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    assert(kDebugMode, 'The component gallery is for debug builds only.');

    final theme = Theme.of(context);
    final n = theme.neutrals;
    final isLandscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    final controls = _Controls(
      canvas: _canvas,
      orientation: _orientation,
      brightness: _brightness,
      accent: _accent,
      sections: widget.sections,
      section: _section,
      onCanvas: (value) => setState(() => _canvas = value),
      onOrientation: (value) => setState(() => _orientation = value),
      onBrightness: (value) => setState(() => _brightness = value),
      onAccent: (value) => setState(() => _accent = value),
      onSection: (value) => setState(() => _section = value),
    );

    final preview = _Preview(
      canvas: _canvas,
      orientation: _orientation,
      brightness: _brightness,
      accent: _accent,
      section: widget.sections.isEmpty ? null : widget.sections[_section],
    );

    return Scaffold(
      backgroundColor: n.surfacePage,
      body: Column(
        children: [
          PageHeader(
            title: 'Component gallery',
            leading: HeaderMainIcon(icon: MdiIcons.palette),
            trailing: HeaderIconButton(
              icon: MdiIcons.close,
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                left: AppSpacings.pMd,
                right: AppSpacings.pMd,
                bottom: AppSpacings.pMd,
              ),
              child: isLandscape
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          width: AppSpacings.scale(220),
                          child: SingleChildScrollView(child: controls),
                        ),
                        SizedBox(width: AppSpacings.pMd),
                        Expanded(child: preview),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Flexible(
                          child: SingleChildScrollView(child: controls),
                        ),
                        SizedBox(height: AppSpacings.pMd),
                        Expanded(flex: 2, child: preview),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  const _Controls({
    required this.canvas,
    required this.orientation,
    required this.brightness,
    required this.accent,
    required this.sections,
    required this.section,
    required this.onCanvas,
    required this.onOrientation,
    required this.onBrightness,
    required this.onAccent,
    required this.onSection,
  });

  final GalleryCanvas canvas;
  final Orientation orientation;
  final Brightness brightness;
  final AppAccent accent;
  final List<GallerySection> sections;
  final int section;
  final ValueChanged<GalleryCanvas> onCanvas;
  final ValueChanged<Orientation> onOrientation;
  final ValueChanged<Brightness> onBrightness;
  final ValueChanged<AppAccent> onAccent;
  final ValueChanged<int> onSection;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Group(
          label: 'Class',
          children: [
            for (final value in GalleryCanvas.values)
              _Choice(
                key: ValueKey('gallery-canvas-${value.name}'),
                label: value.label,
                selected: value == canvas,
                onTap: () => onCanvas(value),
              ),
          ],
        ),
        _Group(
          label: 'Orientation',
          children: [
            for (final value in Orientation.values)
              _Choice(
                key: ValueKey('gallery-orientation-${value.name}'),
                label: value == Orientation.landscape ? 'Landscape' : 'Portrait',
                selected: value == orientation,
                onTap: () => onOrientation(value),
              ),
          ],
        ),
        _Group(
          label: 'Theme',
          children: [
            for (final value in Brightness.values)
              _Choice(
                key: ValueKey('gallery-theme-${value.name}'),
                label: value == Brightness.light ? 'Light' : 'Dark',
                selected: value == brightness,
                onTap: () => onBrightness(value),
              ),
          ],
        ),
        _Group(
          label: 'Accent',
          children: [
            AccentSwatchPicker(
              value: accent,
              onChanged: onAccent,
              showPreview: false,
            ),
          ],
        ),
        _Group(
          label: 'Components',
          children: [
            for (var i = 0; i < sections.length; i++)
              _Choice(
                key: ValueKey('gallery-section-${sections[i].id}'),
                label: '${sections[i].task} ${sections[i].title}',
                selected: i == section,
                onTap: () => onSection(i),
              ),
          ],
        ),
      ],
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final n = Theme.of(context).neutrals;

    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacings.pMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              color: n.textSecondary,
            ),
          ),
          SizedBox(height: AppSpacings.pSm),
          Wrap(
            spacing: AppSpacings.pSm,
            runSpacing: AppSpacings.pSm,
            children: children,
          ),
        ],
      ),
    );
  }
}

/// A selectable pill. A stand-in until DR-7 adds the segmented control.
class _Choice extends StatelessWidget {
  const _Choice({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final n = theme.neutrals;
    final accent = theme.accent;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      onTap: onTap,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: AppSpacings.scale(36)),
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pXs,
          ),
          decoration: BoxDecoration(
            color: selected ? accent.soft : n.surfaceCard,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: Border.all(
              color: selected ? accent.text : n.borderLight,
              width: AppSpacings.scale(1),
            ),
          ),
          // Sized to the label, centred in the minimum height.
          child: Align(
            widthFactor: 1,
            heightFactor: 1,
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: AppFontSize.small,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: selected ? accent.text : n.textPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The reference canvas, scaled down to fit, in the chosen theme and accent.
class _Preview extends StatelessWidget {
  const _Preview({
    required this.canvas,
    required this.orientation,
    required this.brightness,
    required this.accent,
    required this.section,
  });

  final GalleryCanvas canvas;
  final Orientation orientation;
  final Brightness brightness;
  final AppAccent accent;
  final GallerySection? section;

  @override
  Widget build(BuildContext context) {
    final size = canvas.sizeFor(orientation);
    final logicalSize = Size(
      AppSpacings.scale(size.width),
      AppSpacings.scale(size.height),
    );
    final theme = brightness == Brightness.dark
        ? AppTheme.darkThemeFor(accent)
        : AppTheme.lightThemeFor(accent);
    final outline = Theme.of(context).neutrals.borderBase;
    // Entries that read MediaQuery see the canvas, not the panel: its size
    // and so its orientation, and no system insets.
    final media = MediaQuery.of(context).copyWith(
      size: logicalSize,
      padding: EdgeInsets.zero,
      viewPadding: EdgeInsets.zero,
      viewInsets: EdgeInsets.zero,
    );

    return Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: outline, width: AppSpacings.scale(1)),
          ),
          child: SizedBox(
            key: const ValueKey('gallery-canvas'),
            width: logicalSize.width,
            height: logicalSize.height,
            child: ClipRect(
              child: MediaQuery(
                data: media,
                child: Theme(
                  data: theme,
                  child: GalleryScope(
                    canvas: canvas,
                    orientation: orientation,
                    brightness: brightness,
                    accent: accent,
                    child: Builder(
                      builder: (context) => Material(
                        color: Theme.of(context).neutrals.surfacePage,
                        child: section == null
                            ? const SizedBox.shrink()
                            : _SectionView(section: section!),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionView extends StatelessWidget {
  const _SectionView({required this.section});

  final GallerySection section;

  @override
  Widget build(BuildContext context) {
    final n = Theme.of(context).neutrals;
    final caption = TextStyle(
      fontSize: AppFontSize.extraSmall,
      color: n.textSecondary,
    );

    return ListView(
      key: ValueKey('gallery-section-view-${section.id}'),
      padding: EdgeInsets.all(AppSpacings.pMd),
      children: [
        Text(
          section.title,
          style: TextStyle(
            fontSize: AppFontSize.large,
            fontWeight: FontWeight.w600,
            color: n.textPrimary,
          ),
        ),
        SizedBox(height: AppSpacings.pXs),
        Text('${section.task} · #${section.issue}', style: caption),
        SizedBox(height: AppSpacings.pMd),
        if (section.entries.isEmpty)
          Text(
            'No components yet. ${section.task} adds them here.',
            key: const ValueKey('gallery-section-empty'),
            style: caption,
          )
        else
          for (final entry in section.entries) ...[
            Text(entry.title, style: caption),
            SizedBox(height: AppSpacings.pSm),
            Builder(builder: entry.builder),
            SizedBox(height: AppSpacings.pLg),
          ],
      ],
    );
  }
}
