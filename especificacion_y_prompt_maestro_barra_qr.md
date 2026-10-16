# Especificación Técnica y Prompt Maestro: Plataforma SaaS de Barra QR para Boliches

Documento maestro de arquitectura, reglas de negocio validadas, esquema de datos y **Prompt Maestro** listo para construir paso a paso la plataforma de venta y canje parcial de bebidas en boliches con tolerancia a fallos nocturnos.

---

## 1. Arquitectura SaaS de Alta Disponibilidad (Anti-Saturación Nocturna)

El sistema opera bajo un modelo **SaaS Multi-Tenant Centralizado de Alto Rendimiento**: una base de datos PostgreSQL transaccional única (con aislamiento lógico estricto por `tenant_id`, pool de conexiones PgBouncer en Supabase/Neon) combinada con una capa de caché en Redis (Upstash) para el catálogo de productos.

| Plano del Sistema | Dominio / Ruta | Función Principal | Estrategia Anti-Caídas |
| :--- | :--- | :--- | :--- |
| **Control Plane (Super-Admin)** | `admin.tuplataforma.com` o `/superadmin` | Gestión de boliches, abonos mensuales, períodos de prueba (trial), % de comisión opcional y métricas globales. | Totalmente aislado de los picos de consumo nocturnos. |
| **Storefront del Cliente** | `[slug].tuplataforma.com` o `/[slug]` | Menú móvil ultra-rápido, carrito, login con evasión de WebView, checkout directo con Mercado Pago y descarga de ticket QR. | Catálogo cacheado en Redis (<20ms). Evasión de bloqueos en navegadores in-app (Instagram/TikTok). |
| **Barra & Scanner Plane** | `[slug].tuplataforma.com/barra` o `/[slug]/barra` | Lectura de QR por cámara en <300ms, modal de despacho con saldo dinámico, sustitución por falta de stock y botón "Deshacer 60s". | Bloqueo pesimista (`SELECT ... FOR UPDATE`) contra doble canje simultáneo y logs de auditoría por bartender. |
| **Admin del Boliche** | `[slug].tuplataforma.com/admin` o `/[slug]/admin` | Gestión de tragos, stock en vivo, conexión Mercado Pago (OAuth / Manual), cierre de caja y arqueo nocturno con *Breakage*. | Consultas analíticas indexadas sin bloquear la tabla transaccional. |

### Stack Tecnológico Definido
* **Framework Web:** Next.js 14+ (App Router), TypeScript en modo estricto.
* **Estilos e Interfaz:** Tailwind CSS + shadcn/ui. White-label dinamizado mediante CSS Variables (`primary`, `secondary`, `background`, logos y tipografías por boliche).
* **Base de Datos & ORM:** PostgreSQL con Prisma ORM, integrado con PgBouncer para absorber miles de conexiones concurrentes en picos (01:30 AM a 04:30 AM).
* **Capa de Velocidad e Idempotencia:** Redis (Upstash) para caché de cartas de tragos y control estricto de concurrencia/rate-limiting en webhooks y escaneos de barra.
* **Autenticación Híbrida Anti-Fricción:** Supabase Auth o NextAuth con Google OAuth / Apple Login con detección de WebViews in-app + fallback garantizado mediante DNI y WhatsApp / SMS (sin depender de confirmación de email).
* **Pasarela de Pagos:** Mercado Pago SDK v2 oficial. Vinculación mediante **Mercado Pago OAuth (Connect en 1 clic)** con soporte opcional de carga manual de tokens y configuración de `marketplace_fee` (% de comisión de plataforma) configurable por boliche.
* **Lector y Generador de QR Offline:** Generación en `<canvas>` HTML5 con descarga automática en `.png` + integración con **Web Share API** ("Guardar en Fotos") + `localStorage`/`IndexedDB` para consumo 100% offline del cliente.

---

## 2. Reglas de Negocio Críticas del Flujo Operativo

### A. Login sin Fricción y Detección de In-App Browsers
1. Cuando el cliente escanea el QR en la mesa o barra, entra a la tienda virtual.
2. Si el sistema detecta que está dentro de un navegador embebido (Instagram, TikTok o escáner nativo que bloquea Google OAuth con error 403 `disallowed_useragent`), intenta abrir automáticamente el navegador nativo (Safari en iOS / Chrome en Android).
3. Si el usuario permanece en el navegador embebido, el sistema no muestra errores: ofrece directamente el **Login Rápido por DNI + WhatsApp / SMS**.
4. Al primer login histórico, el usuario completa únicamente su **DNI y Nombre Completo**. Su sesión se mantiene activa por 90 días en ese dispositivo para que en futuras compras no vuelva a ingresar datos.

