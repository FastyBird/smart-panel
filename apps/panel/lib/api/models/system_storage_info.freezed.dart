// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_storage_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemStorageInfo _$SystemStorageInfoFromJson(Map<String, dynamic> json) {
  return _SystemStorageInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemStorageInfo {
  /// Filesystem type or mount point.
  String get fs => throw _privateConstructorUsedError;

  /// Used storage space in bytes.
  int get used => throw _privateConstructorUsedError;

  /// Total storage capacity in bytes.
  int get size => throw _privateConstructorUsedError;

  /// Available free storage space in bytes.
  int get available => throw _privateConstructorUsedError;

  /// Serializes this SystemStorageInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemStorageInfoCopyWith<SystemStorageInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemStorageInfoCopyWith<$Res> {
  factory $SystemStorageInfoCopyWith(
          SystemStorageInfo value, $Res Function(SystemStorageInfo) then) =
      _$SystemStorageInfoCopyWithImpl<$Res, SystemStorageInfo>;
  @useResult
  $Res call({String fs, int used, int size, int available});
}

/// @nodoc
class _$SystemStorageInfoCopyWithImpl<$Res, $Val extends SystemStorageInfo>
    implements $SystemStorageInfoCopyWith<$Res> {
  _$SystemStorageInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? fs = null,
    Object? used = null,
    Object? size = null,
    Object? available = null,
  }) {
    return _then(_value.copyWith(
      fs: null == fs
          ? _value.fs
          : fs // ignore: cast_nullable_to_non_nullable
              as String,
      used: null == used
          ? _value.used
          : used // ignore: cast_nullable_to_non_nullable
              as int,
      size: null == size
          ? _value.size
          : size // ignore: cast_nullable_to_non_nullable
              as int,
      available: null == available
          ? _value.available
          : available // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemStorageInfoImplCopyWith<$Res>
    implements $SystemStorageInfoCopyWith<$Res> {
  factory _$$SystemStorageInfoImplCopyWith(_$SystemStorageInfoImpl value,
          $Res Function(_$SystemStorageInfoImpl) then) =
      __$$SystemStorageInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String fs, int used, int size, int available});
}

/// @nodoc
class __$$SystemStorageInfoImplCopyWithImpl<$Res>
    extends _$SystemStorageInfoCopyWithImpl<$Res, _$SystemStorageInfoImpl>
    implements _$$SystemStorageInfoImplCopyWith<$Res> {
  __$$SystemStorageInfoImplCopyWithImpl(_$SystemStorageInfoImpl _value,
      $Res Function(_$SystemStorageInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? fs = null,
    Object? used = null,
    Object? size = null,
    Object? available = null,
  }) {
    return _then(_$SystemStorageInfoImpl(
      fs: null == fs
          ? _value.fs
          : fs // ignore: cast_nullable_to_non_nullable
              as String,
      used: null == used
          ? _value.used
          : used // ignore: cast_nullable_to_non_nullable
              as int,
      size: null == size
          ? _value.size
          : size // ignore: cast_nullable_to_non_nullable
              as int,
      available: null == available
          ? _value.available
          : available // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemStorageInfoImpl implements _SystemStorageInfo {
  const _$SystemStorageInfoImpl(
      {required this.fs,
      required this.used,
      required this.size,
      required this.available});

  factory _$SystemStorageInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemStorageInfoImplFromJson(json);

  /// Filesystem type or mount point.
  @override
  final String fs;

  /// Used storage space in bytes.
  @override
  final int used;

  /// Total storage capacity in bytes.
  @override
  final int size;

  /// Available free storage space in bytes.
  @override
  final int available;

  @override
  String toString() {
    return 'SystemStorageInfo(fs: $fs, used: $used, size: $size, available: $available)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemStorageInfoImpl &&
            (identical(other.fs, fs) || other.fs == fs) &&
            (identical(other.used, used) || other.used == used) &&
            (identical(other.size, size) || other.size == size) &&
            (identical(other.available, available) ||
                other.available == available));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, fs, used, size, available);

  /// Create a copy of SystemStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemStorageInfoImplCopyWith<_$SystemStorageInfoImpl> get copyWith =>
      __$$SystemStorageInfoImplCopyWithImpl<_$SystemStorageInfoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemStorageInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemStorageInfo implements SystemStorageInfo {
  const factory _SystemStorageInfo(
      {required final String fs,
      required final int used,
      required final int size,
      required final int available}) = _$SystemStorageInfoImpl;

  factory _SystemStorageInfo.fromJson(Map<String, dynamic> json) =
      _$SystemStorageInfoImpl.fromJson;

  /// Filesystem type or mount point.
  @override
  String get fs;

  /// Used storage space in bytes.
  @override
  int get used;

  /// Total storage capacity in bytes.
  @override
  int get size;

  /// Available free storage space in bytes.
  @override
  int get available;

  /// Create a copy of SystemStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemStorageInfoImplCopyWith<_$SystemStorageInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
