// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_module_update_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardModuleUpdateDataSource _$DashboardModuleUpdateDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardModuleUpdateDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardModuleUpdateDataSource {
  /// Specifies the type of data source.
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DashboardModuleUpdateDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardModuleUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardModuleUpdateDataSourceCopyWith<DashboardModuleUpdateDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardModuleUpdateDataSourceCopyWith<$Res> {
  factory $DashboardModuleUpdateDataSourceCopyWith(
          DashboardModuleUpdateDataSource value,
          $Res Function(DashboardModuleUpdateDataSource) then) =
      _$DashboardModuleUpdateDataSourceCopyWithImpl<$Res,
          DashboardModuleUpdateDataSource>;
  @useResult
  $Res call({String type});
}

/// @nodoc
class _$DashboardModuleUpdateDataSourceCopyWithImpl<$Res,
        $Val extends DashboardModuleUpdateDataSource>
    implements $DashboardModuleUpdateDataSourceCopyWith<$Res> {
  _$DashboardModuleUpdateDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardModuleUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardModuleUpdateDataSourceImplCopyWith<$Res>
    implements $DashboardModuleUpdateDataSourceCopyWith<$Res> {
  factory _$$DashboardModuleUpdateDataSourceImplCopyWith(
          _$DashboardModuleUpdateDataSourceImpl value,
          $Res Function(_$DashboardModuleUpdateDataSourceImpl) then) =
      __$$DashboardModuleUpdateDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type});
}

/// @nodoc
class __$$DashboardModuleUpdateDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardModuleUpdateDataSourceCopyWithImpl<$Res,
        _$DashboardModuleUpdateDataSourceImpl>
    implements _$$DashboardModuleUpdateDataSourceImplCopyWith<$Res> {
  __$$DashboardModuleUpdateDataSourceImplCopyWithImpl(
      _$DashboardModuleUpdateDataSourceImpl _value,
      $Res Function(_$DashboardModuleUpdateDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardModuleUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
  }) {
    return _then(_$DashboardModuleUpdateDataSourceImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardModuleUpdateDataSourceImpl
    implements _DashboardModuleUpdateDataSource {
  const _$DashboardModuleUpdateDataSourceImpl({required this.type});

  factory _$DashboardModuleUpdateDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardModuleUpdateDataSourceImplFromJson(json);

  /// Specifies the type of data source.
  @override
  final String type;

  @override
  String toString() {
    return 'DashboardModuleUpdateDataSource(type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardModuleUpdateDataSourceImpl &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type);

  /// Create a copy of DashboardModuleUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardModuleUpdateDataSourceImplCopyWith<
          _$DashboardModuleUpdateDataSourceImpl>
      get copyWith => __$$DashboardModuleUpdateDataSourceImplCopyWithImpl<
          _$DashboardModuleUpdateDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardModuleUpdateDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardModuleUpdateDataSource
    implements DashboardModuleUpdateDataSource {
  const factory _DashboardModuleUpdateDataSource({required final String type}) =
      _$DashboardModuleUpdateDataSourceImpl;

  factory _DashboardModuleUpdateDataSource.fromJson(Map<String, dynamic> json) =
      _$DashboardModuleUpdateDataSourceImpl.fromJson;

  /// Specifies the type of data source.
  @override
  String get type;

  /// Create a copy of DashboardModuleUpdateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardModuleUpdateDataSourceImplCopyWith<
          _$DashboardModuleUpdateDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
