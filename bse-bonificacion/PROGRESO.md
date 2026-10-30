# Progreso: automatización BSE (bonificación comercial)

Última actualización: 2026-10-19 21:50 (Montevideo)

## Objetivo
En cada póliza, cargar en "% Bonificación Comercial" el descuento x que deja el premio de la cotización (C) en 3 % por encima del premio de la póliza (P): x = (1 - 1,03 x P / C) x 100. Guardar hasta Resumen, volver y repetir en loop. Regla de pruebas: NO EMITIR NADA.

## Validado
- Chrome con la extensión de Claude lee y navega el portal con la sesión del usuario.
- Búsqueda por razón social (campo de la grilla + lupa) y desplegado de la fila funcionan.
- "Editar cotización" abre disparando el enlace desde JS (ver SKILL.md). El clic simulado y por coordenadas no sirve.
- Formulario de edición: pestañas Datos Básicos, Certificados 1 a N, Coberturas, Planes, Resumen, Autorización, Facturación. Bonificación Comercial está en Certificados 1 a N (sección Vehículo, valor original 0,00).
- El efecto de la bonificación es lineal (3 % bajó 104.351 a 101.220).

## Cotizaciones de prueba (Vilomon, ramo 4 vehículos)
C = Premio Cotiz., P = Premio Póliza (de la lista). x calculado para quedar 3 % sobre P.

| Cotiz. | Póliza | C | P | x a cargar | Estado |
|---|---|---|---|---|---|
| 62008702 | 9941315 | 104.351 | 74.540 | 26,43 | Guardada a mano con 3 % (INCORRECTO). Hay que rehacerla con 26,43. NO emitida. |
| 62008701 | 9941314 | 77.740 | 54.750 | 27,46 | HECHA por Claude 2026-10-19 21:50. Guardada con éxito. FACTURA 56.390,00 (objetivo 56.392,50, +2,996 % sobre P). Emisión 45.315,18. 10 cuotas de 5.639. Fuera de pauta: ">10 %" y "no corresponde para esta promoción", Autorizado: No. NO emitida. |
| 62008700 | 9941313 | 21.390 | 16.980 | 18,24 | HECHA por Claude 2026-10-19 21:58 con script rápido. Guardada con éxito. FACTURA 17.490,00 (objetivo 17.489,40). Emisión 14.055,10. 10 cuotas de 1.749. Fuera de pauta (>10 % y promoción), Autorizado: No. NO emitida. Vehículo: SCANIA L 111 1980, ITP1976, Seguro Triple. |
| 62008699 | 9941312 | 43.350 | 34.410 | 18,24 | HECHA por Claude 2026-10-19 21:57 (modo rápido, con OK del usuario). Guardada con éxito. FACTURA 35.450,00 (objetivo 35.442,30). Emisión 28.484,70. 10 cuotas de 3.545. Fuera de pauta (>10 % y promoción), Autorizado: No. NO emitida. Vehículo: SEMIRREMOLQUE 2014, Seguro Global. |
| 62008698 | 9941311 | 44.890 | 35.640 | 18,22 | Pendiente |
| 62008697 | 9941309 | 112.639 | 67.040 | 38,70 | Pendiente |
| 62008696 | 9941280 | 5.196 | 5.154 | negativo (-2,17) | NO se puede con descuento: C es menor que P x 1,03. No tocar, consultar. |
| 62008695 | 9941277 | 8.730 | 8.660 | negativo (-2,17) | NO se puede con descuento: C es menor que P x 1,03. No tocar, consultar. |

## Observado 2026-10-19 21:50
- 62008702 aparece en la grilla con Premio Cotiz. 73.050 y luego vacío tras refrescar: alguien la editó de nuevo después del 3 %. Confirmar con el usuario qué valor tiene hoy.
- Tras guardar, la grilla deja vacío el Premio Cotiz. de la cotización editada; el valor real está en el panel (Valor Total).
- Regla de pauta del portal: Bonificación Comercial mayor a 10 % queda fuera de pauta; mayor a 50 % es inválida.

