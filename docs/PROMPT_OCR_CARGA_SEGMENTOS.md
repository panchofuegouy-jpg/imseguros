# Prompt maestra — OCR, carga de pólizas, endosos, renovaciones y clientes prioritarios

> Copiá todo lo que está debajo de la línea y pegalo en una sesión nueva de Claude Code abierta en `~/Desarrollo/imseguros`.

---

## Rol y objetivo

Sos un ingeniero senior full-stack con experiencia en seguros y en extracción de documentos con IA. Trabajás sobre **Isgleas Seguros**, el sistema interno de una corredora de seguros en Uruguay (Next.js 15 + React 18 + Tailwind v4 + shadcn/Radix + Supabase + TypeScript).

La dueña de la corredora (más de 55 años, no técnica) carga las pólizas subiendo el PDF que manda la aseguradora (SURA, BSE, Porto, Mapfre, Sancor). Hoy eso funciona «más o menos»: el OCR acierta bastante, pero **todo lo que se sube termina como una póliza nueva**, los endosos no tienen historial, las renovaciones no quedan vinculadas y los datos quedan tan desordenados que no se puede saber cuántos camiones o clientes del agro tiene la cartera.

**Qué queremos lograr, en este orden:**

1. **OCR confiable y medible.** Que extraiga bien, diga cuándo no está seguro y que podamos medir cuánto acierta.
2. **Tres flujos distintos y correctos: póliza nueva, endoso y renovación.** Cada documento hace lo que corresponde sobre la póliza correcta, con historial.
3. **Datos normalizados:** ramo, segmento y datos del vehículo en columnas, no en texto libre.
4. **Clientes prioritarios: transporte pesado (camiones, flotas, buses) y agro.** Son los clientes más importantes de la cartera. Hay que separarlos, sacar sus números y darles mejor servicio: anticipar sus vencimientos, verlos primero y no perder ninguno.

## Cómo quiero que trabajes

- **Modo plan primero.** Leé el código y la base, confirmá los hallazgos de abajo y armá un plan por fases antes de tocar nada.
- **La base de datos es de producción.** Toda migración va en `migrations/` con fecha en el nombre, es **aditiva** (sin borrar ni renombrar columnas), idempotente (`IF NOT EXISTS`) y **me la mostrás antes de aplicarla**. Los backfills se corren primero en modo «solo reporte»: mostrás qué cambiaría y yo apruebo.
- **Nunca borrar el dato original.** Si normalizás `tipo`, el texto original queda guardado (ej. `tipo_original`).
- Respetá la guía de estilo: `docs/GUIA_DE_ESTILO.md` y la página viva `/admin/guia`. Usá los componentes de `components/brand/` (`PageHeader`, `SectionCard`, `StatCard`, `StatusBadge`, `EmptyState`, `HelpTip`) y los formatos de `lib/format.ts`. Textos en español rioplatense (vos), simples, para una usuaria no técnica.
- Toda pantalla o botón nuevo lleva su `data-tour` y su entrada de ayuda en `lib/help/content.ts`.
- Al terminar cada fase: `npx tsc --noEmit` sin errores nuevos, `npm run build` (con el servidor de desarrollo apagado), la prueba en el navegador con capturas y un commit por fase.
- Sacá los números de la base con consultas de solo lectura. **Nunca muestres ni guardes datos personales en logs, commits o documentos.** Solo agregados.

## Lo que ya relevé (verificalo)

### Arquitectura actual del OCR

- `app/api/ocr/extract/route.ts` (~680 líneas):
  - PDF: Mistral OCR (`mistral-ocr-latest`) → texto → `mistral-large-latest` arma el JSON; si falla, `gpt-4o-mini` y como último recurso `gpt-4o` con el PDF.
  - Imagen: `gpt-4o-mini` visión, con `pixtral-12b` de respaldo.
  - El prompt (`SCHEMA_RULES`) ya clasifica `tipo_movimiento` (`poliza_nueva | renovacion | endoso | cotizacion`) y `tipo_bien`, y trae reglas buenas sobre importes uruguayos, suma asegurada vs. premio y garantías de alquiler. **Conservá ese conocimiento.**
  - Los UUID de las aseguradoras están **hardcodeados** en el route (`COMPANIES`).
  - Hay rescates determinísticos del importe cuando el modelo devuelve null.
