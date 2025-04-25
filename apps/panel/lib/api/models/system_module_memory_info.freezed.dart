// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_module_memory_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemModuleMemoryInfo _$SystemModuleMemoryInfoFromJson(
    Map<String, dynamic> json) {
  return _SystemModuleMemoryInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemModuleMemoryInfo {
  /// Total available system memory in bytes.
  int get total => throw _privateConstructorUsedError;

  /// Used memory in bytes.
  int get used => throw _privateConstructorUsedError;

  /// Free memory in bytes.
  int get free => throw _privateConstructorUsedError;

  /// Serializes this SystemModuleMemoryInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemModuleMemoryInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemModuleMemoryInfoCopyWith<SystemModuleMemoryInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemModuleMemoryInfoCopyWith<$Res> {
  factory $SystemModuleMemoryInfoCopyWith(SystemModuleMemoryInfo value,
          $Res Function(SystemModuleMemoryInfo) then) =
      _$SystemModuleMemoryInfoCopyWithImpl<$Res, SystemModuleMemoryInfo>;
  @useResult
  $Res call({int total, int used, int free});
}

/// @nodoc
class _$SystemModuleMemoryInfoCopyWithImpl<$Res,
        $Val extends SystemModuleMemoryInfo>
    implements $SystemModuleMemoryInfoCopyWith<$Res> {
  _$SystemModuleMemoryInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemModuleMemoryInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? used = null,
    Object? free = null,
  }) {
    return _then(_value.copyWith(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      used: null == used
          ? _value.used
          : used // ignore: cast_nullable_to_non_nullable
              as int,
      free: null == free
          ? _value.free
          : free // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemModuleMemoryInfoImplCopyWith<$Res>
    implements $SystemModuleMemoryInfoCopyWith<$Res> {
  factory _$$SystemModuleMemoryInfoImplCopyWith(
          _$SystemModuleMemoryInfoImpl value,
          $Res Function(_$SystemModuleMemoryInfoImpl) then) =
      __$$SystemModuleMemoryInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({int total, int used, int free});
}

/// @nodoc
class __$$SystemModuleMemoryInfoImplCopyWithImpl<$Res>
    extends _$SystemModuleMemoryInfoCopyWithImpl<$Res,
        _$SystemModuleMemoryInfoImpl>
    implements _$$SystemModuleMemoryInfoImplCopyWith<$Res> {
  __$$SystemModuleMemoryInfoImplCopyWithImpl(
      _$SystemModuleMemoryInfoImpl _value,
      $Res Function(_$SystemModuleMemoryInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemModuleMemoryInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? total = null,
    Object? used = null,
    Object? free = null,
  }) {
    return _then(_$SystemModuleMemoryInfoImpl(
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      used: null == used
          ? _value.used
          : used // ignore: cast_nullable_to_non_nullable
              as int,
      free: null == free
          ? _value.free
          : free // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemModuleMemoryInfoImpl implements _SystemModuleMemoryInfo {
  const _$SystemModuleMemoryInfoImpl(
      {required this.total, required this.used, required this.free});

  factory _$SystemModuleMemoryInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemModuleMemoryInfoImplFromJson(json);

  /// Total available system memory in bytes.
  @override
  final int total;

  /// Used memory in bytes.
  @override
  final int used;

  /// Free memory in bytes.
  @override
  final int free;

  @override
  String toString() {
    return 'SystemModuleMemoryInfo(total: $total, used: $used, free: $free)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemModuleMemoryInfoImpl &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.used, used) || other.used == used) &&
            (identical(other.free, free) || other.free == free));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, total, used, free);

  /// Create a copy of SystemModuleMemoryInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemModuleMemoryInfoImplCopyWith<_$SystemModuleMemoryInfoImpl>
      get copyWith => __$$SystemModuleMemoryInfoImplCopyWithImpl<
          _$SystemModuleMemoryInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemModuleMemoryInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemModuleMemoryInfo implements SystemModuleMemoryInfo {
  const factory _SystemModuleMemoryInfo(
      {required final int total,
      required final int used,
      required final int free}) = _$SystemModuleMemoryInfoImpl;

  factory _SystemModuleMemoryInfo.fromJson(Map<String, dynamic> json) =
      _$SystemModuleMemoryInfoImpl.fromJson;

  /// Total available system memory in bytes.
  @override
  int get total;

  /// Used memory in bytes.
  @override
  int get used;

  /// Free memory in bytes.
  @override
  int get free;

  /// Create a copy of SystemModuleMemoryInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemModuleMemoryInfoImplCopyWith<_$SystemModuleMemoryInfoImpl>
      get copyWith => throw _privateConstructorUsedError;
}