### B. Pago Directo, Comisión Flexible y Ticket QR Offline
1. Al confirmar el pedido, el backend genera la preferencia de Mercado Pago asociada a las credenciales del boliche (`access_token` propio vía OAuth).
2. Si el Super-Admin configuró un % de comisión para ese boliche, se aplica automáticamente mediante el parámetro `marketplace_fee`. Si el boliche paga abono fijo, la recaudación va 100% directo a su cuenta.
3. El pago se aprueba **exclusivamente mediante Webhook oficial** (`/api/webhooks/mercadopago/[tenantSlug]`), verificando la firma criptográfica `x-signature` y consultando el estado `approved` de forma idempotente en la API de Mercado Pago.
4. Al aprobarse:
   * Se genera el **Ticket QR Único de la Orden** firmado con `HMAC-SHA256`.
   * Se muestra en pantalla un banner destacado: *"¡Guardá tu QR en fotos para poder canjear sin conexión en la barra!"*.
   * Se ejecuta la auto-descarga del ticket en formato `.png` (alta resolución y contraste) y se habilita el botón "Guardar en Fotos / Compartir" mediante la Web Share API.
   * Se guarda la orden y el QR en `localStorage` para permitir su visualización sin datos móviles.

### C. QR Dinámico con Despacho Parcial ("QR Billetera de Orden")
1. El código QR nunca muta ni cambia a lo largo de la noche. Contiene un token criptográfico inalterable (`order_id` + `tenant_id` + `signature`).
2. Al ser escaneado por el bartender:
   * El sistema verifica la firma HMAC.
   * Muestra en pantalla el **saldo disponible real** de cada ítem (`quantity_purchased - quantity_redeemed`).
   * Ejemplo: Si compró 3 Fernet y 2 Cervezas, y ya retiró 1 Fernet, la pantalla muestra disponible: `2x Fernet` y `2x Cerveza`.
3. El bartender selecciona qué cantidades entrega en ese momento (con botones `+ / -` o "Entregar Todo") y presiona "Confirmar Entrega".
4. La transacción en PostgreSQL bloquea los registros (`SELECT ... FOR UPDATE`), descuenta las unidades y registra el log de entrega con ID del bartender y timestamp.
5. El QR sigue sirviendo para retiros posteriores hasta que todos los ítems lleguen a saldo 0 (estado `DEPLETED`) o expire la orden.

### D. Sustitución Obligatoria por Falta de Stock en Plena Noche
1. Si un cliente compró un trago y al momento del canje en barra el boliche se quedó sin insumos (quiebre de stock de ese producto):
   * La interfaz de barra le permite al bartender marcar el ítem como "Sustituido por falta de stock".
   * **Regla estricta:** El sistema exige y valida que el trago de reemplazo tenga **exactamente el mismo valor monetario** (o menor con consentimiento) que el trago original.
   * En el log de auditoría queda asentado qué producto original se canjeó, cuál fue el producto entregado en su lugar, quién fue el bartender y la hora exacta.

### E. Expiración de Órdenes y Promos con Horario Límite (Breakage)
1. **Vencimiento General por Noche:** El administrador del boliche configura la hora de vencimiento de las compras (por defecto: `07:00 AM` del día siguiente). Pasada esa hora, las órdenes activas no consumidas pasan a estado `EXPIRED` y no pueden ser canjeadas.
2. **Promos con Horario Límite:** Los boliches pueden crear tragos especiales con hora máxima de retiro (ej. "Promo Antes de las 02:30 AM"). Si el cliente llega a la barra después de las 02:30 AM, el scanner bloquea el canje de ese ítem indicando "Promoción vencida".
3. **Pérdida sin reclamo:** Los tragos vencidos no son reembolsables y quedan a favor del boliche.

### F. Botón de Deshacer en Barra (Tolerancia a Error Humano de 60s)
1. En caso de que el bartender marque por error cantidades incorrectas (ej. marcó 3 entregas en vez de 1), en la pantalla de barra permanece visible una alerta con botón **"Deshacer entrega (60s)"**.
2. Al presionarlo dentro de ese minuto, el sistema revierte atómicamente la última entrega, restaura el saldo disponible de la orden y marca el registro de redención como anulado (`is_reverted = true`).

