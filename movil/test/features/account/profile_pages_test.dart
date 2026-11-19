import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/features/account/domain/profile_details.dart';
import 'package:movil/features/account/presentation/profile_page.dart';

import '../auth/auth_test_support.dart';
import 'account_profile_controller_test.dart' show profileData;

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder.hitTestable(),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  expect(finder.hitTestable(), findsOneWidget);
  await tester.tap(finder.hitTestable());
  await tester.pumpAndSettle();
}

Future<void> tapProfile(WidgetTester tester, String key) =>
    tapVisible(tester, find.byKey(Key(key)));

void main() {
  final previousFatal = WidgetController.hitTestWarningShouldBeFatal;
  setUp(() => WidgetController.hitTestWarningShouldBeFatal = true);
  tearDown(() => WidgetController.hitTestWarningShouldBeFatal = previousFatal);
  for (final kind in ProfileKind.values) {
    testWidgets(
      '${kind.name}: completa un perfil faltante y muestra la respuesta guardada',
      (tester) async {
        http.Request? saved;
        final deps = testDependencies(
          handler: (r) async {
            if (r.method == 'GET') return testResponse(null, status: 404);
            saved = r;
            return testResponse({
              ...profileData(),
              ...jsonDecode(r.body) as Map<String, dynamic>,
            }, status: 201);
          },
        );
        await authenticateTest(deps);
        await tester.pumpWidget(
          MaterialApp(
            home: ProfilePage(dependencies: deps, kind: kind),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('profile.missing')), findsOneWidget);
        await tapProfile(tester, 'profile.create');
        await tester.enterText(
          find.byKey(const Key('profile.firstName')),
          'Ana',
        );
        await tester.enterText(
          find.byKey(const Key('profile.lastName')),
          'Flores',
        );
        await tapProfile(tester, 'profile.save');
        expect(saved!.method, 'POST');
        expect(find.text('Perfil guardado.'), findsOneWidget);
        await tester.scrollUntilVisible(
          find.byKey(const Key('profile.edit')),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.byKey(const Key('profile.edit')), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
        deps.dispose();
      },
    );
  }

  for (final size in [const Size(800, 600), const Size(360, 640)]) {
    testWidgets(
      'editar y cancelar conserva el perfil y no envía escrituras (${size.width.toInt()}x${size.height.toInt()})',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = size;
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        await tester.binding.setSurfaceSize(size);
        addTearDown(() => tester.binding.setSurfaceSize(null));
        var writes = 0;
        final deps = testDependencies(
          handler: (r) async {
            if (r.method != 'GET') writes++;
            return testResponse(profileData());
          },
        );
        await authenticateTest(deps);
        await tester.pumpWidget(
          MaterialApp(
            home: ProfilePage(dependencies: deps, kind: ProfileKind.investor),
          ),
        );
        await tester.pumpAndSettle();
        await tapProfile(tester, 'profile.edit');
        await tester.enterText(
          find.byKey(const Key('profile.firstName')),
          'Andrea',
        );
        await tapVisible(tester, find.text('Cancelar'));
        expect(writes, 0);
        expect(find.text('Ana'), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
        deps.dispose();
      },
    );
  }

  testWidgets(
    'un error de consulta se distingue de un perfil inexistente y permite reintentar',
    (tester) async {
      var fail = true;
      final deps = testDependencies(
        handler: (_) async => fail
            ? testResponse(null, status: 500)
            : testResponse(profileData()),
      );
      await authenticateTest(deps);
      await tester.pumpWidget(
        MaterialApp(
          home: ProfilePage(dependencies: deps, kind: ProfileKind.investor),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('profile.loadError')), findsOneWidget);
      expect(find.byKey(const Key('profile.create')), findsNothing);
      fail = false;
      await tester.tap(find.text('Reintentar consulta'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const Key('profile.edit')),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.byKey(const Key('profile.edit')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      deps.dispose();
    },
  );
}
