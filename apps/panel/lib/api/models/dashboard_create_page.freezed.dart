// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreatePage _$DashboardCreatePageFromJson(Map<String, dynamic> json) {
  return _DashboardCreatePage.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreatePage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// A list of data sources used by the page, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreatePage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreatePageCopyWith<DashboardCreatePage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreatePageCopyWith<$Res> {
  factory $DashboardCreatePageCopyWith(
          DashboardCreatePage value, $Res Function(DashboardCreatePage) then) =
      _$DashboardCreatePageCopyWithImpl<$Res, DashboardCreatePage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source') List<DashboardCreateDataSource> dataSource,
      int order,
      String? icon});
}

/// @nodoc
class _$DashboardCreatePageCopyWithImpl<$Res, $Val extends DashboardCreatePage>
    implements $DashboardCreatePageCopyWith<$Res> {
  _$DashboardCreatePageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? order = null,
    Object? icon = freezed,
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
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateDataSource>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreatePageImplCopyWith<$Res>
    implements $DashboardCreatePageCopyWith<$Res> {
  factory _$$DashboardCreatePageImplCopyWith(_$DashboardCreatePageImpl value,
          $Res Function(_$DashboardCreatePageImpl) then) =
      __$$DashboardCreatePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source') List<DashboardCreateDataSource> dataSource,
      int order,
      String? icon});
}

/// @nodoc
class __$$DashboardCreatePageImplCopyWithImpl<$Res>
    extends _$DashboardCreatePageCopyWithImpl<$Res, _$DashboardCreatePageImpl>
    implements _$$DashboardCreatePageImplCopyWith<$Res> {
  __$$DashboardCreatePageImplCopyWithImpl(_$DashboardCreatePageImpl _value,
      $Res Function(_$DashboardCreatePageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreatePageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateDataSource>,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreatePageImpl implements _DashboardCreatePage {
  const _$DashboardCreatePageImpl(
      {required this.id,
      required this.type,
      required this.title,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateDataSource> dataSource,
      this.order = 0,
      this.icon})
      : _dataSource = dataSource;

  factory _$DashboardCreatePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreatePageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

  /// A list of data sources used by the page, typically for real-time updates.
  final List<DashboardCreateDataSource> _dataSource;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The position of the page in the dashboard’s list.
  @override
  @JsonKey()
  final int order;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardCreatePage(id: $id, type: $type, title: $title, dataSource: $dataSource, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreatePageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, title,
      const DeepCollectionEquality().hash(_dataSource), order, icon);

  /// Create a copy of DashboardCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreatePageImplCopyWith<_$DashboardCreatePageImpl> get copyWith =>
      __$$DashboardCreatePageImplCopyWithImpl<_$DashboardCreatePageImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreatePageImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreatePage implements DashboardCreatePage {
  const factory _DashboardCreatePage(
      {required final String id,
      required final String type,
      required final String title,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateDataSource> dataSource,
      final int order,
      final String? icon}) = _$DashboardCreatePageImpl;

  factory _DashboardCreatePage.fromJson(Map<String, dynamic> json) =
      _$DashboardCreatePageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateDataSource> get dataSource;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreatePageImplCopyWith<_$DashboardCreatePageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
