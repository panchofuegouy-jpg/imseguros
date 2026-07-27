# Prompt OCR — Analizador de Pólizas

Prompt para el nodo de análisis de imágenes en n8n (modelo Claude / GPT-4o Vision).

---

```
Te adjunto una póliza. Debes analizarla y devolver ÚNICAMENTE un JSON válido que cumpla EXACTAMENTE con el siguiente JSON Schema (sin texto adicional):

{
  "tipo_movimiento": "poliza" | "cambio_vehiculo",
  "numero_poliza": "string",
  "tipo": "string",
  "vigencia_inicio": "YYYY-MM-DD",
  "vigencia_fin": "YYYY-MM-DD",
  "company_id": "string (UUID)",
  "nombre_asegurado": "string",
  "documento_asegurado": "string",
  "parentesco": "string",
  "notas": "string",
  "diferencia": number | null,
  "vehiculo_anterior": "string | null",
  "vehiculo_nuevo": "string | null",
  "total_a_pagar": number | null,
  "prima_monto": number | null,
  "moneda": "UYU" | "USD",
  "forma_pago": "string | null",
  "numero_factura": "string | null"
}

Reglas IMPORTANTES:

0. Primero clasifica el documento:
   - Usa `"tipo_movimiento": "cambio_vehiculo"` si es un endoso, suplemento,
     sustitución o cambio de vehículo asociado a una póliza.
   - En ese caso extrae en `"diferencia"` solamente el importe adicional o saldo
     que debe pagar/devolver el cliente por el cambio; no lo confundas con la prima
     anual total.
   - Resume matrícula, marca, modelo y año del bien sustituido en
     `"vehiculo_anterior"` y los del nuevo bien en `"vehiculo_nuevo"`.
   - Usa `"tipo_movimiento": "poliza"` para una emisión común y devuelve
     `"diferencia": null`.

1. Usa el formato de fecha ISO: "YYYY-MM-DD" (ejemplo: 2025-09-30).
   - Las fechas del documento están en formato uruguayo/latino: DD/MM/AAAA (día/mes/año), nunca MM/DD/AAAA.
   - Ejemplo: si el documento dice "04/05/2026", debes devolver "2026-05-04" (4 de mayo de 2026), no "2026-04-05".
2. El campo "parentesco" SIEMPRE debe ser "Titular".
3. El "numero_poliza" debe ser el número de póliza SIN ceros a la izquierda.
4. "company_id" debes obtenerlo de esta lista de compañías por nombre (campo "name"):

[{"idx":0,"id":"75d6c24c-85ad-4a6a-b33e-80c871a65bb3","name":"SURA"},
{"idx":1,"id":"94752145-4454-4365-888c-7bd9194798e8","name":"Porto"},
{"idx":2,"id":"954f4352-6993-4ece-946b-d114cbe238e0","name":"BSE"},
{"idx":3,"id":"b440634a-0ec9-4467-aa62-71932536fc56","name":"Sancor"},
{"idx":4,"id":"da3a4d2e-539d-4d1a-95d8-d26c10020cfd","name":"Mapfre"}]

5. En "documento_asegurado" PRIORIZA SIEMPRE la matrícula del vehículo asegurado.
   - Si hay matrícula, poné ese valor aunque sea "0" o un formato raro.
   - Si NO hay matrícula, entonces usá el documento de la persona (cédula/RUT) si aparece.
   - Si no encontrás nada, usa "DESCONOCIDO".

6. CAMPOS DE FACTURACIÓN — extrae los siguientes valores numéricos (sin símbolo de moneda, solo el número):
   - "total_a_pagar": el monto TOTAL que el cliente debe abonar según la póliza (puede llamarse "Total a pagar", "Importe total", "Total", "A cobrar", etc.). Si no aparece, devuelve null.
   - "prima_monto": el monto de la prima pura (sin impuestos/recargos), si está desglosado. Si no aparece desglosado, devuelve null.
   - "moneda": "USD" si el monto está en dólares, "UYU" si está en pesos uruguayos. Si no se especifica, usa "UYU".
   - "forma_pago": cómo se paga (ejemplos: "Contado", "Mensual", "Anual", "Débito automático"). Devuelve null si no aparece.
   - "numero_factura": número de factura o recibo, si aparece en el documento. Devuelve null si no aparece.

7. El campo "notas" SIEMPRE debe incluir:
   - La matrícula en texto, en el formato: "Matrícula: <valor o 'DESCONOCIDO'>."
   - Un breve detalle de la póliza en 1–2 frases:
     • tipo de vehículo / bien asegurado
     • año
     • suma asegurada principal
     • tipo de plan o cobertura (por ejemplo: "Todo Riesgo y RC").

Ejemplo de estructura de "notas":
"Matrícula: ABC123. Vehículo PONSSE ELEPHANT 8W año 2011, suma asegurada U$S 70.000, plan Todo Riesgo y RC del BSE."

Devuelve SOLO el JSON, sin comentarios ni explicaciones.
```
