import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/fleet_provider.dart';
import 'services/api_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/machines_screen.dart';
import 'screens/machine_detail_screen.dart';
import 'screens/settings_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthProvider();
  await auth.init();
  runApp(NovaFrotaApp(auth: auth));
}

class NovaFrotaApp extends StatefulWidget {
  final AuthProvider auth;
  const NovaFrotaApp({super.key, required this.auth});

  @override
  State<NovaFrotaApp> createState() => _NovaFrotaAppState();
}

class _NovaFrotaAppState extends State<NovaFrotaApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = GoRouter(
      refreshListenable: widget.auth,
      initialLocation: '/',
      redirect: (context, state) {
        final authenticated = widget.auth.isAuthenticated;
        final isLoggingIn = state.matchedLocation == '/login';
        if (!authenticated && !isLoggingIn) return '/login';
        if (authenticated && isLoggingIn) return '/';
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
        GoRoute(path: '/machines', builder: (_, __) => const MachinesScreen()),
        GoRoute(path: '/devices/:id', builder: (_, s) => MachineDetailScreen(deviceId: s.pathParameters['id']!)),
        GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: widget.auth),
        ChangeNotifierProxyProvider<AuthProvider, FleetProvider>(
          create: (_) => FleetProvider(ApiService(token: widget.auth.token ?? '')),
          update: (_, auth, fleet) => fleet!..updateApi(ApiService(token: auth.token ?? '')),
        ),
      ],
      child: MaterialApp.router(
        title: 'Nova Frota',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF1D4ED8),
            brightness: Brightness.dark,
            surface: const Color(0xFF0F172A),
          ),
          scaffoldBackgroundColor: const Color(0xFF0F172A),
          cardColor: const Color(0xFF1E293B),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF0F172A),
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: false,
          ),
          useMaterial3: true,
        ),
        routerConfig: _router,
      ),
    );
  }
}
