import 'package:fastybird_smart_panel/features/gallery/entries/card_entries.dart';
import 'package:fastybird_smart_panel/features/gallery/entries/control_entries.dart';
import 'package:fastybird_smart_panel/features/gallery/entries/header_entries.dart';
import 'package:fastybird_smart_panel/features/gallery/entries/list_entries.dart';
import 'package:fastybird_smart_panel/features/gallery/entries/navigation_entries.dart';
import 'package:fastybird_smart_panel/features/gallery/entries/state_entries.dart';
import 'package:flutter/widgets.dart';

/// One component sample in the gallery.
///
/// [builder] runs inside the preview canvas, under the chosen theme, accent
/// and [GalleryScope].
class GalleryEntry {
  const GalleryEntry({required this.title, required this.builder});

  final String title;
  final WidgetBuilder builder;
}

/// One component group, owned by the redesign task that builds it.
class GallerySection {
  const GallerySection({
    required this.id,
    required this.task,
    required this.issue,
    required this.title,
    this.entries = const [],
  });

  /// Stable key for tests and the section switcher.
  final String id;

  /// The redesign task, for example `DR-5`.
  final String task;

  /// The task's GitHub issue number.
  final int issue;

  final String title;

  final List<GalleryEntry> entries;
}

/// The component groups of the redesign (EPIC-DISPLAY-UI-REDESIGN, phase 2).
///
/// Each task adds its entries to its own section when it builds the
/// components: every state the spec draws (default, active, pressed,
/// disabled, pending, never confirmed, offline) where it applies.
const List<GallerySection> gallerySections = [
  GallerySection(
    id: 'header',
    task: 'DR-5',
    issue: 1715,
    title: 'Page header',
    entries: headerEntries,
  ),
  GallerySection(
    id: 'cards',
    task: 'DR-6',
    issue: 1716,
    title: 'Cards, hero card and tiles',
    entries: cardEntries,
  ),
  GallerySection(
    id: 'controls',
    task: 'DR-7',
    issue: 1717,
    title: 'Slider, switch, stepper, segmented control and mode chip',
    entries: controlEntries,
  ),
  GallerySection(
    id: 'lists',
    task: 'DR-8',
    issue: 1718,
    title: 'List rows, sheets, drawers, dialogs, toasts and banners',
    entries: listEntries,
  ),
  GallerySection(
    id: 'states',
    task: 'DR-9',
    issue: 1719,
    title: 'State templates, skeletons and the outcome indicator',
    entries: stateEntries,
  ),
  GallerySection(
    id: 'navigation',
    task: 'DR-10',
    issue: 1720,
    title: 'Deck bar and dock',
    entries: navigationEntries,
  ),
];