## Pendientes y dudas abiertas
0. Las bonificaciones que calculamos (18 a 39 %) quedan todas fuera de pauta (>10 %) y sin autorización. Confirmar si es lo esperado antes de seguir con el resto.
1. FUERA DE PAUTA: con 3 % en 62008702 el Resumen mostró "Casos Fuera de Pauta: No corresponde % Bonificación Comercial para esta Promoción en VEHÍCULO. Autorizado: No." (promoción F09209 ITPC2 Paysandú). Con descuentos de 18 a 39 % es probable que siga pasando. Definir cómo se maneja.
2. Qué hacer con las cotizaciones donde x es negativo (62008696 y 62008695).
3. Alcance del loop: solo las 8 de Vilomon, o una búsqueda más grande.
4. Verificar tras "Volver" si la lista conserva filtro y paneles abiertos.
5. Confirmar nombres exactos de los botones inferiores de Certificados, Coberturas y Planes.
6. Probar el loop completo sobre UNA cotización con OK del usuario antes de correr las demás.
7. Verificar que FACTURA final quede en P x 1,03 (tolerancia 0,1 %); el redondeo a 2 decimales deja desvíos de hasta 0,007 %.
8. Por defecto, ante error a mitad de loop: parar y avisar.

## DOFINUR SA (2026-10-20, +3 %)
| Cotiz. | Póliza | C | P | x | Estado |
|---|---|---|---|---|---|
| 62010254 | 9965723 | 89.090 | 72.320 | 16,39 | HECHA. Guardada con éxito. FACTURA 74.490 (obj. 74.489,60). NO emitida. |
| 62010253 | 9965719 | 130.010 | 90.230 | 28,52 | A MEDIAS: BSE la guardó como modificada con 28,52 % pero el total sigue 130.010 (no recalculó). Revisar en BSE y volver a 0,00 o recalcular. |
| 62010252 | 9965717 | 115.080 | 89.910 | 19,53 | NO SE PUEDE con el flujo: 3 intentos (con y sin esperas largas); Planes no recalcula (sigue 115.080). No se guardó por Resumen. Revisar en BSE. |
| 62010251 | 9965716 | 56.300 | 44.590 | 18,42 | HECHA. FACTURA 45.930 (obj. 45.927,70). NO emitida. |
| 62010250 | 9965715 | 43.170 | 26.100 | — | SALTEADA: ya tenía bonificación 40,00 cargada. No se tocó. Con eso, +3 % pediría >50 % (inválido). |
| 62010249 | 9965711 | 55.190 | 47.730 | 10,92 | HECHA. FACTURA 49.160 (obj. 49.161,90). NO emitida. |
| 62010194 | 9965500 | 167.240 | 108.030 | 33,47 | HECHA. FACTURA 111.260 (obj. 111.270,90). NO emitida. |
| 62010193 | 9965498 | 53.280 | 32.470 | 37,23 | HECHA. FACTURA 33.440 (obj. 33.444,10). NO emitida. |
| 62010086 / 085 / 084 / 083 | — | — | — | <0 | No alcanza: BSE ya cotizó por debajo de P + 3 %. |
Aprendido: (1) esperar ~3 s después del Tab y ~3 s en Coberturas evita que Planes lea el total viejo; (2) 62010252 y 62010253 no recalculan ni con esperas: es algo propio de esas cotizaciones en BSE; (3) si una tanda tarda demasiado la herramienta corta: separar en dos (preparar+tipear / guardar).

