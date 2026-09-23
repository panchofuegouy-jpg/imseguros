# Prompt maestra — Rediseño de Isgleas Seguros

> Copiá todo lo que está debajo de la línea y pegalo en una sesión nueva de Claude Code abierta en `~/Desarrollo/imseguros`.

---

## Rol y objetivo

Sos un diseñador de producto senior y un ingeniero frontend senior trabajando juntos. Vas a rediseñar **Isgleas Seguros**, el sistema interno de gestión de una corredora de seguros en Uruguay (Next.js 15 + React 18 + Tailwind v4 + shadcn/Radix + Supabase + Recharts).

**Quién lo usa:** la dueña de la corredora, una señora de más de 55 años. No es técnica, no sabe usar bien el sistema hoy y necesita poder usarlo **sola, sin que nadie le explique**. Trabaja en una computadora de escritorio y a veces en el celular. Secundariamente lo usan empleados/as y los clientes finales (portal `/cliente`).

**Qué queremos lograr:**
1. Que se vea como un producto **de lujo, sobrio y propio**, no como otra plantilla de shadcn en modo oscuro. Pensá en una firma patrimonial o una banca privada: calma, espacio, tipografía cuidada, color con intención.
2. Que sea **obvio de usar** para alguien mayor: letra grande, contraste alto, palabras simples, una acción clara por pantalla, y ayuda integrada en la propia app.
3. Que las cosas **funcionen bien**: arreglar los bugs conocidos (lista abajo) y no romper nada de lo que ya funciona.

Estas dos metas no compiten: el lujo de verdad es claridad + espacio + detalle, no efectos.

## Cómo quiero que trabajes

- **Primero investigá y planificá, después tocá código.** Entrá en modo plan. Leé el código, levantá la app (`npm run dev`), sacá capturas de cada pantalla con las herramientas de navegador y armá el diagnóstico antes de proponer nada.
- **Hay 19 archivos con cambios sin commitear** (ver `git status`). Antes de empezar, mostrame qué son y preguntame si los commiteo como están.
- Trabajá **por fases** (abajo). Al terminar cada fase: `npm run build` y `npm run lint` sin errores nuevos, capturas de antes/después, un commit por fase, y me mostrás el resultado antes de seguir.
- **No cambies lógica de negocio, esquema de base de datos, rutas de API, OCR ni integración con n8n** salvo que sea para arreglar un bug de la lista y me lo digas. Si algo del diseño requiere una migración, proponela y esperá mi OK.
- Todo el texto de la interfaz en **español rioplatense (Uruguay)**, con "vos" o impersonal, nunca "tú". Montos en pesos/dólares con formato uruguayo (`$ 12.500`, `U$S 1.200`). Fechas como "15 de octubre" o `15/10/2026`, nunca ISO.
- Hacé los cambios de estilo **desde tokens y componentes base**, no parcheando clases en cada página.

## Lo que existe hoy (contexto que ya relevé)

- Shell: `components/admin-layout.tsx` (sidebar de 160px, ítems en `text-xs`, fondo casi negro `#121a1b`), `components/client-layout.tsx` (portal del cliente).
- Tokens: `app/globals.css` con `@theme` de Tailwind v4. Color de marca petróleo `#25595e`. El logo (`public/nuevo-logo-isgleas-seguros.webp`) es serif clásico con verde azulado — es la mejor pista de la identidad.
- Pantallas admin: Dashboard (`app/admin/page.tsx`), Clientes y ficha de cliente (`components/client-detail-page-content.tsx`, ~1100 líneas), Pólizas, Renovaciones/Por vencer (`components/policies-near-expiration-content.tsx`, ~1200 líneas, tiene un CRM de estados de renovación), Facturación, Siniestros, Cobranza (con importador), Cumpleaños. Carga masiva de pólizas con OCR (`components/multi-file-policy-uploader.tsx`).
- Portal cliente: `app/cliente/*`. Auth: login, recuperar contraseña, cambio forzado en primer login.
- Aseguradoras: BSE, SURA, Porto, Mapfre, Sancor.

## Problemas conocidos a arreglar

**Visual / tokens**
- `app/globals.css`: el tema claro está roto. `--color-background` es oscuro (`#1b2324`) pero `--color-foreground` también es oscuro; `muted`, `border` e `input` son casi blancos. Hoy solo se ve bien por accidente en oscuro. `ThemeProvider` usa `defaultTheme="system"`.
- Tipografía inconsistente: los tokens declaran `Outfit` pero `app/layout.tsx` carga Geist por un `<style>` inyectado. Unificar con `next/font`.
- El número "Por vencer" del dashboard usa `text-destructive`, que en oscuro es un rojo oscuro casi invisible sobre la card (ver captura: el 73 no se lee).
- Colores de gráficos puestos a mano (`#0088FE`, `#FFBB28`…) en `components/charts/*`, sin relación con la marca.
- Navegación en `text-xs`, títulos de card en `text-sm`, descripciones en `text-xs`: todo demasiado chico para la usuaria. Hay `text-xs` en ~37 archivos.
- "Pólizas" y "Renovaciones" usan el mismo ícono. El ítem activo se calcula con `pathname === href`, así que en subpáginas (`/admin/clientes/123`, `/admin/polizas/por-vencer`) la sección padre no queda marcada.
- En desarrollo el indicador de Next.js ("N") tapa el botón "Cerrar sesión" (ajustar `devIndicators` en `next.config.mjs` y, sobre todo, no poner acciones importantes en esa esquina).

