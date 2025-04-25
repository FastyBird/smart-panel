// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_module_storage_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemModuleStorageInfo _$SystemModuleStorageInfoFromJson(
    Map<String, dynamic> json) {
  return _SystemModuleStorageInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemModuleStorageInfo {
  /// Filesystem type or mount point.
  String get fs => throw _privateConstructorUsedError;

  /// Used storage space in bytes.
  int get used => throw _privateConstructorUsedError;

  /// Total storage capacity in bytes.
  int get size => throw _privateConstructorUsedError;

  /// Available free storage space in bytes.
  int get available => throw _privateConstructorUsedError;

  /// Serializes this SystemModuleStorageInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemModuleStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemModuleStorageInfoCopyWith<SystemModuleStorageInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemModuleStorageInfoCopyWith<$Res> {
  factory $SystemModuleStorageInfoCopyWith(SystemModuleStorageInfo value,
          $Res Function(SystemModuleStorageInfo) then) =
      _$SystemModuleStorageInfoCopyWithImpl<$Res, SystemModuleStorageInfo>;
  @useResult
  $Res call({String fs, int used, int size, int available});
}

/// @nodoc
class _$SystemModuleStorageInfoCopyWithImpl<$Res,
        $Val extends SystemModuleStorageInfo>
    implements $SystemModuleStorageInfoCopyWith<$Res> {
  _$SystemModuleStorageInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemModuleStorageInfo
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
abstract class _$$SystemModuleStorageInfoImplCopyWith<$Res>
    implements $SystemModuleStorageInfoCopyWith<$Res> {
  factory _$$SystemModuleStorageInfoImplCopyWith(
          _$SystemModuleStorageInfoImpl value,
          $Res Function(_$SystemModuleStorageInfoImpl) then) =
      __$$SystemModuleStorageInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String fs, int used, int size, int available});
}

/// @nodoc
class __$$SystemModuleStorageInfoImplCopyWithImpl<$Res>
    extends _$SystemModuleStorageInfoCopyWithImpl<$Res,
        _$SystemModuleStorageInfoImpl>
    implements _$$SystemModuleStorageInfoImplCopyWith<$Res> {
  __$$SystemModuleStorageInfoImplCopyWithImpl(
      _$SystemModuleStorageInfoImpl _value,
      $Res Function(_$SystemModuleStorageInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemModuleStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? fs = null,
    Object? used = null,
    Object? size = null,
    Object? available = null,
  }) {
    return _then(_$SystemModuleStorageInfoImpl(
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
class _$SystemModuleStorageInfoImpl implements _SystemModuleStorageInfo {
  const _$SystemModuleStorageInfoImpl(
      {required this.fs,
      required this.used,
      required this.size,
      required this.available});

  factory _$SystemModuleStorageInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemModuleStorageInfoImplFromJson(json);

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
    return 'SystemModuleStorageInfo(fs: $fs, used: $used, size: $size, available: $available)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemModuleStorageInfoImpl &&
            (identical(other.fs, fs) || other.fs == fs) &&
            (identical(other.used, used) || other.used == used) &&
            (identical(other.size, size) || other.size == size) &&
            (identical(other.available, available) ||
                other.available == available));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, fs, used, size, available);

  /// Create a copy of SystemModuleStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemModuleStorageInfoImplCopyWith<_$SystemModuleStorageInfoImpl>
      get copyWith => __$$SystemModuleStorageInfoImplCopyWithImpl<
          _$SystemModuleStorageInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemModuleStorageInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemModuleStorageInfo implements SystemModuleStorageInfo {
  const factory _SystemModuleStorageInfo(
      {required final String fs,
      required final int used,
      required final int size,
      required final int available}) = _$SystemModuleStorageInfoImpl;

  factory _SystemModuleStorageInfo.fromJson(Map<String, dynamic> json) =
      _$SystemModuleStorageInfoImpl.fromJson;

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

  /// Create a copy of SystemModuleStorageInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemModuleStorageInfoImplCopyWith<_$SystemModuleStorageInfoImpl>
      get copyWith => throw _privateConstructorUsedError;
}
