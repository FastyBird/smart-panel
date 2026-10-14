import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/models/composite_command.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

/// Tracks one composite parent per request and never treats dispatch acceptance
/// as physical confirmation. A reconnect invalidates outstanding event authority.
class CompositeCommandService extends ChangeNotifier {
  final SocketService _socket;
  final CommandDispatchService _dispatch;
  final Dio? _providedDio;
  final Map<String, _PendingComposite> _pending = {};
  final Map<String, CompositeCommandOutcome> _latest = {};
  final Map<String, String> _latestRequest = {};
  int _connectionGeneration = 0;
  bool _disposed = false;

  CompositeCommandService({
    required SocketService socketService,
    required CommandDispatchService dispatch,
    Dio? dio,
  }) : _socket = socketService,
       _dispatch = dispatch,
       _providedDio = dio {
    _socket.registerEventHandler(
      'DevicesModule.CompositeCommand.Progress',
      _event,
    );
    _socket.registerEventHandler(
      'DevicesModule.CompositeCommand.Completed',
      _event,
    );
    _socket.addConnectionListener(_connectionChanged);
  }

  CompositeCommandOutcome? latestFor(String deviceId) => _latest[deviceId];

  Future<CompositeCommandOutcome> send({
    required String deviceId,
    required List<PropertyCommandItem> properties,
    PropertyCommandContext? context,
  }) async {
    if (_disposed) throw StateError('Composite command service is disposed');
    if (properties.isEmpty) throw ArgumentError('Composite batch is empty');
    final requestId = const Uuid().v4();
    final ticket = _PendingComposite(
      requestId: requestId,
      deviceId: deviceId,
      generation: _connectionGeneration,
      targets: properties
          .map(
            (item) => '${item.deviceId}:${item.channelId}:${item.propertyId}',
          )
          .toSet(),
    );
    _pending[requestId] = ticket;
    _latestRequest[deviceId] = requestId;
    _latest[deviceId] = CompositeCommandOutcome(
      id: '',
      requestId: requestId,
      status: 'pending',
      children: const [],
      terminal: false,
    );
    notifyListeners();
    final payload = <String, dynamic>{
      'request_id': requestId,
      'properties': properties.map((item) => item.toJson()).toList(),
      if (context != null) 'context': context.toJson(),
    };
    final result = await _dispatch.dispatchComposite(
      event: DevicesModuleConstants.setPropertyEvent,
      handler: DevicesModuleEventHandlerName.setProperty,
      payload: payload,
      apiFallback: () async {
        ticket.restDispatched = true;
        final response = await (_providedDio ?? locator<Dio>())
            .post<Map<String, dynamic>>(
              '/modules/devices/property-commands',
              data: payload,
              options: Options(
                receiveTimeout: const Duration(seconds: 35),
                extra: {'retryExhausted': true},
              ),
            );
        final envelope = response.data;
        return envelope?['data'] is Map<String, dynamic>
            ? envelope!['data'] as Map<String, dynamic>
            : null;
      },
    );
    final ownsPending = _pending[requestId] == ticket;
    if (ownsPending) {
      _pending.remove(requestId);
    }
    if (_disposed ||
        _latestRequest[deviceId] != requestId ||
        !ownsPending ||
        (!ticket.restDispatched &&
            ticket.generation != _connectionGeneration)) {
      return _uncertain(ticket);
    }
    final composite = result.data?['composites'];
    if (composite is List &&
        composite.isNotEmpty &&
        composite.first is Map<String, dynamic>) {
      final responseId = result.data?['request_id'];
      if (responseId == requestId) {
        final outcome = CompositeCommandOutcome.fromJson(
          composite.first as Map<String, dynamic>,
          requestId: requestId,
        );
        _publish(ticket, outcome);
        return outcome;
      }
    }
    if (ticket.outcome?.terminal == true) return ticket.outcome!;
    final outcome = _uncertain(ticket);
    _publish(ticket, outcome);
    return outcome;
  }

  CompositeCommandOutcome _uncertain(_PendingComposite ticket) =>
      CompositeCommandOutcome(
        id: ticket.parentId ?? '',
        requestId: ticket.requestId,
        status: 'unknown',
        children: ticket.outcome?.children ?? const [],
        terminal: true,
      );

  void _event(String event, Map<String, dynamic> payload) {
    final requestId = payload['requestId'];
    if (requestId is! String) return;
    final ticket = _pending[requestId];
    if (ticket == null || ticket.generation != _connectionGeneration) return;
    final id = payload['id'];
    final epoch = payload['epoch'];
    final sequence = payload['sequence'];
    if (id is! String ||
        epoch is! String ||
        sequence is! int ||
        sequence <= 0) {
      return;
    }
    if (ticket.parentId != null && ticket.parentId != id) return;
    if (ticket.epoch != null && ticket.epoch != epoch) return;
    if (sequence <= ticket.sequence) return;
    final targets = payload['targets'];
    if (targets is! List) return;
    final received = targets.whereType<Map<String, dynamic>>().map((target) {
      final device = target['deviceId'];
      final channel = target['channelId'];
      final property = target['propertyId'];
      return '$device:$channel:$property';
    }).toSet();
    if (!setEquals(received, ticket.targets)) return;
    ticket.parentId = id;
    ticket.epoch = epoch;
    ticket.sequence = sequence;
    final outcome = CompositeCommandOutcome.fromJson(
      payload,
      requestId: requestId,
      terminal: event == 'DevicesModule.CompositeCommand.Completed',
    );
    ticket.outcome = outcome;
    _publish(ticket, outcome);
  }

  void _publish(_PendingComposite ticket, CompositeCommandOutcome outcome) {
    if (_disposed || _latestRequest[ticket.deviceId] != ticket.requestId) {
      return;
    }
    _latest[ticket.deviceId] = outcome;
    notifyListeners();
  }

  void _connectionChanged(bool connected) {
    _connectionGeneration++;
    for (final ticket in _pending.values.toList()) {
      // Reconnection retires socket event authority; a correlated HTTP response remains authoritative.
      if (ticket.restDispatched) continue;
      _publish(ticket, _uncertain(ticket));
      _pending.remove(ticket.requestId);
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _connectionGeneration++;
    _pending.clear();
    _socket.unregisterEventHandler(
      'DevicesModule.CompositeCommand.Progress',
      _event,
    );
    _socket.unregisterEventHandler(
      'DevicesModule.CompositeCommand.Completed',
      _event,
    );
    _socket.removeConnectionListener(_connectionChanged);
    super.dispose();
  }
}

class _PendingComposite {
  final String requestId;
  final String deviceId;
  final int generation;
  final Set<String> targets;
  String? parentId;
  String? epoch;
  int sequence = 0;
  CompositeCommandOutcome? outcome;
  bool restDispatched = false;

  _PendingComposite({
    required this.requestId,
    required this.deviceId,
    required this.generation,
    required this.targets,
  });
}
