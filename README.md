# PLAN B · Administración de discoteca

Aplicación React + Vite con Inicio, Cajas e Inventario. Diseño oscuro adaptable a móvil, persistencia local o Firebase Firestore y reportes PDF completos con paginación.

## Desarrollo

```sh
npm install
npm run dev
```

Abre la dirección que muestra Vite. La aplicación utiliza Cloud Firestore del proyecto `bdplan-b` de forma predeterminada. Para pruebas aisladas, crea `.env.local` con `VITE_STORAGE_MODE=local`. El modo local no transfiere automáticamente sus datos a Firebase.

```sh
npm test
npm run build
npm run preview
```

## Firebase configurado

La inicialización está centralizada en `src/lib/firebase.js`. Inventario, tarjetas de Cajas y ventas utilizan esa misma conexión. Incluye la configuración web de `bdplan-b`; las variables `VITE_FIREBASE_*` pueden sustituirla. No es necesario crear `.env.local` para conectarse a este proyecto.

La base de datos utilizada es **Cloud Firestore**, no Realtime Database. El campo `databaseURL` se conserva en la configuración de Firebase, pero los datos de la aplicación se guardan en las colecciones de Firestore.

1. Abre el proyecto `bdplan-b` en Firebase Console, sección **Firestore Database**.
2. Verifica que exista la base `(default)`.
3. En **Reglas**, publica `firestore.rules` si aún no lo hiciste. Con Firebase CLI también puedes ejecutar `firebase deploy --only firestore:rules --project bdplan-b`.
4. Inicia la aplicación y registra un producto. Debe aparecer en `posProducts`; una venta crea un documento en `posSales`.

No necesitas crear las colecciones a mano. Los documentos se crean al registrar productos o ventas. Los datos anteriores de LocalStorage permanecen en su navegador y no se suben automáticamente.

Las variables `VITE_` son configuración pública del cliente. No agregues claves privadas de cuentas de servicio.

### Colecciones

Se respeta exactamente el esquema de permisos solicitado, sin agregar colecciones:

- `posProducts/{id}` con `kind: inventory`: nombre y cantidad entera de unidades.
- `posProducts/{id}` con `kind: offer`: lista de identificadores `productIds` y precio en centavos `priceCents`.
- `posSales/{id}`: nombre de la tarjeta al vender, identificadores de productos, total, importe QR, importe efectivo, método y hora local `HH:mm:ss`, sin guardar fecha.
- `costumeRegistrations` conserva sus permisos; la aplicación no la modifica.

Las reglas solicitadas permiten lectura y escritura públicas, sin autenticación. Antes de usar datos reales en un despliegue público, restringe los permisos a usuarios autorizados.

### Funcionamiento

Inventario no incluye precio de compra, siguiendo la última especificación. Cada venta descuenta una unidad de cada producto seleccionado. No se manejan porciones ni recetas. Los agotados muestran estado, contorno y sombreado rojo; sus opciones de venta quedan deshabilitadas. Al eliminar inventario, las combinaciones afectadas quedan bloqueadas hasta editarlas. La edición de tarjetas de venta y todas las eliminaciones piden confirmación.

QR y Efectivo registran la venta inmediatamente. Efectivo + QR exige que los dos importes sumen el total exacto. Los cálculos monetarios se hacen en centavos. Firestore registra venta y descuento de existencias juntos mediante una transacción, evitando vender la última unidad dos veces. El modo local usa Web Locks donde esté disponible para serializar operaciones entre pestañas.

Inicio muestra las ventas de la caja abierta. Cerrar cajas pide confirmación y elimina únicamente las ventas mostradas al abrir la confirmación; conserva inventario, existencias y tarjetas de venta. Las ventas nuevas que lleguen después de abrir esa confirmación se conservan. El cierre es manual, no automático al cambiar la fecha. Exportar PDF incluye todas las ventas, sus desgloses QR/efectivo, hora y totales. Las ventas conservan su nombre y precio original aunque después se edite o elimine un producto.

## Actualizar el sitio ya desplegado en Vercel

1. Sube estos cambios al repositorio conectado con Vercel.
2. Si el despliegue automático está activo, espera el nuevo despliegue de producción. Si no, despliega el commit nuevo desde Vercel.
3. La configuración de `bdplan-b` ya está incluida en el código. Si existen variables `VITE_FIREBASE_*` en **Settings → Environment Variables**, deben coincidir con `.env.example`. Usa `VITE_STORAGE_MODE=firestore` o deja esa variable sin definir; `local` desactiva Firestore.
4. Al modificar variables, vuelve a desplegar: no cambian el JavaScript de un despliegue anterior.
5. Framework **Vite**, build `npm run build`, salida `dist`.
6. Abre la web actualizada, registra un producto y verifica que aparezca en Firestore y en otro navegador o dispositivo.

No se modifican Vercel ni las reglas remotas automáticamente al compilar. El archivo `.env.example` sirve de referencia y Vercel no lo carga como configuración por sí solo.

## Referencias

- [Transacciones Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Variables de entorno Vite](https://vite.dev/guide/env-and-mode)
- [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite)