## TRANSPORTES AMBERT SAS (2026-10-21, +3 %, ramo 4 vehículos, 16 cotizaciones)
Corrida hecha por Claude con OK del usuario. Ninguna emitida. Todas las guardadas quedaron Fuera de Pauta solo si x > 10 %.
| Cotiz. | Póliza | C | P | x | Estado |
|---|---|---|---|---|---|
| 62010329 | 9967264 | 111.260 | 78.650 | 27,19 | HECHA. FACTURA 81.009 (obj. 81.009,50). Emisión 65.095,66. Fuera de pauta (>10 %). NO emitida. |
| 62010092 | 9964663 | 114.800 | 77.380 | 30,57 | HECHA. FACTURA 79.710 (obj. 79.701,40). Fuera de pauta. NO emitida. |
| 62009763 | 9961846 | 93.020 | 69.130 | 23,45 | HECHA. FACTURA 71.210 (obj. 71.203,90). Fuera de pauta. NO emitida. |
| 62009762 | 9961844 | 27.570 | 23.250 | 13,14 | HECHA. FACTURA 23.940 (obj. 23.947,50). Fuera de pauta. NO emitida. |
| 62009761 | 9961843 | 137.040 | 100.960 | 24,12 | HECHA. FACTURA 103.990 (obj. 103.988,80). Fuera de pauta. NO emitida. |
| 62009760 | 9961842 | 98.570 | 73.260 | 23,45 | HECHA. FACTURA 75.460 (obj. 75.457,80). Fuera de pauta. NO emitida. |
| 62009746 | 9961673 | 48.540 | 44.540 | 5,49 | HECHA. FACTURA 45.880 (obj. 45.876,20). En pauta. NO emitida. |
| 62009742 | 9961622 | 27.570 | 24.620 | 8,02 | HECHA. FACTURA 25.360 (obj. 25.358,60). En pauta. NO emitida. |
| 62009740 | 9961602 | 42.010 | 37.500 | 8,06 | HECHA. FACTURA 38.620 (obj. 38.625). En pauta. NO emitida. |
| 62009739 | 9961590 | 16.210 | 14.870 | 5,51 | HECHA. FACTURA 15.320 (obj. 15.316,10). En pauta. NO emitida. |
| 62009737 | 9961580 | 29.600 | 20.780 | 27,69 | SALTEADA: ya tenía bonificación 40,00 cargada. No se tocó. |
| 62009733 | 9961569 | 42.200 | 34.990 | 23,14 | HECHA 2026-10-21 (2ª pasada, con OK del usuario): traía 10,00 cargada; base estimada 42.200/0,9; se cargó 23,14 total. FACTURA 36.040 (obj. 36.039,70). Emisión 28.960,57. Aviso: "Matrícula existente en póliza vigente" (el ícono de advertencia), Autorizado: No. NO emitida. |
| 62009731 | 9961564 | 37.960 | 24.710 | 32,95 | SALTEADA: ya tenía bonificación 40,00 cargada. No se tocó. |
| 62009730 | 9961563 | 4.593 | 4.215 | 5,48 | HECHA (3 pagos sin intereses). FACTURA 4.341 (obj. 4.341,45). En pauta. NO emitida. |
| 62009727 | 9961558 | 4.593 | 4.215 | 5,48 | HECHA (3 pagos sin intereses). FACTURA 4.341 (obj. 4.341,45). En pauta. NO emitida. |
| 62009725 | 9961552 | 42.131 | 25.550 | 37,54 | SALTEADA: ya tenía bonificación 40,00 cargada. No se tocó. |
Resumen: 12 hechas, 4 salteadas por bonificación previa (62009737, 62009733, 62009731, 62009725). Fuera de pauta (>10 %): 62010329, 62010092, 62009763, 62009762, 62009761, 62009760.

2ª pasada (2026-10-21): 62009737, 62009731 y 62009725 NO se pueden llevar a P + 3 %: con 40,00 previo, la base sin bonificar es C/0,6 y el descuento total necesario da 56,6 %, 59,8 % y 62,5 % (>50 % es inválido). Siguen como estaban; decidir con el usuario (por ejemplo dejarlas con 40 %).