### G. Buscador por DNI (Estrictamente Solo Lectura)
1. La barra y la caja cuentan con una pestaña de consulta por DNI.
2. Permite buscar el DNI del cliente para ver sus compras, qué tragos retiró y qué saldo tiene pendiente.
3. **Restricción de seguridad:** Esta vista TIENE BLOQUEADO cualquier tipo de canje. No existe botón de entrega y el backend rechaza cualquier solicitud de despacho que no provenga del escaneo del token criptográfico del QR.

### H. Cierre de Noche y Métricas de "Breakage"
1. El panel de administración del boliche incluye un reporte de **Arqueo Nocturno**:
   * Total de ventas recaudadas vía Mercado Pago ($).
   * Total de unidades efectivamente entregadas en barra.
   * Total de unidades no canjeadas / vencidas (**Breakage**), calculando la ganancia neta directa que quedó para el boliche sin costo de mercadería despachada.

---

## 3. Esquema de Base de Datos (PostgreSQL con Prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  CUSTOMER
  BARTENDER
  CLUB_ADMIN
  SUPER_ADMIN
}

enum OrderStatus {
  PENDING
  ACTIVE
  DEPLETED
  EXPIRED
  CANCELLED
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELLED
}

model Tenant {
  id                        String              @id @default(uuid())
  slug                      String              @unique
  name                      String
  domain                    String?             @unique
  themeConfig               Json                @default("{}") // colores, logo, banner
  
  // Credenciales Mercado Pago
  mpSellerId                String?
  mpAccessTokenEnc          String?
  mpPublicKey               String?
  mpWebhookSecret           String?
  
  // Reglas de negocio y monetización
  feePercentage             Decimal             @default(0.0) @db.Decimal(5, 2) // % comisión opcional
  subscriptionStatus        SubscriptionStatus  @default(TRIAL)
  trialEndsAt               DateTime?
  subscriptionPriceMonthly  Decimal             @default(0.0) @db.Decimal(10, 2)
  defaultExpirationHour     String              @default("07:00") // Hora de cierre nocturno
  isActive                  Boolean             @default(true)
  createdAt                 DateTime            @default(now())
  updatedAt                 DateTime            @updatedAt

  users                     User[]
  products                  Product[]
  orders                    Order[]

  @@index([slug])
}

model User {
  id              String           @id @default(uuid())
  tenantId        String?
  authProviderId  String?          @unique
  email           String?
  phone           String?
  dni             String?
  fullName        String?
  role            Role             @default(CUSTOMER)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  tenant          Tenant?          @relation(fields: [tenantId], references: [id])
  orders          Order[]
  redemptions     RedemptionLog[]

  @@index([dni])
  @@index([phone])
  @@index([tenantId, role])
}

model Product {
  id                  String           @id @default(uuid())
  tenantId            String
  category            String           // "Tragos", "Cervezas", "Combos", "Sin Alcohol"
  name                String
  description         String?
  price               Decimal          @db.Decimal(10, 2)
  imageUrl            String?
  stockAvailable      Int              @default(9999)
  redeemDeadlineTime  String?          // Ej: "02:30" (horario límite si es promo)
  isActive            Boolean          @default(true)
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  tenant              Tenant           @relation(fields: [tenantId], references: [id])
  orderItems          OrderItem[]
  substitutions       RedemptionLog[]  @relation("SubstitutedProduct")

  @@index([tenantId, isActive])
  @@index([tenantId, category])
}

model Order {
  id              String           @id @default(uuid())
  tenantId        String
  userId          String
  mpPreferenceId  String?
  mpPaymentId     String?          @unique
  status          OrderStatus      @default(PENDING)
  qrTokenHash     String?          @unique
  totalAmount     Decimal          @db.Decimal(10, 2)
  feeAmount       Decimal          @default(0.0) @db.Decimal(10, 2)
  expiresAt       DateTime
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  tenant          Tenant           @relation(fields: [tenantId], references: [id])
  user            User             @relation(fields: [userId], references: [id])
  items           OrderItem[]
  redemptions     RedemptionLog[]

  @@index([tenantId, status])
  @@index([userId])
  @@index([qrTokenHash])
}

model OrderItem {
  id                  String           @id @default(uuid())
  orderId             String
  productId           String
  productNameSnapshot String
  unitPrice           Decimal          @db.Decimal(10, 2)
  quantityPurchased   Int
  quantityRedeemed    Int              @default(0)
  redeemDeadlineAt    DateTime?        // Fecha y hora exacta límite si era promo
  createdAt           DateTime         @default(now())

  order               Order            @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product             Product          @relation(fields: [productId], references: [id])
  redemptions         RedemptionLog[]

  @@index([orderId])
}

