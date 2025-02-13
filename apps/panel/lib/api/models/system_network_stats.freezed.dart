// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_network_stats.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemNetworkStats _$SystemNetworkStatsFromJson(Map<String, dynamic> json) {
  return _SystemNetworkStats.fromJson(json);
}

/// @nodoc
mixin _$SystemNetworkStats {
  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @JsonKey(name: 'interface')
  String get interfaceValue => throw _privateConstructorUsedError;

  /// Total received bytes.
  @JsonKey(name: 'rx_bytes')
  int get rxBytes => throw _privateConstructorUsedError;

  /// Total transmitted bytes.
  @JsonKey(name: 'tx_bytes')
  int get txBytes => throw _privateConstructorUsedError;

  /// Serializes this SystemNetworkStats to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemNetworkStatsCopyWith<SystemNetworkStats> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemNetworkStatsCopyWith<$Res> {
  factory $SystemNetworkStatsCopyWith(
          SystemNetworkStats value, $Res Function(SystemNetworkStats) then) =
      _$SystemNetworkStatsCopyWithImpl<$Res, SystemNetworkStats>;
  @useResult
  $Res call(
      {@JsonKey(name: 'interface') String interfaceValue,
      @JsonKey(name: 'rx_bytes') int rxBytes,
      @JsonKey(name: 'tx_bytes') int txBytes});
}

/// @nodoc
class _$SystemNetworkStatsCopyWithImpl<$Res, $Val extends SystemNetworkStats>
    implements $SystemNetworkStatsCopyWith<$Res> {
  _$SystemNetworkStatsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? interfaceValue = null,
    Object? rxBytes = null,
    Object? txBytes = null,
  }) {
    return _then(_value.copyWith(
      interfaceValue: null == interfaceValue
          ? _value.interfaceValue
          : interfaceValue // ignore: cast_nullable_to_non_nullable
              as String,
      rxBytes: null == rxBytes
          ? _value.rxBytes
          : rxBytes // ignore: cast_nullable_to_non_nullable
              as int,
      txBytes: null == txBytes
          ? _value.txBytes
          : txBytes // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemNetworkStatsImplCopyWith<$Res>
    implements $SystemNetworkStatsCopyWith<$Res> {
  factory _$$SystemNetworkStatsImplCopyWith(_$SystemNetworkStatsImpl value,
          $Res Function(_$SystemNetworkStatsImpl) then) =
      __$$SystemNetworkStatsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'interface') String interfaceValue,
      @JsonKey(name: 'rx_bytes') int rxBytes,
      @JsonKey(name: 'tx_bytes') int txBytes});
}

/// @nodoc
class __$$SystemNetworkStatsImplCopyWithImpl<$Res>
    extends _$SystemNetworkStatsCopyWithImpl<$Res, _$SystemNetworkStatsImpl>
    implements _$$SystemNetworkStatsImplCopyWith<$Res> {
  __$$SystemNetworkStatsImplCopyWithImpl(_$SystemNetworkStatsImpl _value,
      $Res Function(_$SystemNetworkStatsImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? interfaceValue = null,
    Object? rxBytes = null,
    Object? txBytes = null,
  }) {
    return _then(_$SystemNetworkStatsImpl(
      interfaceValue: null == interfaceValue
          ? _value.interfaceValue
          : interfaceValue // ignore: cast_nullable_to_non_nullable
              as String,
      rxBytes: null == rxBytes
          ? _value.rxBytes
          : rxBytes // ignore: cast_nullable_to_non_nullable
              as int,
      txBytes: null == txBytes
          ? _value.txBytes
          : txBytes // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemNetworkStatsImpl implements _SystemNetworkStats {
  const _$SystemNetworkStatsImpl(
      {@JsonKey(name: 'interface') required this.interfaceValue,
      @JsonKey(name: 'rx_bytes') required this.rxBytes,
      @JsonKey(name: 'tx_bytes') required this.txBytes});

  factory _$SystemNetworkStatsImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemNetworkStatsImplFromJson(json);

  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @override
  @JsonKey(name: 'interface')
  final String interfaceValue;

  /// Total received bytes.
  @override
  @JsonKey(name: 'rx_bytes')
  final int rxBytes;

  /// Total transmitted bytes.
  @override
  @JsonKey(name: 'tx_bytes')
  final int txBytes;

  @override
  String toString() {
    return 'SystemNetworkStats(interfaceValue: $interfaceValue, rxBytes: $rxBytes, txBytes: $txBytes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemNetworkStatsImpl &&
            (identical(other.interfaceValue, interfaceValue) ||
                other.interfaceValue == interfaceValue) &&
            (identical(other.rxBytes, rxBytes) || other.rxBytes == rxBytes) &&
            (identical(other.txBytes, txBytes) || other.txBytes == txBytes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, interfaceValue, rxBytes, txBytes);

  /// Create a copy of SystemNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemNetworkStatsImplCopyWith<_$SystemNetworkStatsImpl> get copyWith =>
      __$$SystemNetworkStatsImplCopyWithImpl<_$SystemNetworkStatsImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemNetworkStatsImplToJson(
      this,
    );
  }
}

abstract class _SystemNetworkStats implements SystemNetworkStats {
  const factory _SystemNetworkStats(
          {@JsonKey(name: 'interface') required final String interfaceValue,
          @JsonKey(name: 'rx_bytes') required final int rxBytes,
          @JsonKey(name: 'tx_bytes') required final int txBytes}) =
      _$SystemNetworkStatsImpl;

  factory _SystemNetworkStats.fromJson(Map<String, dynamic> json) =
      _$SystemNetworkStatsImpl.fromJson;

  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @override
  @JsonKey(name: 'interface')
  String get interfaceValue;

  /// Total received bytes.
  @override
  @JsonKey(name: 'rx_bytes')
  int get rxBytes;

  /// Total transmitted bytes.
  @override
  @JsonKey(name: 'tx_bytes')
  int get txBytes;

  /// Create a copy of SystemNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemNetworkStatsImplCopyWith<_$SystemNetworkStatsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