## FRANQUEZ PAREDES SILVIA (2026-10-23, +5 %, ramo 4, 16 cotizaciones, moneda U$S, 3 pagos sin intereses)
Corrida hecha por Claude con OK del usuario. Ninguna emitida. Objetivo = P x 1,05.
Aprendido: (1) el campo de Bonificación Comercial aparece con 0,00 antes de cargar el valor real: esperar ~2,5 s después de que exista el input y recién ahí leer el valor previo; (2) con bonificación previa b, la base es C/(1-b) y x = (1 - 1,05 x P x (1-b) / C) x 100, pero en 62010281 el campo decía 40,00 y el portal calculó sobre C directo (x = 5,05): SIEMPRE verificar el total de Planes contra el objetivo antes de ir a Resumen y recalcular x desde ahí si no cuadra; (3) la fila de Planes en U$S tiene formato "U$S cuota U$S total"; (4) si el total de Planes no coincide, no guardar: volver a Certificados (pestaña) y corregir.
| Cotiz. | Póliza | C | P | x cargado | FACTURA | Pauta |
|---|---|---|---|---|---|---|
| 62010327 | 9967251 | 1.294,64 | 1.114,84 | 36,71 (traía 30) | 1.170,53 | Fuera de pauta |
| 62010326 | 9967245 | 1.464,97 | 1.328,99 | 33,32 (traía 30) | 1.395,50 | Fuera de pauta |
| 62010325 | 9967244 | 506,85 | 482,01 | 30,10 (traía 30) | 506,08 | Fuera de pauta |
| 62010324 | 9967242 | 1.175,68 | 1.005,47 | 37,14 (traía 30) | 1.055,77 | Fuera de pauta |
| 62010323 | 9967241 | 1.157,32 | 708,99 | 35,68 | 744,40 | Fuera de pauta |
| 62010322 | 9967236 | 3.116,51 | 2.774,95 | 34,56 (traía 30) | 2.913,51 | Fuera de pauta |
| 62010321 | 9967235 | 981,18 | 785,07 | 41,19 (traía 30) | 824,33 | Fuera de pauta |
| 62010320 | 9967234 | 439,23 | 375,54 | 37,16 (traía 30) | 394,31 | Fuera de pauta |
| 62010281 | 9966102 | 208,72 | 188,74 | 5,05 (el campo decía 40) | 198,18 | En pauta |
| 62010280 | 9966098 | 117,73 | 105,75 | 5,68 | 111,00 | En pauta |
| 62010279 | 9966096 | 242,67 | 217,93 | 5,70 | 228,85 | En pauta |
| 62010278 | 9966093 | 378,33 | 339,52 | 5,77 | 356,49 | En pauta |
No se tocaron (x negativo, no alcanza): 62010328 (C 167,49 / P 159,88), 62010282 (275,81 / 275,17), 62010283 (C 625,17 / P 1.043,27, P mayor que C), 62008595 (P 77.925 parece dato raro). NO emitidas.

## FRASCHINI NIELL GUILLERMO JOAQUIN (2026-10-23) - EMISIÓN con OK explícito del usuario
9 cotizaciones (ramo 7 Maquinaria Automotriz, contado, U$S), emitidas tal cual, sin tocar valores, con "Solo Emitir" (sin incidencia de Emisión Propia).
| Cotiz. | Resultado |
|---|---|
| 62114953 | Póliza nueva 203528 |
| 61677273 | Póliza nueva 203529 |
| 61677272 | Póliza nueva 203530 |
| 61677256 | Póliza nueva 203531 |
| 61677254 | Póliza nueva 203532 |
| 61677252 | Póliza nueva 203533 |
| 61677249 | Póliza nueva 203534 |
| 61677246 | Póliza nueva 203535 |
| 62670634 | Endoso nº 1 sobre póliza 203224 (valor total -273,23) |
Flujo de emisión: expandir fila > "Emitir" > diálogo "¿Desea también crear la incidencia de Emisión Propia?" > "Solo Emitir". Todo por JS (.click()) funcionó; el mensaje de éxito sale en un growl ("Nuevo número de póliza generado: N"). Las emitidas salen de la lista.
