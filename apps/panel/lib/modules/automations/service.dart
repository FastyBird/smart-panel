import 'package:fastybird_smart_panel/modules/automations/models/automation.dart';
import 'package:fastybird_smart_panel/modules/automations/repositories/automations.dart';
import 'package:flutter/foundation.dart';

/// The outcome of switching an automation on or off from the panel.
enum AutomationToggleResult {
  success,

  /// A switch of the same automation is still on its way; nothing was sent.
  ignored,

  /// The graph is not complete, so the automation cannot be enabled.
  incomplete,

  /// The automation no longer exists.
  notFound,
  failed,
}

/// An automation as a page shows it: the stored state, or the state the
/// person just asked for while that request is on its way.
@immutable
class AutomationView {
  final AutomationModel automation;
  final bool? _requested;

  const AutomationView(this.automation, {bool? requested})
    : _requested = requested;

  String get id => automation.id;

  String get name => automation.name;

  AutomationStatus get status => automation.status;

  AutomationRunStatus? get lastRunStatus => automation.lastRunStatus;

  /// The optimistic value while a switch is pending, the stored one otherwise.
  bool get enabled => _requested ?? automation.enabled;

  /// Locked while a switch is pending: a second tap is not sent.
  bool get pending => _requested != null;
}

/// Automations for the pages, with an optimistic enable switch.
///
/// Switching follows the panel's optimistic UI pattern in its short form: the
/// requested value is shown at once and the switch is locked (PENDING); the
/// backend answers with the stored automation, which replaces it (IDLE). A
/// refusal, an error or a timeout drops the requested value, so the stored
/// one shows again (rollback). A configuration change has no device to settle,
/// so there is no SETTLING state. The websocket keeps the stored state current
/// meanwhile, and a change made in the admin shows as soon as nothing is pending.
class AutomationsService extends ChangeNotifier {
  final AutomationsRepository _repository;

  final Map<String, bool> _requested = {};

  bool _initialized = false;

  AutomationsService({required AutomationsRepository repository})
    : _repository = repository;

  Future<void> initialize() async {
    if (!_initialized) {
      _repository.addListener(notifyListeners);
      _initialized = true;
    }

    await _repository.fetchAll();
  }

  AutomationView? getAutomation(String id) {
    final automation = _repository.getAutomation(id);

    return automation == null ? null : _view(automation);
  }

  /// The automations owned by a space, by name.
  List<AutomationView> automationsForSpace(String spaceId) =>
      _repository.automations
          .where((automation) => automation.spaceId == spaceId)
          .map(_view)
          .toList()
        ..sort((a, b) {
          final byName = a.name.toLowerCase().compareTo(b.name.toLowerCase());

          return byName != 0 ? byName : a.id.compareTo(b.id);
        });

  Future<AutomationToggleResult> setEnabled(String id, bool enabled) async {
    if (_requested.containsKey(id)) return AutomationToggleResult.ignored;

    final current = _repository.getAutomation(id);

    if (current == null) return AutomationToggleResult.notFound;

    _requested[id] = enabled;
    notifyListeners();

    try {
      await _repository.setEnabled(id, enabled);

      return AutomationToggleResult.success;
    } on AutomationToggleException catch (e) {
      if (e.failure == AutomationToggleFailure.notFound) {
        _repository.delete(id);
      }

      return switch (e.failure) {
        AutomationToggleFailure.incomplete => AutomationToggleResult.incomplete,
        AutomationToggleFailure.notFound => AutomationToggleResult.notFound,
        AutomationToggleFailure.failed => AutomationToggleResult.failed,
      };
    } catch (_) {
      return AutomationToggleResult.failed;
    } finally {
      _requested.remove(id);
      notifyListeners();
    }
  }

  AutomationView _view(AutomationModel automation) =>
      AutomationView(automation, requested: _requested[automation.id]);

  @override
  void dispose() {
    if (_initialized) {
      _repository.removeListener(notifyListeners);
    }

    super.dispose();
  }
}
