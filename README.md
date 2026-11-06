# PLAN B · Administración de discoteca

Aplicación React + Vite con Inicio, Cajas e Inventario. Diseño oscuro adaptable a móvil, persistencia local o Firebase Firestore y reportes PDF completos con paginación.

## Desarrollo

```sh
npm install
npm run dev
```

Abre la dirección que muestra Vite. Sin variables Firebase funciona en modo local y almacena los datos únicamente en este navegador; el indicador de la interfaz lo señala. El modo local no transfiere automáticamente sus datos a Firebase.

```sh
npm test
npm run build
npm run preview
```

## Conectar Firebase

1. Crea una aplicación web en tu proyecto Firebase y habilita Cloud Firestore.
2. Copia `.env.example` a `.env.local` y completa los seis valores de la configuración web de Firebase.
3. Publica el contenido de `firestore.rules` en la pestaña Reglas de Firestore. Alternativamente, con Firebase CLI instalado, ejecuta `firebase deploy --only firestore:rules --project TU_PROJECT_ID`.
4. Reinicia Vite. La interfaz indicará Firebase conectado; las actualizaciones se reciben en tiempo real.

No se han incluido credenciales ni conectado un proyecto Firebase real. Las variables VITE_ forman parte del cliente: usa exclusivamente la configuración web de Firebase, nunca una clave de servicio privada.

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

## Vercel

1. Sube este proyecto a tu repositorio Git.
2. Importa el repositorio en Vercel con framework **Vite**.
3. Añade las variables de `.env.example` en Environment Variables.
4. Despliega. Build: `npm run build`; salida: `dist`. Se incluye `vercel.json`.
5. Si cambias las variables, crea un nuevo despliegue.

La aplicación está preparada para Vercel; no se ha publicado en ninguna cuenta.

## Referencias

- [Transacciones Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Variables de entorno Vite](https://vite.dev/guide/env-and-mode)
- [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite)
