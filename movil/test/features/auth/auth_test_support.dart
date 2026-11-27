import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/app/unifundme_app.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/storage/session_store.dart';
import 'package:movil/features/auth/application/app_dependencies.dart';
import 'package:movil/features/auth/domain/auth_session.dart';

class MemorySessionStore implements SessionStore {
  StoredSession? value;
  Completer<void>? readGate;
  Completer<void>? writeGate;
  bool failRead = false, failWrite = false, failDelete = false;
  int reads = 0, writes = 0, deletes = 0;
  @override
  Future<StoredSession?> read() async {
    reads++;
    if (readGate != null) await readGate!.future;
    if (failRead) {
      throw const SessionStoreException(SessionStoreError.unavailable);
    }
    return value;
  }

  @override
  Future<void> write(StoredSession session) async {
    writes++;
    if (writeGate != null) await writeGate!.future;
    if (failWrite) {
      throw const SessionStoreException(SessionStoreError.unavailable);
    }
    value = session;
  }

  @override
  Future<void> delete() async {
    deletes++;
    if (failDelete) {
      throw const SessionStoreException(SessionStoreError.unavailable);
    }
    value = null;
  }
}

Map<String, Object?> testUser({
  List<String> roles = const ['investor', 'entrepreneur', 'future_role'],
}) => {
  'id': 'synthetic-user',
  'email': 'test@example.com',
  'roles': roles,
  'phone': null,
  'preferredLanguage': 'es',
  'isActive': true,
};
Map<String, Object?> testLoginData() => {
  'accessToken': '1|synthetic-only',
  'tokenType': 'Bearer',
  'expiresIn': '24h',
  'user': testUser(),
};
http.Response testResponse(Object? data, {int status = 200}) => http.Response(
  jsonEncode({
    'data': data,
    'statusCode': status,
    'message': 'Operación exitosa',
  }),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

AppDependencies testDependencies({
  MemorySessionStore? store,
  bool configured = true,
  bool includeCatalog = false,
  bool includeTracking = false,
  DateTime Function()? clock,
  Future<http.Response> Function(http.Request)? handler,
}) {
  final client = MockClient((request) async {
    // Aislar las consultas públicas del escenario de autenticación bajo prueba.
    if (!includeCatalog && request.url.path == '/api/v1/categories') {
      return testResponse([]);
    }
    if (!includeCatalog && request.url.path == '/api/v1/campaigns/public') {
      return testResponse({
        'data': [],
        'meta': {
          'totalItems': 0,
          'itemCount': 0,
          'itemsPerPage': 20,
          'totalPages': 1,
          'currentPage': 1,
        },
      });
    }
    if (!includeTracking && request.url.path == '/api/v1/investments/me') {
      return testResponse([]);
    }
    if (!includeTracking &&
        request.url.path == '/api/v1/investments/backed-campaigns/updates') {
      return testResponse({
        'data': [],
        'campaigns': [],
        'meta': {
          'totalItems': 0,
          'itemCount': 0,
          'itemsPerPage': 10,
          'totalPages': 1,
          'currentPage': 1,
        },
      });
    }
    if (handler != null) return handler(request);
    if (request.url.path.endsWith('logout')) return testResponse(null);
    if (request.url.path.endsWith('login')) {
      return testResponse(testLoginData());
    }
    if (request.url.path.endsWith('register')) {
      return testResponse(testUser(), status: 201);
    }
    return testResponse(testUser());
  });
  addTearDown(client.close);
  return AppDependencies.create(
    AppConfig.fromValues(
      apiBaseUrl: configured ? 'https://api.example.com/api/v1' : '',
    ),
    client: client,
    store: store ?? MemorySessionStore(),
    clock: clock,
  );
}

Future<void> authenticateTest(AppDependencies dependencies) async {
  final attempt = dependencies.session.beginAuthentication();
  await dependencies.session.acceptLogin(
    attempt,
    LoginResponse.fromJson({'data': testLoginData(), 'statusCode': 200}),
  );
}

Future<void> pumpAuthApp(
  WidgetTester tester,
  AppDependencies dependencies, {
  String location = '/',
}) async {
  await tester.pumpWidget(
    UniFundMeApp(
      configLoader: () => dependencies.config,
      dependenciesBuilder: (_) => dependencies,
      initialLocation: location,
    ),
  );
  await tester.pump();
}

Future<void> fillLogin(WidgetTester tester) async {
  await tester.enterText(
    find.byKey(const Key('login.email')),
    'test@example.com',
  );
  await tester.enterText(find.byKey(const Key('login.password')), 'Synthetic1');
}

Future<void> fillRegistration(WidgetTester tester) async {
  await tester.enterText(
    find.byKey(const Key('register.email')),
    'test@example.com',
  );
  await tester.enterText(
    find.byKey(const Key('register.password')),
    'Synthetic1',
  );
}
