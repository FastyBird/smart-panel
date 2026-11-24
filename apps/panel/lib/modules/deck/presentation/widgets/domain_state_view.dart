import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/skeleton.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// States for domain data loading.
///
/// Represents the lifecycle of data loading in domain views:
/// - [loading]: Initial fetch is in progress
/// - [loaded]: Data was successfully loaded
/// - [error]: Fetch failed, requires retry
/// - [empty]: Loaded successfully but no data exists
/// - [notConfigured]: Domain exists but is not configured (no roles/bindings)
enum DomainLoadState { loading, loaded, error, empty, notConfigured }

/// The screen states a [StateTemplate] draws (docs/display-ui-design-spec.md
/// §7). Loading is the [PageSkeleton], not a template.
enum AppScreenState {
  /// The data did not load: a warning icon, a short title, one line, Retry.
  error,

  /// Loaded, with nothing to show: a neutral icon, a title, one line.
  empty,

  /// Not set up yet: the domain's icon in its colour, a title and one line
  /// that points to the admin. Never looks like [empty].
  notConfigured,

  /// Not available here (locked, paused): a lock, a title, one line.
  blocked,
}

/// The state template's sizes (design canvas, the domain view's error and
/// not-configured states).
class StateTemplateMetrics {
  StateTemplateMetrics._();

  /// The icon circle and its icon: the page header's icon tile.
  static double circleFor(ScreenSizeClass sizeClass) =>
      PageHeaderMetrics.of(sizeClass).iconTile;

  static double iconFor(ScreenSizeClass sizeClass) =>
      PageHeaderMetrics.of(sizeClass).iconSize;

  /// The title: 14 / 16 / 18, 500.
  static double titleFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 14,
    ScreenSizeClass.regular => 16,
    ScreenSizeClass.expanded => 18,
  };

  /// The line: 10, 12 on Expanded.
  static double messageFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.expanded ? 12 : 10;

  static const double gap = 6;

  /// The line wraps within this width.
  static const double messageMaxWidth = 280;

  /// The action: 36 high (the touch floor), 16 to each side.
  static const double actionHeight = 36;
  static const double actionPadding = 16;
  static const double actionFont = 12;
}

/// One screen-state template (spec §7): an icon in a tinted circle, a short
/// title, one line and an optional action, centred.
///
/// | [state] | Icon | Colours |
/// |---|---|---|
/// | error | alert | warning tint and text; [actionLabel] defaults to Retry |
/// | empty | [icon] | `fill.base` and `text.secondary` |
/// | notConfigured | [icon] (cog off) | the [domain]'s tint and colour (the accent's without one); [message] defaults to "Set it up in the admin app." |
/// | blocked | lock | `fill.base` and `text.secondary` |
class StateTemplate extends StatelessWidget {
  const StateTemplate({
    super.key,
    required this.state,
    required this.title,
    this.message,
    this.icon,
    this.domain,
    this.actionLabel,
    this.onAction,
    this.sizeClass,
  });

  final AppScreenState state;
  final String title;

  /// The one line under the title.
  final String? message;

  /// Replaces the state's icon.
  final IconData? icon;

  /// A not-configured screen's domain (one of the domain [ThemeColors]).
  final ThemeColors? domain;

  /// The action's label; defaults to Retry for an error.
  final String? actionLabel;

  /// Shows the action.
  final VoidCallback? onAction;

  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final localizations = AppLocalizations.of(context)!;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;

    final (
      Color soft,
      Color foreground,
      IconData defaultIcon,
    ) = switch (state) {
      AppScreenState.error => (
        theme.status(AppStatus.warning).soft,
        theme.status(AppStatus.warning).text,
        MdiIcons.alertOutline,
      ),
      AppScreenState.empty => (
        neutrals.fillBase,
        neutrals.textSecondary,
        MdiIcons.inboxOutline,
      ),
      AppScreenState.notConfigured =>
        domain == null
            ? (theme.accent.soft, theme.accent.text, MdiIcons.cogOffOutline)
            : (
                theme.domain(domain!).soft,
                theme.domain(domain!).base,
                MdiIcons.cogOffOutline,
              ),
      AppScreenState.blocked => (
        neutrals.fillBase,
        neutrals.textSecondary,
        MdiIcons.lockOutline,
      ),
    };

    final line =
        message ??
        (state == AppScreenState.notConfigured
            ? localizations.state_not_configured_hint
            : null);
    final action =
        actionLabel ??
        (state == AppScreenState.error ? localizations.action_retry : null);
    final circle = AppSpacings.scale(
      StateTemplateMetrics.circleFor(resolvedClass),
    );

