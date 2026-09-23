# Guía de estilo — Isgleas Seguros

Página viva con los componentes reales: **`/admin/guia`**. Tokens: **`app/globals.css`**.
Esta guía manda sobre cualquier estilo que se agregue. Si una pantalla nueva necesita algo que no está acá, primero se agrega acá.

## Para quién diseñamos

La usuaria principal es la dueña de la corredora: más de 55 años, no técnica, usa el sistema sola. Si una pantalla necesita que alguien se la explique, está mal diseñada o le falta ayuda en la propia pantalla.

## Principios (si hay que elegir, gana el primero)

1. **Que se entienda sola.** Cada pantalla tiene un título, una frase que explica para qué sirve y una acción principal evidente.
2. **Letra grande, contraste alto.** Nada por debajo de 14px. Cuerpo de 17px. Contraste WCAG AA mínimo.
3. **Palabras, no códigos.** «Vence en 3 días», no «3d». «Guardar cliente», no «Submit». Voseo rioplatense, nunca «tú».
4. **Lujo es calma.** Mucho aire, pocos colores, serif en títulos, latón solo como detalle. Nada de neón, gradientes ni vidrio.

## Color

Concepto: *banca privada uruguaya*. Tema claro por defecto; el oscuro es opcional (botón en el menú).

| Token | Claro | Uso |
|---|---|---|
| `--background` | `#f6f3ec` marfil | Fondo |
| `--card` | `#fffdf8` papel | Tarjetas, paneles, campos |
| `--foreground` | `#1b2526` tinta | Texto |
| `--muted-foreground` | `#56615f` | Texto secundario (5.9:1) |
| `--primary` | `#1f5257` petróleo | Botón principal, enlaces, foco |
| `--sidebar` | `#102a2c` | Menú lateral (en ambos temas; el logo es blanco) |
| `--gold` / `--gold-foreground` | `#a8844a` / `#7a5d2c` | Filetes, ítem activo, antetítulos. Nunca en botones |
| `--border` / `--input` | `#e0d9c9` / `#d6cebd` | Bordes |

**Estados** — pares `*-soft` (fondo) + `*-strong` (texto/ícono): `success`, `warning`, `danger`, `info`.
Un estado **siempre** lleva ícono + palabra (`<StatusBadge>`), nunca solo color.

**Gráficos** — `--chart-1` a `--chart-6`, derivados de la marca. Preferir barras con el número escrito a tortas.

**Prohibido:** `bg-red-500`, `text-green-600`, `#hex` o `bg-black` en componentes. Todo sale de tokens.

## Tipografía

- **Fraunces** (`font-display`): títulos de página, de sección y cifras grandes.
- **Figtree** (`font-sans`, por defecto): todo lo demás.

| Clase | Tamaño | Uso |
|---|---|---|
| `font-display text-5xl` | 48 | Saludo de Inicio |
| `font-display text-4xl` | 40 | Título de página (`<PageHeader>`) |
| `font-display text-2xl` / `text-xl` | 26 / 22 | Sección / título de tarjeta |
| `text-lg font-semibold` | 19 | Nombre en una lista |
| `text-base` | 17 | Cuerpo |
| `text-sm` | 15 | Dato secundario |
| `text-xs` | 14 | **El mínimo.** Antetítulos y encabezados de tabla |

La escala está redefinida en `@theme` (`--text-xs` = 14px, etc.), así que `text-xs` ya no es diminuto. No usar `text-[10px]` ni similares.
Mayúsculas solo en antetítulos cortos con `tracking`; nunca en datos, buscadores ni tablas enteras.

## Espacio, forma y movimiento

- Radios: tarjetas `rounded-2xl`, campos y botones `rounded-lg`, pastillas `rounded-full`.
- Sombras cálidas y suaves (`shadow-sm` en tarjetas, `shadow-xl` en diálogos).
- Alto mínimo de lo que se toca: **44px** (`h-11`); 48px en celular.
- Movimiento: `--ease-emphasized` para entrar, `--ease-exit` para salir. Se respeta `prefers-reduced-motion`.

## Componentes de marca (`components/brand/`)

| Componente | Para qué |
|---|---|
| `PageHeader` | Antetítulo + título serif + frase + acciones. Toda pantalla empieza con uno |
| `SectionCard` | Bloque con título serif y cuerpo |
| `StatCard` | Una cifra grande con su explicación; clickeable si tiene `href` |
| `StatusBadge`, `ExpiryBadge`, `RenewalStatusBadge` | Estados con ícono + palabra |
| `EmptyState` | Vacío que enseña: qué va acá y botón para hacerlo |
| `HelpTip` | «?» que explica un campo (popover, funciona con toque) |
| `AuthFrame` | Marco de login y recuperación de contraseña |

Formatos en `lib/format.ts`: `formatDate` (15/10/2026), `formatDateLong` (15 de octubre), `formatMoney` ($ 12.500 / U$S 1.200), `daysUntil`, `relativeDays`.
**Fechas `AAAA-MM-DD` siempre con `parseDateOnly`/`formatDate`**: `new Date("2026-09-30")` se lee en UTC y en Uruguay muestra el día anterior.

## Estructura de la app

- `components/shell/app-shell.tsx`: menú lateral agrupado («Día a día» / «Gestión»), barra superior, barra inferior en celular.
- Barra superior del admin: buscador global (Ctrl/⌘ K), «Nuevo cliente», «Ayuda».
- Las páginas pueden montar controles propios en `#admin-topbar-actions` (fila debajo de la barra superior; se oculta si está vacía).

## Ayuda integrada

- Contenido en `lib/help/content.ts`: preguntas frecuentes por ruta y recorridos guiados (driver.js).
- Los recorridos apuntan a `data-tour="..."`. Al agregar una pantalla o un botón importante, agregar su `data-tour` y su pregunta frecuente.
- El recorrido de bienvenida se lanza solo la primera vez en Inicio (se recuerda en `localStorage`).

## Tono de voz

- Frases cortas, verbo primero: «Avisale al cliente», «Registrar pago».
- Errores que dicen qué hacer: «El email o la contraseña no coinciden. Revisalos y probá de nuevo.»
- Confirmaciones de borrado explícitas: «¿Eliminar a este cliente?» → «Sí, eliminar cliente» / «No, volver».
- Glosario: *Por vencer* (no «Renovaciones»), *ficha del cliente* (no «detalles»), *Cargar pólizas desde PDF* (no «con IA»).
