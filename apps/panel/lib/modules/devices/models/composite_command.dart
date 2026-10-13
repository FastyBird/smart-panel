class CompositeChildOutcome {
  final String memberId;
  final String? memberIdentity;
  final String? propertyId;
  final String? propertyIdentity;
  final String status;
  final String? reason;
  final dynamic value;
  final String? generation;

  const CompositeChildOutcome({
    required this.memberId,
    this.memberIdentity,
    this.propertyId,
    this.propertyIdentity,
    required this.status,
    this.reason,
    this.value,
    this.generation,
  });

  factory CompositeChildOutcome.fromJson(Map<String, dynamic> json) =>
      CompositeChildOutcome(
        memberId: json['memberId'] as String? ?? '',
        memberIdentity: json['memberIdentity'] as String?,
        propertyId: json['propertyId'] as String?,
        propertyIdentity: json['propertyIdentity'] as String?,
        status: json['status'] as String? ?? 'unavailable',
        reason: json['reason'] as String?,
        value: json['value'],
        generation: json['generation'] as String?,
      );
}

class CompositeCommandOutcome {
  final String id;
  final String requestId;
  final String status;
  final List<CompositeChildOutcome> children;
  final bool terminal;

  const CompositeCommandOutcome({
    required this.id,
    required this.requestId,
    required this.status,
    required this.children,
    this.terminal = true,
  });

  bool get confirmed => terminal && status == 'confirmed';
  bool get hasUncertainChildren =>
      children.any((child) => child.status != 'confirmed');

  factory CompositeCommandOutcome.fromJson(
    Map<String, dynamic> json, {
    required String requestId,
    bool terminal = true,
  }) => CompositeCommandOutcome(
    id: json['id'] as String? ?? '',
    requestId: requestId,
    status: json['status'] as String? ?? 'pending',
    children: (json['children'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(CompositeChildOutcome.fromJson)
        .toList(growable: false),
    terminal: terminal,
  );
}
