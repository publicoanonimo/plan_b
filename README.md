# PLAN B · Administración de discoteca

Aplicación React + Vite con Inicio, Cajas, Inventario, Preparar bebidas y Usuarios. Diseño oscuro adaptable a móvil, persistencia local o Firebase Firestore y reportes PDF completos con paginación.

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

## Ventana de acceso y usuarios

- La primera ejecución crea la cuenta inicial `admin` con contraseña `admin`. Puede editarse desde **Usuarios**; no se vuelve a crear si se cambia su nombre o contraseña.
- El módulo **Usuarios**, en la barra inferior, permite crear, editar y eliminar cuentas. Al crear o editar se elige el rol: **Administrador** accede a todos los módulos; **Caja**, solo a Cajas; **Editor**, a Cajas e Inventario. Los módulos restantes se ocultan y cada sesión abre un módulo permitido. Los usuarios antiguos sin rol conservan acceso de Administrador; los nuevos tienen Caja como opción inicial. Solo Administrador gestiona usuarios y debe quedar al menos uno. Los cambios de rol se aplican al sincronizar el registro, cerrando cualquier formulario abierto. No se puede eliminar la cuenta de la sesión actual ni la última cuenta disponible.
- Cada cuenta tiene nombre, usuario único (sin distinguir mayúsculas) y contraseña. Las contraseñas nuevas requieren de 6 a 200 caracteres y confirmación. Al editar, dejarlas vacías conserva la contraseña actual.
- Se guardan verificadores PBKDF2-HMAC-SHA256 con 600.000 iteraciones y sal aleatoria por contraseña; nunca la contraseña en texto plano. Parámetros basados en [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2).
- Las cuentas se guardan en el documento **`posProducts/__access_users_v1`**, con tipo `access-users`, dentro de las reglas existentes de `posProducts`. Contiene el nombre, usuario, hash con sal de la contraseña, versión de sesión y fechas de cada cuenta. El tipo `access-users` se excluye del inventario, las ofertas y las recetas; los cambios se comparten entre dispositivos mediante Firestore.
- Crear, editar, eliminar e iniciar sesión utilizan exclusivamente ese documento autorizado. No se requieren otras colecciones, cambios de reglas, Firebase Authentication, Cloud Functions ni despliegues. En modo local explícito, las cuentas se guardan separadas del POS en `plan-b-users-v1`. La aplicación no cambia automáticamente a almacenamiento local si falla Firebase.
- Las escrituras usan transacciones en Firebase y bloqueos de almacenamiento en modo local cuando el navegador los admite. Las ediciones desactualizadas se rechazan para no sobrescribir cambios de otra ventana.
- El acceso recordado guarda únicamente el identificador de cuenta y su versión de sesión en `plan-b-device-access-v2`. Cambiar la contraseña o eliminar una cuenta invalida sus sesiones al sincronizarse el registro; las pestañas sin conexión deben reconectarse para recibir ese cambio. Las sesiones antiguas del acceso fijo requieren ingresar otra vez.
- **Salir**, en la cabecera de Inicio, elimina la sesión recordada. Si LocalStorage está bloqueado en modo Firebase, la sesión se conserva solo durante la visita. En modo local, el almacenamiento del navegador es necesario también para las cuentas.
- No se utiliza una API de login, cookies de sesión, `SESSION_SECRET` ni Firebase Authentication. Los roles se verifican en la interfaz y en las operaciones de gestión de usuarios del cliente. Este módulo mantiene el control visual del navegador: no sustituye autenticación de servidor ni protege el acceso directo a Firestore. Las reglas actuales permiten leer y modificar también el registro de usuarios sin autenticación; los verificadores con sal no convierten esas reglas públicas en un sistema de autorización.

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
- `posProducts/{id}` con `kind: offer`: lista de identificadores `productIds`, cantidades por producto `productQuantities` y precio en centavos `priceCents`.
- `posSales/{id}`: nombre de la tarjeta al vender, identificadores de productos, total, importe QR, importe efectivo, método y hora local `HH:mm:ss`, sin guardar fecha.
- `costumeRegistrations` conserva sus permisos; la aplicación no la modifica.

Las reglas solicitadas permiten lectura y escritura públicas, sin autenticación. Antes de usar datos reales en un despliegue público, restringe los permisos a usuarios autorizados.

### Funcionamiento

Inventario no incluye precio de compra, siguiendo la última especificación. Cada venta descuenta una unidad de cada producto normal seleccionado. Para los preparados, los botones +/− al crear o editar la tarjeta permiten definir cuántas unidades incluye el combo; cada venta por QR, efectivo o pago mixto descuenta esa cantidad. Las tarjetas muestran la cantidad y se bloquean si no hay existencias suficientes para el combo completo. Las tarjetas anteriores conservan una unidad por producto de forma predeterminada. No se manejan porciones ni recetas. Los agotados muestran estado, contorno y sombreado rojo; sus opciones de venta quedan deshabilitadas. Al eliminar inventario, las combinaciones afectadas quedan bloqueadas hasta editarlas. La edición de tarjetas de venta y todas las eliminaciones piden confirmación.

