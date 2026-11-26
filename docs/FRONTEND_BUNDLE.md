# Carga del frontend web — issue 4.38

Las páginas se importan mediante `React.lazy` al resolver su ruta. Los gráficos
de rendimiento, campañas y auditoría financiera se importan al abrir su sección.
La portada no requiere páginas de administración, otras rutas ni Recharts.
Los iconos se agrupan para evitar decenas de solicitudes de archivos pequeños.

`AsyncContent` muestra un estado de carga accesible y captura errores de módulos
o renderizado. Ante un fallo ofrece **Recargar página** e **Ir al inicio**.
La recarga es explícita: obtiene el HTML vigente y vuelve a resolver los archivos
de la ruta actual; no intenta reutilizar una promesa de importación rechazada.
Las protecciones de sesión siguen aplicándose antes de renderizar una página privada.

## Medición reproducible

Desde `web/`, con las dependencias del lockfile y Node 24:

```powershell
npm run build
npm run bundle:report
npm run bundle:check
node scripts/bundle-report.mjs --json
```

El reporte lee `public/build/manifest.json` y los archivos compilados. `entryJs`
cuenta la entrada y todas sus dependencias estáticas transitivas; `homeJs` cuenta
la unión de esas dependencias con las de LandingPage, sin duplicados. No sigue
las importaciones dinámicas de otras pantallas. Antes de la división, ambas
métricas cuentan el único archivo que contenía toda la aplicación.

Los tamaños usan kB decimales (1.000 bytes). Gzip es la suma de comprimir cada
archivo por separado con nivel 9, en ambas versiones; puede diferir del resumen
de Vite y de la configuración del servidor. El reporte incluye CSS, número de
archivos, versión de Node/Vite y SHA-256 del lockfile. No mide imágenes, fuentes,
cabeceras HTTP, tiempos de red ni consumo de CPU.

La medición de partida está en [bundle-baseline.json](../web/bundle-baseline.json),
con el commit previo a los cambios. El resultado de esta corrección está en
[bundle-after.json](../web/bundle-after.json). Ambos usan el mismo lockfile,
Node 24.20.0, Vite 8.3.4 y gzip nivel 9.

| Métrica | Antes, kB / gzip kB | Después, kB / gzip kB |
| --- | ---: | ---: |
| Entrada y dependencias estáticas | 1.683,33 / 439,82 | 301,19 / 95,55 |
| Portada completa (JavaScript) | 1.683,33 / 439,82 | 423,67 / 133,80 |
| CSS de portada | 143,41 / 20,93 | 143,55 / 20,96 |
| JavaScript de todas las funcionalidades | 1.683,33 / 439,82 | 1.710,39 / 486,78 |

La portada reduce aproximadamente **74,83 %** sus bytes JavaScript y **69,58 %**
su suma gzip. Requiere 15 archivos JavaScript frente al único archivo monolítico
anterior. Una primera división automática producía 42 archivos iniciales; agrupar
los iconos redujo esa fragmentación. El mayor chunk resultante ronda 367,20 kB y
el build ya no muestra el aviso por chunks de más de 500 kB.

El JavaScript total crece ligeramente por la división y sus dependencias
compartidas. La mejora consiste en descargar las funcionalidades cuando se usan;
estas cifras no acreditan por sí solas una reducción del tiempo de carga.

## Límites que se comprueban en CI

[bundle-budget.json](../web/bundle-budget.json) fija estos máximos:

| Alcance | Bytes sin comprimir | Bytes gzip | Archivos JS |
| --- | ---: | ---: | ---: |
| Entrada y dependencias | 330.000 | 110.000 | — |
| Portada completa | 500.000 | 160.000 | 20 |
| Cada chunk JavaScript | 500.000 | — | — |

Además exige entradas dinámicas para las 23 páginas y los tres módulos de
gráficos. El plugin de inventario genera `bundle-modules.json` con rutas relativas
a `web/`, sin contenido fuente ni rutas absolutas. El control inspecciona los
módulos de cada chunk inicial para detectar otras páginas y gráficos incluso si
terminan dentro de una dependencia compartida. La falta de manifest, inventario,
archivos o entradas dinámicas hace fallar la comprobación.

Los límites tienen un margen acotado sobre el resultado actual. No se actualizan
automáticamente al compilar ni se ha elevado el umbral de advertencias de Vite.
Una ampliación futura necesita revisar sus motivos y el impacto sobre la carga.

## Verificación y despliegue

`npm test` cubre el cómputo del grafo, límites, contaminación de dependencias,
carga pendiente, rechazo y resolución de rutas. Después de compilar:

```powershell
npm run test:e2e -- bundle-loading.spec.ts
```

La suite Chromium usa el servidor y SQLite temporales del harness existente.
Comprueba solicitudes reales de portada, navegación, entrada directa y recarga,
protección de rutas privadas, carga de gráficos al abrir Rendimiento y recuperación
tras abortar un chunk. También retrasa un archivo para comprobar el estado visible
de carga. GitHub Actions ejecuta estos casos después de las regresiones PHP.

Comprobación local del 26 de noviembre de 2026: ESLint sin errores ni advertencias,
172 pruebas React/utilidades, 258 pruebas PHP (4.940 aserciones) y 18 casos Chromium
correctos (`bundle-loading.spec.ts` y `browser.spec.ts`). Compilación TypeScript/Vite
y presupuesto correctos. No se requieren migraciones.

El HTML debe conservar `Cache-Control: no-cache` o `no-store`; la prueba verifica
ese contrato en la respuesta de Laravel. En despliegues, no debe transformarse
en HTML con caché inmutable. Conservar los assets con hash del despliegue anterior
durante la transición evita fallos en sesiones abiertas. Si un archivo deja de
estar disponible o falla la conexión, la interfaz ofrece la recarga explícita.

Referencias: [React lazy](https://react.dev/reference/react/lazy),
[carga de assets en Vite](https://vite.dev/guide/build#load-error-handling) y
[división de código en Rolldown](https://rolldown.rs/reference/OutputOptions.codeSplitting).
