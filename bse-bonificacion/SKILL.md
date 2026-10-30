---
name: bse-bonificacion
description: Ajustar cotizaciones en el Portal del Asesor de BSE (portaldelasesor.bse.com.uy) aplicando una Bonificacion Comercial calculada para que el premio de la cotizacion quede 3 % por encima del premio de la poliza. Por cada cotizacion de la lista abre Editar cotizacion, carga el porcentaje, avanza hasta Resumen, verifica el guardado y vuelve a la lista. Nunca emite.
---

# BSE: bonificar cotizaciones en loop

BORRADOR v0.3 (2026-10-19). Estado y pendientes en PROGRESO.md.

## REGLAS ESTRICTAS
- NUNCA tocar "Emitir" durante las pruebas. Tampoco "Agregar Certificado", "Clonar cotizacion", "Anular cotizaciones", "Nueva cotizacion", "Exportar" ni "Imprimir".
- Si aparece cualquier error, mensaje inesperado, login o diálogo: parar el loop y avisar al usuario.
- Pedir OK al usuario antes de la primera cotizacion de cada corrida (el guardado modifica datos reales) y definir el alcance (cuales cotizaciones).
- Nunca escribir usuario ni contraseña. Si pide login, que entre el usuario.
- Usar Chrome con la extensión de Claude (sesión del usuario). Pestaña nueva, no reutilizar las del usuario.
- No usar clics por coordenadas: el marco de coordenadas de las capturas no coincide con el viewport y el clic puede caer en Clonar o Emitir. Usar ref (find) o el id del enlace.

## Conceptos y fórmula
- Premio Cotiz. (C) = lo que vale en teoría la póliza. Premio Póliza (P) = precio real. Ambos salen de la fila de la lista.
- Objetivo: dejar el premio de la cotización en P x 1,03 (3 % por encima del premio de la póliza).
- Descuento a cargar en "% Bonificación Comercial": x = (1 - 1,03 x P / C) x 100, redondeado a 2 decimales.
- El efecto es lineal: con x % de bonificación el total de la cotización queda C x (1 - x/100). Comprobado: 3 % bajó 104.351 a 101.220.
- Se SETEA el campo en x, no se suma. Si el campo ya tiene x, saltar la cotización.
- Si x sale NEGATIVO (C menor que 1,03 x P), no se puede lograr con descuento: NO tocar esa cotización, registrarla y avisar al usuario.
- Después de guardar, en Resumen comparar FACTURA con P x 1,03. Si la diferencia es mayor a 0,1 %, avisar (ajustar x en centésimas solo con OK del usuario).

## Loop por cotización
1. Lista: Escritorio Comercial > Cotizaciones > Consulta de cotizaciones. Filtrar por razón social en el campo de la GRILLA (no el del panel lateral, que puede estar oculto) y apretar la lupa. Verificar el contador "Mostrando X de N".
2. Anotar de la fila: N° cotización, N° póliza, C y P. Calcular x. Si x es negativo o hay duda, no seguir con esa fila.
3. Desplegar el panel con el botón "Toggle Row" de esa fila (find por N° de cotización).
4. Abrir la edición: el clic simulado sobre "Editar cotización" NO navega. Funciona disparar el enlace desde JS: `document.getElementById('...:formCotizaciones:tablaResultado:N:j_id_6t').click()` donde N es el índice de la fila (0 = primera). Buscar el id con querySelectorAll('a') por texto "Editar cotización". Esperar ~6 s. Confirmar en pantalla "Editar Cotización" con Póliza y Núm. Cotiz. de la fila elegida. Si no coincide, parar.
5. En Datos Básicos, botón "Ir a Certificados »" (clic por ref funciona). En "Certificados 1 a N" ubicar con find el textbox "% Bonificación Comercial" (valor original 0,00).
   Carga del valor (el campo tiene máscara numérica, la PC es Mac):
   - clic en el campo, `cmd+a`, `Delete`, escribir "27,46" (coma decimal), `Tab`.
   - NO usar ctrl+a: en Mac no selecciona y el texto se pega adelante del "0,00" (quedó 27.460,00 con error "Demasiados dígitos enteros").
   - Verificar con find que el valor sea exactamente x y que no haya mensaje de error (growl rojo arriba a la derecha). Si hay error, corregir antes de avanzar.
6. "Ir a Coberturas »" (clic por ref funciona). En Coberturas no se hace nada.
7. "Ir a Planes »" (clic por ref funciona). Leer CUOTA y TOTAL: el TOTAL ya debe dar aprox. P x 1,03. Si no, parar.
8. "Ir a Resumen »" (clic por ref funciona). Debe decir "Cotización NNNNNNNN guardada con éxito." Verificar el número.
9. Leer "Casos Fuera de Pauta" y los totales (EMISIÓN y FACTURA). Comparar FACTURA con P x 1,03. Registrar en PROGRESO.md. NO tocar "Emitir" ni "Agregar Certificado".
10. Volver: el clic simulado sobre "« Volver" NO funciona (igual que Editar). Disparar desde JS el input visible con valor "« Volver" del formulario de Resumen (id terminado en `formResumen:j_id_ne`; buscarlo por valor y offsetParent != null). Esperar ~7 s y confirmar título "Consulta Cotizaciones".
11. Relanzar la búsqueda (lupa) para refrescar la grilla. Ojo: tras guardar, la columna Premio Cotiz. de la cotización editada queda VACÍA. Para verificar, desplegar la fila y leer "Valor Total" del panel. Pasar a la siguiente.

## Modo rápido (probado 2026-10-19 con 62008700)
Mismo flujo, pero cada pantalla la espera un script en la página (polling) en vez de waits fijos:
- Lista: script que ubica la fila por N° de cotización (`tr` con `.ui-row-toggler`), la despliega si hace falta, espera el link "Editar cotización" en `.ui-expanded-row-content` y lo dispara con `.click()`.
- Edición: script que espera "Editar Cotización", valida Póliza/Núm. Cotiz., hace "Ir a Certificados", espera el input de Bonificación Comercial (label "% Bonificación Comercial" -> input cuyo id termina en `dec_input`; NO el `cmb_focus`, que es un combo) y lo enfoca.
- Teclado real: cmd+a, Delete, escribir x, Tab.
- Script final: valida valor y ausencia de errores (growl), Coberturas -> Planes (valida TOTAL contra P x 1,03 con tolerancia 0,2 %) -> Resumen (valida "guardada con éxito" con el número correcto), lee EMISIÓN, FACTURA y fuera de pauta, y recién ahí dispara "« Volver".
- Si algo no cuadra, el script corta con error antes de avanzar.
- Encadenar todo en una sola tanda de herramientas fue BLOQUEADO por el sistema de permisos de Claude: requiere que el usuario lo autorice (o hacerlo paso a paso).

## Registro
Por cada cotización guardar una línea en PROGRESO.md: N° cotización, N° póliza, C, P, x aplicado, FACTURA final, desvío contra P x 1,03, advertencias, resultado.