QR y Efectivo registran la venta inmediatamente. Efectivo + QR exige que los dos importes sumen el total exacto. Los cálculos monetarios se hacen en centavos. Firestore registra venta y descuento de existencias juntos mediante una transacción, evitando vender la última unidad dos veces. El modo local usa Web Locks donde esté disponible para serializar operaciones entre pestañas.

Inicio muestra las ventas de la caja abierta. Cerrar cajas pide confirmación y elimina únicamente las ventas mostradas al abrir la confirmación; conserva inventario, existencias y tarjetas de venta. Las ventas nuevas que lleguen después de abrir esa confirmación se conservan. El cierre es manual, no automático al cambiar la fecha. Exportar PDF incluye todas las ventas, sus desgloses QR/efectivo, hora y totales. Las ventas conservan su nombre y precio original aunque después se edite o elimine un producto.

La tarjeta azul **Caja**, antes de Total QR, permite establecer y actualizar un monto en bolivianos (incluido cero). Cada guardado reemplaza el monto anterior y actualiza una sola fila **Monto de caja** en Ventas, con método Caja. El monto solo se añade a Total de caja, sin afectar Total QR ni Total efectivo. El PDF usa el mismo cálculo. Al cerrar cajas se elimina el monto junto con los demás movimientos del cierre.

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

## Preparar bebidas

Inventario muestra los productos de menor a mayor cantidad. El módulo **Preparar bebidas**, disponible en la barra inferior, contiene el botón **Preparados** para crear tarjetas de recetas. Cada tarjeta guarda un nombre, una cantidad base de unidades preparadas y los ingredientes por tanda. Guardar o editar una tarjeta no descuenta existencias; permite configurar ingredientes agotados. Las tarjetas muestran nombre e ingredientes, y permiten editar o eliminar la receta.

Al pulsar una tarjeta se abre «¿Cuántas [nombre] desea preparar?». Los controles +/− cambian la cantidad por tandas completas y conservan la cantidad base como mínimo. **Preparar** crea una entrada en inventario y descuenta los ingredientes proporcionales en una sola transacción. Si falta stock, no guarda ni descuenta nada.

Editar una preparación desde inventario abre el selector de cantidad en Preparar bebidas. Aumentar descuenta ingredientes adicionales y reducir devuelve la diferencia. Se conservan las unidades ya vendidas y se impide reducir por debajo de ellas. Cada preparación conserva su receta original aunque después se edite o elimine la tarjeta. Las preparaciones anteriores también pueden editarse usando como tanda su cantidad original.

Eliminar una preparación pide confirmación y devuelve todos los ingredientes registrados a sus respectivos productos; si un ingrediente fue eliminado, se restaura con su nombre y las unidades devueltas. Eliminar solamente la tarjeta de receta conserva las preparaciones existentes. Recetas y preparaciones utilizan `posProducts`, sin colecciones ni reglas adicionales. El modo local mantiene las mismas operaciones.

Cajas organiza las tarjetas en contenedores: **Preparados** incluye los preparados y las jarras o mezclables; **Combo de botellas** contiene las tarjetas de dos productos restantes; **Unitarios** contiene las de un producto restante. Las tarjetas de más productos se conservan en **Otros combos**, que aparece solo cuando tiene tarjetas, antes de Unitarios.

Las tarjetas de Cajas permiten **Añadir foto**, **Tomar foto**, **Cambiar foto** y **Quitar foto** al crearlas o editarlas. La cámara depende del dispositivo y navegador. Se admiten JPG, PNG, WebP y AVIF de hasta 20 MB, convertidos en el navegador a JPEG de hasta 640 píxeles por lado y 280 KiB incluyendo base64. La foto se almacena en el campo `photo` del mismo documento `posProducts` de la tarjeta, sin Firebase Storage ni archivos externos. Se comprueba también un presupuesto de 900 KiB para los datos de la tarjeta, dejando margen respecto al límite de 1 MiB de Firestore.

Editar precio o productos conserva la foto. Reemplazarla o quitarla solo se aplica al guardar y confirmar; cancelar conserva la imagen anterior. Eliminar la tarjeta elimina también el campo de foto. Las ventas y reportes no guardan copias de la imagen. En modo local, la foto se guarda con la tarjeta en LocalStorage y queda sujeta a la capacidad disponible del navegador. La persistencia en Firestore permite verla en otros dispositivos conectados al mismo proyecto.
