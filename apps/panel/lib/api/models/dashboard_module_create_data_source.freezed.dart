// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_module_create_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardModuleCreateDataSource _$DashboardModuleCreateDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardModuleCreateDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardModuleCreateDataSource {
  /// Unique identifier for the data source (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DashboardModuleCreateDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardModuleCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardModuleCreateDataSourceCopyWith<DashboardModuleCreateDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardModuleCreateDataSourceCopyWith<$Res> {
  factory $DashboardModuleCreateDataSourceCopyWith(
          DashboardModuleCreateDataSource value,
          $Res Function(DashboardModuleCreateDataSource) then) =
      _$DashboardModuleCreateDataSourceCopyWithImpl<$Res,
          DashboardModuleCreateDataSource>;
  @useResult
  $Res call({String id, String type});
}

/// @nodoc
class _$DashboardModuleCreateDataSourceCopyWithImpl<$Res,
        $Val extends DashboardModuleCreateDataSource>
    implements $DashboardModuleCreateDataSourceCopyWith<$Res> {
  _$DashboardModuleCreateDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardModuleCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardModuleCreateDataSourceImplCopyWith<$Res>
    implements $DashboardModuleCreateDataSourceCopyWith<$Res> {
  factory _$$DashboardModuleCreateDataSourceImplCopyWith(
          _$DashboardModuleCreateDataSourceImpl value,
          $Res Function(_$DashboardModuleCreateDataSourceImpl) then) =
      __$$DashboardModuleCreateDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String type});
}

/// @nodoc
class __$$DashboardModuleCreateDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardModuleCreateDataSourceCopyWithImpl<$Res,
        _$DashboardModuleCreateDataSourceImpl>
    implements _$$DashboardModuleCreateDataSourceImplCopyWith<$Res> {
  __$$DashboardModuleCreateDataSourceImplCopyWithImpl(
      _$DashboardModuleCreateDataSourceImpl _value,
      $Res Function(_$DashboardModuleCreateDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardModuleCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
  }) {
    return _then(_$DashboardModuleCreateDataSourceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardModuleCreateDataSourceImpl
    implements _DashboardModuleCreateDataSource {
  const _$DashboardModuleCreateDataSourceImpl(
      {required this.id, required this.type});

  factory _$DashboardModuleCreateDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardModuleCreateDataSourceImplFromJson(json);

  /// Unique identifier for the data source (optional during creation).
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

  @override
  String toString() {
    return 'DashboardModuleCreateDataSource(id: $id, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardModuleCreateDataSourceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type);

  /// Create a copy of DashboardModuleCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardModuleCreateDataSourceImplCopyWith<
          _$DashboardModuleCreateDataSourceImpl>
      get copyWith => __$$DashboardModuleCreateDataSourceImplCopyWithImpl<
          _$DashboardModuleCreateDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardModuleCreateDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardModuleCreateDataSource
    implements DashboardModuleCreateDataSource {
  const factory _DashboardModuleCreateDataSource(
      {required final String id,
      required final String type}) = _$DashboardModuleCreateDataSourceImpl;

  factory _DashboardModuleCreateDataSource.fromJson(Map<String, dynamic> json) =
      _$DashboardModuleCreateDataSourceImpl.fromJson;

  /// Unique identifier for the data source (optional during creation).
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

  /// Create a copy of DashboardModuleCreateDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardModuleCreateDataSourceImplCopyWith<
          _$DashboardModuleCreateDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