- `lib/ocr-normalize.ts`: `POLICY_TYPE_OPTIONS` (Auto, Camiones, Agricola, Taxi, Motos…) + alias, `matchPolicyType`, `matchCompanyId`, `pickOcrAmount`, `parseOcrAmount`. `lib/ocr-date.ts`: normaliza fechas.
- `app/api/ocr-webhook/route.ts` y `docs/N8N_WEBHOOK_CONFIG.md`: flujo viejo con n8n. Verificá si alguien lo usa todavía; si no, proponé retirarlo.
- `app/api/policies/ocr/route.ts`: placeholder.
- Docs previas: `docs/OCR_DIRECT.md`, `docs/OCR_DEBUGGING.md`, `docs/ocr-prompt.md`, `docs/CARGA_MASIVA_POLIZAS.md`.

### Problemas encontrados en la carga

1. **Carga masiva (`components/multi-file-policy-uploader.tsx`): todo es `insert` de una póliza nueva.**
   - Un **endoso** (cambio de vehículo) crea **otra póliza** cuya «prima» es la diferencia del endoso. Eso duplica pólizas e infla o desinfla la facturación.
   - Una **renovación** también crea una póliza nueva, sin vínculo con la anterior. La anterior queda sola hasta vencer.
   - No hay control de duplicados: si se sube dos veces el mismo PDF, quedan dos pólizas.
   - Si no hay número de póliza, se guarda `PEND-<timestamp>`.
   - El draft solo distingue `poliza | cambio_vehiculo` (ignora `renovacion` y `cotizacion`). Además marca «cambio de vehículo» si `diferencia != null`.
   - **Guarda `tipo` tal cual lo devuelve el OCR**, sin pasar por `matchPolicyType`. Usa su propio `matchCompanyId` en lugar del de `lib/ocr-normalize.ts`.
2. **`components/policy-ocr-update-dialog.tsx`** (actualizar una póliza con un documento nuevo) sí normaliza. Pero en un endoso **reemplaza** la prima por la diferencia, y los datos anteriores no quedan en ningún historial.
3. **Renovación desde «Por vencer»** (`components/policies-near-expiration-content.tsx`, formulario de ~400 líneas al final del archivo): actualiza la misma fila (pisa vigencia y prima). No queda historial de períodos anteriores.
4. **`GET /api/policies/near-expiration` modifica datos**: pasa a «Pendiente» las renovadas que vuelven a vencer. Un GET no debería escribir. Proponé moverlo a un cálculo, a una vista o a un cron.
5. **Documentos públicos:** las pólizas se suben al bucket `policy-documents` y se guarda `getPublicUrl`. Son PDFs con nombre, cédula y dirección de clientes. Evaluá pasar a bucket privado + URLs firmadas. **No lo cambies sin mi OK:** rompe los links existentes y los enlaces de WhatsApp.
6. **Los datos del vehículo viven solo en `notas`** como texto («Matrícula: ABC1234. Vehículo …»). No hay columnas de matrícula, marca, modelo, año, suma asegurada ni uso.

### La realidad de los datos (1.482 pólizas, 1.426 vigentes, al 23/09/2026)

- `tipo` tiene **más de 100 valores distintos** para las mismas cosas: «Automóviles» (253), «Private Cars» (166), «SEGUROS INDIVIDUALES» (141), «Auto» (127), «SEGURO GLOBAL» (103), «Motor Cycles» (97), «Camiones» (85), «Automotores» (75), «Goods Vehicles», «GOODS VEHICLES», «2 - Goods Vehicles», «Maquinaria», «MAQUINARIA AUTOMOTRIZ», «Camionetas rurales», «Tractores de semi-remolques», «Trailers hasta 3000 kg.», «COACHES, BUSES & MINIBUSES», «RC DEL TRANSPORTISTA», «INTEGRAL TRANSPORTISTAS PASAJEROS», «Cultivos», «GRANIZO», «DRONES», etc. Mezcla ramo, producto y plan comercial.
- **Transporte pesado, por el `tipo` explícito:** ~120 pólizas vigentes (Camiones + Goods Vehicles + tractores/semirremolques + trailers + buses + RC transportista). Buscando además en `notas`, una heurística amplia da ~320 pólizas de ~100 clientes, con prima registrada de ~$ 1,6 M + U$S 4.600. **Esa heurística exagera** (palabras como «carga» aparecen en otros contextos) y hay que refinarla. 264 de esas 320 son del BSE.
- **Agro, por el `tipo` explícito:** ~40 pólizas vigentes (Maquinaria, Maquinaria automotriz, Agrícola, Cultivos, Camionetas rurales, drones). Con `notas`: ~56 pólizas de ~41 clientes, prima registrada ~$ 228 mil + U$S 23.000.
- **854 de las 1.426 vigentes (60%) no tienen prima cargada.** Cualquier número de facturación hoy está incompleto.
- 70 pólizas vigentes tienen «Matrícula: DESCONOCIDO».