**Funcionales**
- Dashboard: la torta "Distribución por aseguradora" se calcula con `.limit(100)` (`app/admin/page.tsx:19`), así que los porcentajes son de 100 pólizas y no de las ~1.480. Hacer el conteo en la base (group by `company_id`) y no traer filas.
- Dashboard: "Actividad reciente" es texto fijo ("Sistema iniciado correctamente…"). Reemplazar por actividad real o quitarlo.
- Dashboard: el gráfico "Nuevos clientes por mes" arranca con un pico de ~400 que es la importación inicial y aplasta el resto de la curva. Tratar ese primer mes aparte o empezar después de la carga inicial.
- `app/dashboard/page.tsx` nunca pone `loading` en `false`; revisarlo.
- Existe una carpeta `src/` con un `app/`, `lib/` y `middleware.ts` viejos que parecen duplicados de la raíz. Verificá si algo los usa y, si no, proponé borrarlos (no los borres sin preguntar).
- Recorré cada pantalla y anotá todo lo que esté roto, vacío o confuso. Agregalo a esta lista en tu plan.

## Fase 0 — Auditoría (sin tocar código)

Entregá un documento `docs/AUDITORIA_UX.md` con:
- Captura de cada pantalla (escritorio y celular 390px).
- Por pantalla: para qué la usa la dueña, cuál es la acción principal, qué la confunde, qué está roto.
- Las 5 tareas más frecuentes de la usuaria (mi hipótesis: ver qué pólizas vencen y llamar al cliente, buscar un cliente, cargar una póliza nueva, ver quién debe plata, saludar cumpleaños). Confirmalas mirando el código y preguntándome.

## Fase 1 — Guía de estilo (Style Guide)

Creá la identidad y documentala en dos lugares:
1. `docs/GUIA_DE_ESTILO.md` — la referencia escrita.
2. Una página viva `/admin/guia` (solo admin) que muestre todos los tokens y componentes renderizados de verdad, para verificar visualmente y para que futuras sesiones de IA la respeten.

Dirección de diseño (proponé 2 variantes en capturas o una página de comparación y dejame elegir antes de aplicar):

- **Concepto:** "banca privada uruguaya": cálido, sereno, confiable. Nada de neón, gradientes violetas ni glassmorphism.
- **Tema por defecto: claro** (fondo marfil/hueso cálido, no blanco puro). Para una persona mayor el texto oscuro sobre fondo claro se lee mejor. Mantener un modo oscuro bien hecho como opción, no como default.
- **Color:** petróleo `#25595e` como color de marca (acciones principales, navegación activa). Un acento metálico sobrio (latón/oro viejo) usado con mucha moderación (detalles, el logo, estados destacados). Neutros cálidos. Colores semánticos claros y **siempre acompañados de ícono + palabra**, nunca solo color: vencida (rojo), por vencer (ámbar), vigente (verde), pendiente (gris azulado). Todo con contraste **WCAG AA como mínimo, AAA en texto de cuerpo**.
- **Tipografía:** una serif elegante para títulos y cifras grandes, que dialogue con el logo (ej. Fraunces, Cormorant Garamond, Playfair Display o Instrument Serif; elegí y justificá) + una sans muy legible para la interfaz (ej. Inter, Geist o Figtree). Cuerpo **mínimo 16px, ideal 17–18px**; nada bajo 14px en ningún lado. Cifras con `tabular-nums`.
- **Escala:** tipográfica, de espacios (base 4px), radios, sombras suaves y cálidas, elevaciones. Todo como tokens en `app/globals.css`.
- **Tamaños de toque:** botones y filas clickeables de al menos 44px de alto (48px en celular).
- **Íconos:** lucide, trazo consistente, siempre con texto al lado en la navegación y en acciones importantes. Un ícono distinto por sección.
- **Movimiento:** ya existe una escala de easing en `globals.css`; conservala. Transiciones suaves y cortas, respetar `prefers-reduced-motion`.
- **Gráficos:** paleta derivada de la marca, leyendas en texto grande, números escritos además del gráfico. Si un gráfico no ayuda a decidir algo, cambialo por una cifra o una lista.
- **Tono de voz:** frases cortas, verbos concretos, sin jerga técnica. "Guardar cliente" no "Submit"; "No se pudo guardar. Revisá el teléfono." no "Error 400". Definí un mini glosario (ej. "Renovaciones" → "Pólizas por vencer").

