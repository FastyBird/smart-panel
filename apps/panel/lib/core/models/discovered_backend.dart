/// Represents a backend server discovered via mDNS
class DiscoveredBackend {
  /// Service name advertised via mDNS
  final String name;

  /// Host address (IP or hostname)
  final String host;

  /// Port number
  final int port;

  /// API version/path prefix from TXT record
  final String? apiPath;

  /// Backend version from TXT record
  final String? version;

  /// Whether the backend uses HTTPS
  final bool isSecure;

  const DiscoveredBackend({
    required this.name,
    required this.host,
    required this.port,
    this.apiPath,
    this.version,
    this.isSecure = false,
  });

  /// Get the full base URL for this backend
  String get baseUrl {
    final protocol = isSecure ? 'https' : 'http';
    final path = apiPath ?? '/api/v1';
    return '$protocol://$host:$port$path';
  }

  /// Get the display address (host:port)
  String get displayAddress => '$host:$port';

  @override
  String toString() =>
      'DiscoveredBackend(name: $name, host: $host, port: $port, version: $version)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DiscoveredBackend &&
          runtimeType == other.runtimeType &&
          host == other.host &&
          port == other.port;

  @override
  int get hashCode => host.hashCode ^ port.hashCode;
}