Recalculá todo esto con SQL y confirmá o corregí las cifras antes de diseñar.

## Fase 0 — Diagnóstico y set de evaluación (sin cambiar comportamiento)

1. Confirmá los hallazgos de arriba con el código y la base. Documentalos en `docs/OCR_DIAGNOSTICO.md`.
2. **Armá un set de evaluación del OCR.** Elegí ~40 documentos reales ya cargados en Storage que cubran las 5 aseguradoras × (póliza nueva, renovación, endoso, factura/recibo) y con peso especial en **camiones, flotas y agro**. Para cada uno, un JSON «esperado» que reviso yo. Guardá **solo las rutas de Storage y los JSON esperados** en `ocr-eval/` (fuera de `public/`, fuera de git si tienen datos personales: agregalo a `.gitignore` y dejá versionado solo el script).
3. Script `scripts/ocr-eval.ts` que corre el extractor sobre el set y reporta el acierto **por campo** (número de póliza, aseguradora, vigencias, tipo de movimiento, ramo, matrícula, premio, moneda, diferencia), por aseguradora y por tipo de documento. Guardá el resultado base como línea de comparación: todo cambio posterior del OCR se mide contra ella.
4. Tabla de costos y latencia por proveedor/modelo con el set.

## Fase 1 — Modelo de datos (migración aditiva, con mi OK)

Proponé y justificá, algo en esta línea:

- **`policies`**:
  - `ramo` (lista cerrada: `automotor`, `moto`, `transporte_pesado`, `agro`, `hogar`, `empresa`, `vida_personas`, `garantia_alquiler`, `embarcacion`, `otro`).
  - `segmento` (`particular`, `transporte`, `agro`, `empresa`), calculado pero editable a mano.
  - `tipo_original` (el texto tal cual lo dice la aseguradora).
  - `plan` o cobertura (ej. «Todo Riesgo», «SEGURO GLOBAL»).
  - `suma_asegurada` + `moneda_suma`.
  - `policy_group_id` o `renewed_from_id` para encadenar renovaciones.
- **`policy_vehicles`** (una póliza de flota puede tener muchos): `matricula`, `marca`, `modelo`, `anio`, `tipo_vehiculo` (auto, camioneta, camión, tractor, semirremolque, acoplado, bus, moto, maquinaria agrícola…), `capacidad_carga_kg`, `uso` (particular, carga propia, carga de terceros, agrícola, pasajeros), `chasis`, `suma_asegurada`, `activo`.
- **`policy_movements`**: el historial de cada póliza. `tipo` (`emision`, `renovacion`, `endoso`, `anulacion`), `subtipo` para endosos (cambio de vehículo, alta/baja de vehículo en flota, cambio de cobertura, cambio de suma, cambio de datos), `fecha_efecto`, `importe` o `diferencia` + `moneda`, `archivo_url`, `ocr_extraction_id`, `created_by`, `notas`. La facturación suma movimientos, no filas de póliza.
- **`ocr_extractions`**: auditoría de cada lectura. Archivo, proveedor, modelo, JSON devuelto, confianza por campo, qué corrigió la usuaria al revisar (diff entre lo leído y lo guardado), duración y costo. Sirve para medir y mejorar el OCR con datos reales.
- **`clients`**: `es_prioritario` (booleano editable) y `motivo_prioridad`; o una vista `client_segments` calculada desde sus pólizas. Justificá cuál.
- Pasar las aseguradoras hardcodeadas del route a la tabla `companies` (alias de nombre incluidos).