model RedemptionLog {
  id                    String      @id @default(uuid())
  orderId               String
  orderItemId           String
  bartenderUserId       String
  quantityDelivered     Int
  substitutedProductId  String?
  isReverted            Boolean     @default(false)
  revertedAt            DateTime?
  revertedByUserId      String?
  redeemedAt            DateTime    @default(now())

  order                 Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItem             OrderItem   @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  bartender             User        @relation(fields: [bartenderUserId], references: [id])
  substitutedProduct    Product?    @relation("SubstitutedProduct", fields: [substitutedProductId], references: [id])

  @@index([orderId])
  @@index([orderItemId])
  @@index([bartenderUserId])
}
```

---

## 4. Prompt Maestro (Listo para el Asistente de IA)

```markdown
# ROL Y OBJETIVO
Actuá como un Arquitecto de Software Principal y Desarrollador Full-Stack Senior especialista en sistemas transaccionales de alta concurrencia, fintech (Mercado Pago) y aplicaciones PWA Mobile-First.
Vamos a desarrollar la plataforma SaaS White-Label de venta y canje parcial de bebidas para boliches con código QR de saldo dinámico en barra.

# REGLAS DE NEGOCIO INQUEBRANTABLES (HARD CONSTRAINTS)
1. **Multi-Tenant con Aislamiento Estricto:**
   - La base de datos es PostgreSQL multi-tenant. Toda consulta operativa debe filtrar obligatoriamente por `tenant_id`. Las credenciales de cobro y temas visuales se resuelven dinámicamente según el subdominio o parámetro de ruta del boliche (`/[tenantSlug]`).
2. **Login Anti-Fricción con Evasión de WebViews:**
   - Detectar si el usuario abre desde Instagram/TikTok. Intentar apertura en navegador del sistema (Safari/Chrome). Si continúa en WebView, habilitar login por DNI y WhatsApp/SMS sin requerir Google OAuth.
   - En el primer ingreso solicitar DNI y Nombre Completo por única vez. Mantener sesión por 90 días.
3. **Mercado Pago Directo y Seguro:**
   - Soportar vinculación por Mercado Pago OAuth (Connect) y carga manual de credenciales por boliche. Cobro directo a la cuenta del boliche con `marketplace_fee` opcional configurable en SuperAdmin.
   - Idempotencia estricta en `/api/webhooks/mercadopago/[tenantSlug]`. Ninguna orden se aprueba sin validación de `x-signature` y estado `approved` directo de la API de Mercado Pago.
4. **QR Único Reutilizable con Canje Parcial:**
   - Generar un único QR firmado con HMAC-SHA256 (`orderId + tenantId + signature`).
   - El QR no cambia. En barra muestra el saldo disponible (`quantity_purchased - quantity_redeemed`).
   - El despacho en barra usa transacciones serializables (`SELECT ... FOR UPDATE`) para prevenir doble canje concurrente.
5. **Independencia de Internet para el Cliente:**
   - Renderizar ticket en HTML5 `<canvas>` con auto-descarga a `.png`, botón con Web Share API ("Guardar en Fotos") y almacenamiento en `localStorage`. Cartel prominente: "Guardá tu QR en fotos para poder canjear sin conexión en la barra".
6. **Sustitución por Falta de Stock:**
   - Si se acaba el stock de un producto ya comprado, el bartender puede sustituirlo por otro producto de **idéntico precio**, dejando registro en `RedemptionLog`.
7. **Expiración de QR y Promos con Horario:**
   - Cada boliche define hora de expiración general (ej. 07:00 AM).
   - Tragos promo pueden tener horario de canje anticipado (ej. antes de las 02:30 AM). Si expiran, quedan como ganancia del boliche (Breakage).
8. **Botón Deshacer Entrega (60 segundos):**
   - El bartender puede revertir un despacho erróneo dentro de los 60 segundos posteriores a la entrega.
9. **Buscador por DNI Solo Lectura:**
   - La búsqueda por DNI permite ver órdenes y saldos, pero PROHÍBE el canje manual. El canje exige siempre el escaneo del token criptográfico del QR.
10. **Panel de Arqueo y Cierre de Noche:**
    - Reporte nocturno de Ventas ($), Tragos despachados y Tragos vencidos no canjeados (Breakage).
