# Propuestas de renovación BSE

Pantalla: **Admin › Propuestas** (`/admin/polizas/propuestas`).

## Para qué sirve

La dueña sube el Excel que baja de BSE (Portal del Asesor › Cotizaciones › Consulta de
cotizaciones › «Exportar resultados a Excel»). La plataforma cruza cada cotización con las
pólizas cargadas (por número de póliza), aplica el **aumento en renovación** de cada cliente y
arma un PDF con la marca, que queda en la ficha del cliente para mandar por WhatsApp.
**No cambia nada en BSE ni en las pólizas.**

## Cálculo

- C = Premio Cotización (lo que BSE cotiza para renovar). P = Premio Póliza (lo que paga hoy).
- Objetivo: P × (1 + aumento %). El aumento sale de la ficha (por defecto 3 %).
- Bonificación comercial a cargar en BSE: (1 − objetivo / C) × 100, con 2 decimales.
- Premio propuesto: C × (1 − bonificación / 100). Validado contra BSE: difiere $ 1–7 por redondeo de cuotas.
- Si C ya está por debajo del objetivo, la bonificación no sirve (solo baja): queda la cotización de BSE.
- Bonificación > 50 % o póliza en dólares: «revisar a mano», no entra al PDF.
- Bonificación > 10 %: BSE la marca «fuera de pauta» y pide autorización antes de emitir.

Exportá el Excel **antes** de editar cotizaciones en BSE: las ya editadas salen sin Premio Cotización.

## Datos

- `client_renewal_settings`: % de aumento por cliente (solo admins; la tabla `clients` la lee
  el propio cliente desde su portal y el % es interno).
- `renewal_proposals`: cada propuesta generada, con el detalle por póliza en `items`.
- Bucket **privado** `renewal-proposals`: el PDF solo se abre con link firmado
  (10 minutos para verlo desde el admin, 7 días el que va por WhatsApp).

## Deploy (en este orden)

1. Aplicar `migrations/20261019_propuestas_renovacion_bse.sql` en Supabase (es aditiva e idempotente).
2. `pnpm install` (suma `@react-pdf/renderer` y `xlsx`).
3. Deploy. Probar en un preview: generar una propuesta, abrir el PDF y el link de WhatsApp.

## Notas técnicas

- `lib/renewal-proposal-pdf.tsx` usa el pragma `@jsx h`: el App Router compila JSX con el React 19
  interno de Next, pero react-pdf usa el React 18 instalado. Los elementos se crean con el React
  que resuelve react-pdf. Si el proyecto pasa a React 19, se puede volver a JSX normal.
- Fuentes (Fraunces, Figtree; licencia OFL) y logo del PDF en `assets/pdf/`, incluidos en la
  función por `outputFileTracingIncludes` en `next.config.mjs`.
- `xlsx` 0.18.5 (npm) tiene CVE conocidos (prototype pollution / ReDoS) corregidos en 0.20.x, que
  SheetJS publica solo en su CDN. Acá corre solo en el navegador de la admin sobre archivos de BSE.
  Para limpiar auditorías: `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