## Fase 2 — OCR mejor

- **Salida estructurada estricta** (JSON Schema validado con zod en el servidor), no «parsear lo que venga». Si el JSON no valida, reintentar una vez con el error.
- **Confianza por campo** y **evidencia**: para los campos críticos (número, vigencias, premio, matrícula), el fragmento de texto de donde salió. En la revisión, los campos dudosos se marcan en ámbar.
- **Validaciones determinísticas después del modelo:**
  - `vigencia_fin > vigencia_inicio` y un plazo razonable.
  - Matrícula con formato uruguayo (ej. `ABC 1234`; ojo con las del Mercosur y las viejas).
  - Dígito verificador de la cédula uruguaya y formato de RUT.
  - Premio ≠ suma asegurada.
  - Moneda coherente con los símbolos del documento.
  - Número de póliza con el formato conocido de cada aseguradora.
- **Extracción de flotas y vehículos:** listar **todos** los vehículos de una póliza (las de camiones y agro suelen traer anexos con varios), con su tipo, año, carga y suma asegurada.
- **Clasificación de ramo y segmento** con reglas + modelo: «Goods Vehicles», «Camiones livianos (hasta 7 ton.)», «Tractores de semi-remolques» → `transporte_pesado`; «Maquinaria automotriz», cosechadora, pulverizadora, «Cultivos», «Granizo» → `agro`. Tabla de alias versionada y con tests.
- **Pistas por aseguradora:** cómo se ve cada documento del BSE, SURA, Porto, Mapfre y Sancor (dónde está el número, cómo nombran el premio, cómo marcan un endoso). El BSE es la mayoría de las pólizas de camiones: priorizalo.
- **Proveedor:** con el set de evaluación, compará la cadena actual (Mistral OCR + mistral-large / OpenAI) contra al menos una alternativa. Incluí Claude, que lee PDFs directamente (usá el modelo más reciente disponible; consultá la documentación antes de elegir). Elegí por acierto en los campos críticos, no por costo. Dejá el proveedor configurable por variable de entorno.
- PDFs de muchas páginas y escaneos torcidos o de baja calidad: probalos explícitamente.

## Fase 3 — Carga inteligente: el sistema decide qué es el documento

Un único punto de entrada: **«Subir documento»** (en la ficha del cliente, en «Por vencer» y en la barra superior). Después del OCR, el sistema **busca si la póliza ya existe** (mismo número + aseguradora, o misma matrícula) y propone la acción, en palabras simples:

- «Es una **póliza nueva** de Juan Pérez. ¿La guardo?»
- «Es la **renovación** de la póliza 2221141 (vence el 30 de septiembre). ¿La renuevo?» → crea el período nuevo vinculado, cierra el anterior como «Renovada» y la saca de «Por vencer».
- «Es un **endoso** de la póliza 2221141: cambio de vehículo de ABC 1234 a DEF 5678, diferencia a cobrar $ 3.200. ¿Lo aplico?» → registra el movimiento, actualiza el vehículo y **no** crea otra póliza.
- «Es una **cotización**, no una póliza emitida. ¿La guardo como cotización o la descarto?»
- «**Este documento ya está cargado**» (mismo hash de archivo o misma póliza y período): no duplica.

Pantalla de revisión (pensada para la dueña):

- El PDF a la izquierda y los datos a la derecha. Campos dudosos en ámbar, con el fragmento de donde salieron.
- Una sola pregunta grande arriba («¿Qué es este documento?»), ya contestada por el sistema, que ella puede cambiar.
- Si la póliza es de un **cliente prioritario**, un aviso claro.
- Carga masiva: la misma lógica por archivo, con un resumen final («5 pólizas nuevas, 2 renovaciones, 1 endoso, 1 duplicado omitido»).

Unificá `multi-file-policy-uploader.tsx`, `policy-ocr-update-dialog.tsx` y el formulario de renovación de `policies-near-expiration-content.tsx` sobre una sola lógica de dominio en `lib/` (con tests), no tres copias.

## Fase 4 — Endosos y renovaciones como historial