```

---

## 5. Estrategia de Conectividad y Resiliencia en Barra

1. **Requisito de Conectividad en el Boliche:**
   * La barra debe contar con una red Wi-Fi exclusiva para el personal (con SSID oculto y separada de la red pública de los clientes) o router 4G con chip dedicado para los dispositivos de los bartenders.
2. **Manejo de Micro-Cortes de Red:**
   * Si la tablet de barra experimenta un micro-corte de conexión al momento de escanear, el cliente no pierde su QR ni su saldo. La UI de barra implementa reintentos automáticos con feedback visual claro (alerta ámbar de reconexión).
3. **Preparado para Servidor Local:**
   * La arquitectura desacoplada de la API permite, en etapas avanzadas o boliches de ultra-alta concurrencia subterráneos sin cobertura celular, desplegar un nodo local (mini-PC o Raspberry Pi) que sincronice con la nube al inicio y fin de la noche.

---

## 6. Control de Versiones y Despliegue Continuo (CI/CD en Vercel)

* **Repositorio Oficial:** [https://github.com/Manzaniita/barraonline](https://github.com/Manzaniita/barraonline) (rama principal `main`).
* **Hosting del Frontend & BFF:** Vercel conectado directamente al repositorio de GitHub.
* **Base de Datos de Producción:** PostgreSQL administrado (Supabase o Neon) con connection pooler PgBouncer habilitado.
* **Regla de Flujo Operativo:** Al completar y verificar cada fase de desarrollo, se realiza un `commit` y `git push origin main` para disparar el despliegue automático e instantáneo en Vercel.

---

## 7. Plan de Implementación por Fases

Avanzaremos paso a paso, validando cada fase antes de pasar a la siguiente:

```
[Fase 1: Cimientos & Datos]
├── Inicializar Next.js 14+ con TypeScript, Tailwind y shadcn/ui
├── Configurar Prisma ORM con el esquema PostgreSQL completo
├── Utilidades de Criptografía (Firma HMAC-SHA256 y verificación de QR)
└── Verificación: Pruebas unitarias de firmado/verificación de tokens y esquema

[Fase 2: Autenticación Híbrida & Tienda White-Label]
├── Detección de In-App Browsers y fallback DNI + WhatsApp
├── Formulario de primer ingreso (DNI + Nombre) y persistencia de sesión
├── Tienda móvil (`/[tenantSlug]`): catálogo cacheado en Redis, categorías y carrito
└── Verificación: Simulación de catálogo con CSS Variables dinámicas por tenant

[Fase 3: Pasarela Mercado Pago & Webhooks Idempotentes]
├── Integración de Checkout Pro con credenciales dinámicas de cada tenant
├── Configuración de fee de plataforma opcional (`marketplace_fee`)
├── Webhook seguro (`/api/webhooks/mercadopago/[tenantSlug]`) con validación `x-signature`
└── Verificación: Mock de webhook de MP con aprobación y activación de orden en DB

[Fase 4: Ticket QR Offline & Experiencia Móvil]
├── Generación de Ticket en `<canvas>` con datos de orden y QR de alto contraste
├── Auto-descarga a `.png` + botón con Web Share API ("Guardar en Fotos")
├── Persistencia en `localStorage` y pantalla "Mis Tragos" offline-ready
└── Verificación: Validación visual del ticket descargado y lectura del QR sin conexión

[Fase 5: Módulo de Barra & Scanner Inteligente]
├── Lector de cámara rápido (`/[tenantSlug]/barra`) con acceso rol BARTENDER
├── Modal de despacho con saldo parcial dinámico y botones `+ / -`
├── Sustitución por falta de stock (validación de igual valor monetario)
├── Botón "Deshacer entrega (60 segundos)" y registro en `RedemptionLog`
├── Buscador por DNI 100% de Solo Lectura (sin botón de canje)
└── Verificación: Transacción `FOR UPDATE` contra doble canje concurrente y reversión

[Fase 6: Administración, Mercado Pago OAuth & Cierre de Noche]
├── Panel Admin del Boliche (`/[tenantSlug]/admin`): Tragos, precios, stock en vivo
├── Conexión Mercado Pago OAuth (Connect en 1 clic) + fallback manual
├── Arqueo y Cierre de Noche con cálculo de Breakage (tragos pagados no retirados)
├── Panel Super-Admin (`/superadmin`): Alta de boliches, abonos, free trial y comisiones
└── Verificación: Flujo de extremo a extremo desde la compra hasta el arqueo final
```