    return Semantics(
      container: true,
      liveRegion: state == AppScreenState.error ? true : null,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.scale(StateTemplateMetrics.gap),
        children: [
          ExcludeSemantics(
            child: Container(
              width: circle,
              height: circle,
              decoration: BoxDecoration(color: soft, shape: BoxShape.circle),
              child: Icon(
                icon ?? defaultIcon,
                size: AppSpacings.scale(
                  StateTemplateMetrics.iconFor(resolvedClass),
                ),
                color: foreground,
              ),
            ),
          ),
          Semantics(
            header: true,
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: neutrals.textPrimary,
                fontSize: AppSpacings.scale(
                  StateTemplateMetrics.titleFor(resolvedClass),
                ),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (line != null && line.isNotEmpty)
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: AppSpacings.scale(
                  StateTemplateMetrics.messageMaxWidth,
                ),
              ),
              child: Text(
                line,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: neutrals.textSecondary,
                  fontSize: AppSpacings.scale(
                    StateTemplateMetrics.messageFor(resolvedClass),
                  ),
                  height: 1.4,
                ),
              ),
            ),
          if (action != null && onAction != null)
            Padding(
              padding: EdgeInsets.only(top: AppSpacings.scale(2)),
              child: _TemplateAction(label: action, onTap: onAction!),
            ),
        ],
      ),
    );
  }
}

/// The template's action: the accent fill with white text, 36 high.
class _TemplateAction extends StatelessWidget {
  const _TemplateAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).accent;
    final radius = BorderRadius.circular(AppBorderRadius.base);

    return Semantics(
      button: true,
      child: Material(
        color: accent.fill,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: AppSpacings.scale(StateTemplateMetrics.actionHeight),
              minWidth: AppSpacings.scale(StateTemplateMetrics.actionHeight),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.scale(
                  StateTemplateMetrics.actionPadding,
                ),
              ),
              child: Center(
                widthFactor: 1,
                heightFactor: 1,
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: AppSpacings.scale(
                      StateTemplateMetrics.actionFont,
                    ),
                    fontWeight: FontWeight.w500,
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

/// A domain view's loading, error and not-configured states, or its
/// content (spec §7).
///
/// When [state] is:
/// - [DomainLoadState.loading]: the [PageSkeleton] (with [header] when given)
/// - [DomainLoadState.error]: the error template with Retry, under [header]
/// - [DomainLoadState.notConfigured]: the not-configured template
/// - [DomainLoadState.loaded] or [DomainLoadState.empty]: [child]
class DomainStateView extends StatelessWidget {
  /// Current loading state.
  final DomainLoadState state;

  /// The error template's line; defaults to the generic load failure line.
  final String? errorMessage;

  /// Callback when retry button is pressed.
  final VoidCallback onRetry;

  /// Content to display when loaded.
  final Widget child;

  /// Domain name for error message (e.g., "Lights", "Climate").
  final String domainName;

  /// Icon to show in the not-configured state. Defaults to [MdiIcons.cogOffOutline].
  final IconData? notConfiguredIcon;

  /// Title for the not-configured state.
  final String? notConfiguredTitle;

  /// Description for the not-configured state; defaults to the line that
  /// points to the admin.
  final String? notConfiguredDescription;

  /// The domain colour of the not-configured state (one of the domain
  /// [ThemeColors]); the accent without one.
  final ThemeColors? domain;

  /// The page's header, kept while it loads or failed to load.
  final Widget? header;

  const DomainStateView({
    super.key,
    required this.state,
    this.errorMessage,
    required this.onRetry,
    required this.child,
    required this.domainName,
    this.notConfiguredIcon,
    this.notConfiguredTitle,
    this.notConfiguredDescription,
    this.domain,
    this.header,
  });

  @override
  Widget build(BuildContext context) {
    switch (state) {
      case DomainLoadState.loading:
        return _page(context, PageSkeleton(header: header));
      case DomainLoadState.error:
        return _page(context, _buildErrorState(context));
      case DomainLoadState.notConfigured:
        return _buildNotConfiguredState(context);
      case DomainLoadState.loaded:
      case DomainLoadState.empty:
        return child;
    }
  }

  Widget _page(BuildContext context, Widget body) => Scaffold(
    backgroundColor: Theme.of(context).neutrals.surfacePage,
    body: SafeArea(child: body),
  );

  Widget _buildErrorState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final template = Center(
      child: SingleChildScrollView(
        padding: AppSpacings.paddingLg,
        child: StateTemplate(
          state: AppScreenState.error,
          title: localizations.domain_data_load_failed(domainName),
          message:
              errorMessage ?? localizations.domain_data_load_failed_description,
          onAction: onRetry,
        ),
      ),
    );

    if (header == null) return template;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header!,
        Expanded(child: template),
      ],
    );
  }

  Widget _buildNotConfiguredState(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: AppSpacings.paddingLg,
      child: StateTemplate(
        state: AppScreenState.notConfigured,
        title: notConfiguredTitle ?? domainName,
        message: notConfiguredDescription,
        icon: notConfiguredIcon,
        domain: domain,
      ),
    ),
  );
}