- **Ficha de póliza** (o sección dentro de la ficha del cliente) con la **línea de tiempo**: emisión → endosos → renovaciones, cada uno con su documento, fecha e importe.
- **Vehículos de la póliza**, con alta y baja por endoso (clave en flotas).
- **Renovaciones:**
  - Anticipación configurable por segmento: **90 días para transporte y agro**, 60 para el resto.
  - Estados que ya existen (Pendiente, Contactado, En proceso, Renovada, No renovada), más el motivo cuando no renueva (precio, se fue a otra aseguradora, vendió el vehículo…).
  - Comparación del período nuevo contra el anterior: cuánto subió el premio, si cambió la cobertura.
- **Facturación** (`app/admin/facturacion/page.tsx`): calcular desde movimientos (emisión, renovación, endosos con su diferencia positiva o negativa). Y mostrar cuántas pólizas no tienen premio, con un botón para completarlas.

## Fase 5 — Clientes prioritarios: transporte y agro

Estos clientes son los más importantes. El sistema tiene que ayudar a darles un servicio mejor:

- **Backfill de segmento** sobre las 1.482 pólizas existentes: reglas sobre `tipo`, plan, `notas` y aseguradora, con la ayuda del modelo para los casos dudosos. Primero **un reporte para que yo revise** (cuántas pasan a cada segmento y una muestra de cada una), después se aplica. Extraé también matrícula, marca, modelo y año desde `notas` hacia `policy_vehicles` cuando se pueda.
- **Pantalla «Clientes prioritarios»** (`/admin/prioritarios`, en el menú bajo «Día a día»), con pestañas **Transporte** y **Agro**:
  - Por cliente: cantidad de pólizas y de vehículos (tamaño de flota), premio anual por moneda, próximo vencimiento, siniestros abiertos, deuda en cobranza y días desde el último contacto.
  - Ordenado por lo que necesita atención primero.
  - Botones directos: WhatsApp, llamar, ver ficha.
- **Números del segmento** (en esa pantalla y resumidos en Inicio):
  - Cantidad de clientes y de pólizas.
  - Vehículos asegurados por tipo (camiones, tractores, semirremolques, maquinaria).
  - Premio total por moneda y su peso sobre la cartera (%).
  - Reparto por aseguradora.
  - Vencimientos de los próximos 90 días.
  - Tasa de renovación de los últimos 12 meses.
  - Siniestros por segmento.
  - **Siempre indicar cuántas pólizas no tienen premio cargado**, para no dar un número falso.
- **Prioridad visible en todo el sistema:**
  - Distintivo «Prioritario» (ícono + palabra, color latón de la marca) en la lista de clientes, la ficha, «Por vencer», el Inicio y la búsqueda global.
  - En «Por vencer» y en el Inicio, los prioritarios **arriba**, con anticipación de 90 días.
  - Filtro por segmento en Pólizas, Por vencer, Cobranza y Siniestros.
- **Alertas en Inicio:** «3 clientes de transporte renuevan este mes», «Flota de X: 2 vehículos sin matrícula cargada», «Cliente agro sin contacto hace 60 días».
- Marca manual: poder marcar o desmarcar a cualquier cliente como prioritario, con un motivo.

## Criterios de «terminado»

- El set de evaluación mejora contra la línea base en los campos críticos, y el reporte queda en `docs/OCR_DIAGNOSTICO.md`.
- Subir un endoso **no** crea una póliza; subir una renovación **no** deja la anterior colgada; subir dos veces lo mismo **no** duplica.
- Todos los documentos nuevos quedan con `ramo`, `segmento` y vehículos estructurados.
- `/admin/prioritarios` muestra números que coinciden con consultas SQL que me mostrás.
- Migraciones aditivas, revisadas y aplicadas con mi OK. Backfill con reporte previo.
- Tests de la lógica de dominio (clasificación de ramo y segmento, detección de nueva/renovación/endoso/duplicado, validadores de matrícula, cédula y fechas, cálculo de facturación por movimientos).
- `npx tsc --noEmit` y `npm run build` sin errores; todo probado en el navegador (escritorio y celular) con capturas.
- Resumen final: qué cambió, cifras nuevas de los segmentos, qué quedó pendiente y qué tengo que hacer yo (variables de entorno, migraciones, revisar el backfill).

Empezá por la Fase 0 y mostrame el plan antes de escribir código.