## Fase 2 — Tokens y componentes base

- Reescribir `app/globals.css` con los tokens nuevos (claro + oscuro correctos).
- Cargar las fuentes con `next/font` en `app/layout.tsx` y quitar el `<style>` inyectado.
- Actualizar variantes de `components/ui/*` (button, card, input, select, table, badge, dialog, sheet, tabs, sonner) para que tengan los tamaños y estilos nuevos. Crear componentes propios en `components/brand/` para patrones que se repiten: `PageHeader`, `StatCard`, `StatusBadge` (estado de póliza con ícono + texto), `EmptyState` (que enseña qué hacer), `SectionCard`, `MoneyText`, `DateText`, `HelpTip`.

## Fase 3 — Estructura y navegación

- Sidebar más ancha (~240px), texto de navegación de 16px, logo con aire, secciones agrupadas con nombres simples (ej. **Inicio · Clientes · Pólizas · Por vencer · Cobranza · Siniestros · Facturación · Cumpleaños**). El nombre de la usuaria y "Cerrar sesión" en un lugar claro, no tapado.
- Estado activo que funcione en subpáginas.
- Barra superior con **buscador global** (cliente por nombre, cédula o número de póliza) siempre visible: es lo que más va a usar.
- Botón principal global "+ Nuevo" (cliente / póliza) accesible desde cualquier pantalla.
- Migas de pan simples en pantallas de detalle y botón "Volver" grande.
- En celular: navegación inferior con las 4–5 secciones principales en vez de solo un menú hamburguesa.

## Fase 4 — "Inicio": el dashboard que le dice qué hacer hoy

Reemplazar el dashboard de métricas genéricas por una pantalla de **tareas del día**, saludándola por su nombre ("Buen día, …"):
- **Hoy tenés que…**: pólizas que vencen en los próximos 7 días sin gestionar (con botón de WhatsApp/llamar), clientes que cumplen años hoy (con botón para saludar), cobros atrasados, siniestros abiertos. Cada ítem es una fila grande con una acción clara.
- Debajo, pocas cifras grandes y comprensibles (clientes, pólizas vigentes, por vencer este mes, cartera por aseguradora con el cálculo corregido).
- Si todo está al día, un mensaje tranquilo ("Todo al día. No hay vencimientos esta semana.").

## Fase 5 — Pantalla por pantalla

Aplicar la guía a todas las pantallas (admin, portal cliente, login, recuperar contraseña). Para cada una: una acción principal evidente, tablas legibles (filas altas, columnas mínimas, detalle al hacer clic) que en celular se vuelvan tarjetas, formularios en pasos cuando son largos (crear cliente, cargar póliza), confirmaciones en lenguaje humano y opción de deshacer cuando se pueda. Los componentes enormes (`client-detail-page-content.tsx`, `policies-near-expiration-content.tsx`) dividirlos en subcomponentes mientras los rediseñás, sin cambiar su comportamiento.

## Fase 6 — Ayuda integrada: que aprenda a usarla sola

Esto es clave. La usuaria tiene que poder aprender sin que nadie le explique:
- **Tour guiado interactivo** (tipo recorrido paso a paso con globitos que resaltan partes de la pantalla). Usá una librería liviana y mantenida — recomiendo `driver.js`; si proponés otra, justificá. Un tour de bienvenida la primera vez que entra y tours cortos por sección ("¿Cómo cargo una póliza?", "¿Cómo renuevo una póliza?", "¿Cómo registro un cobro?"). Guardar qué tours vio (en `profiles` con una migración chica que me mostrás antes, o en `localStorage` como primera versión).
- **Botón "Ayuda" siempre visible** que abre un panel con las preguntas frecuentes de esa pantalla y un botón "Mostrarme cómo" que lanza el tour correspondiente.
- **Estados vacíos que enseñan:** en vez de "No hay datos", explicar qué va ahí y un botón para hacerlo.
- **Textos de ayuda** debajo de los campos de formulario que lo necesiten (ej. qué es la vigencia, dónde encontrar el número de póliza).
- Opcional si queda tiempo: una página `/admin/ayuda` con guías cortas con capturas, imprimible.

## Criterios de "terminado"

- `npm run build` y `npm run lint` pasan.
- Todas las pantallas revisadas en navegador en escritorio (1440px) y celular (390px), en claro y oscuro, con capturas en el resumen final.
- Ningún texto de la interfaz bajo 14px; cuerpo ≥ 16px; contraste AA verificado.
- Ningún color hardcodeado fuera de los tokens (buscá `#` y `oklch(` en `components/` y `app/`).
- Los bugs de la lista están arreglados o explicados.
- `docs/GUIA_DE_ESTILO.md` y `/admin/guia` están al día con lo implementado.
- Resumen final: qué cambió, qué quedó pendiente, y qué necesito hacer yo (migraciones a correr, variables de entorno, etc.).

Empezá por la Fase 0 y mostrame el plan antes de escribir código.
