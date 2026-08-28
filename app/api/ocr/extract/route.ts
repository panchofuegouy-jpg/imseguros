import { NextRequest, NextResponse } from 'next/server';
import { parseOcrAmount } from '@/lib/ocr-normalize';

const COMPANIES = [
  { id: "75d6c24c-85ad-4a6a-b33e-80c871a65bb3", name: "SURA" },
  { id: "94752145-4454-4365-888c-7bd9194798e8", name: "Porto" },
  { id: "954f4352-6993-4ece-946b-d114cbe238e0", name: "BSE" },
  { id: "b440634a-0ec9-4467-aa62-71932536fc56", name: "Sancor" },
  { id: "da3a4d2e-539d-4d1a-95d8-d26c10020cfd", name: "Mapfre" },
];

const SCHEMA_RULES = `Eres el asistente de un corredor de seguros uruguayo que opera con varias
aseguradoras (SURA, Porto, BSE, Sancor, Mapfre). Cada una emite sus documentos con un
diseño distinto, así que guíate por el SIGNIFICADO de cada dato y no por su posición.

Devuelve ÚNICAMENTE un JSON válido que cumpla EXACTAMENTE con el siguiente JSON Schema (sin texto adicional):

{
  "tipo_movimiento": "poliza_nueva" | "renovacion" | "endoso" | "cotizacion",
  "tipo_bien": "vehiculo" | "inmueble" | "persona" | "garantia_alquiler" | "otro",
  "numero_poliza": "string",
  "tipo": "string",
  "vigencia_inicio": "YYYY-MM-DD",
  "vigencia_fin": "YYYY-MM-DD",
  "company_id": "string (UUID)",
  "nombre_asegurado": "string",
  "documento_asegurado": "string",
  "parentesco": "string",
  "notas": "string",
  "total_a_pagar": number | null,
  "prima_monto": number | null,
  "diferencia": number | null,
  "vehiculo_anterior": "string | null",
  "vehiculo_nuevo": "string | null",
  "moneda": "UYU" | "USD",
  "forma_pago": "string | null",
  "numero_factura": "string | null"
}

Reglas IMPORTANTES:

0. "tipo_movimiento" clasifica el documento:
   - "poliza_nueva": alta de una póliza que antes no existía.
   - "renovacion": continúa una póliza vigente por un nuevo período. Suele decir
     "RENOVACIÓN" o referirse a una póliza anterior.
   - "endoso": modificación de una póliza en curso (cambio de vehículo, de
     cobertura, de datos). Suele decir "ENDOSO", "MODIFICACIÓN" o "SUSTITUCIÓN".
   - "cotizacion": presupuesto sin emitir. Suele decir "COTIZACIÓN" o "PROPUESTA".
   Si el documento es una FACTURA o RECIBO de una póliza, clasifícalo según la
   operación que factura (normalmente "poliza_nueva" o "renovacion").

0.bis "tipo_bien" indica QUÉ se está asegurando. No todas las pólizas son de
   vehículos y las reglas 5 y 8 dependen de este campo:
   - "vehiculo": auto, moto, camión, taxi, lancha, maquinaria agrícola.
   - "inmueble": hogar, vivienda, incendio, comercio, empresarial.
   - "persona": vida, salud, sepelio, accidentes personales.
   - "garantia_alquiler": garantía o fianza de alquiler. El documento habla de
     un contrato de arrendamiento, un inmueble arrendado, un propietario y un
     inquilino. NO es una póliza de hogar.
   - "otro": cualquier otra cosa.

1. Usa el formato de fecha ISO: "YYYY-MM-DD" (ejemplo: 2025-09-30).
   - Las fechas del documento están en formato uruguayo/latino: DD/MM/AAAA.
   - Ejemplo: si dice "04/05/2026", devuelve "2026-05-04".

2. El campo "parentesco" SIEMPRE debe ser "Titular".

3. El "numero_poliza" debe ser SIN ceros a la izquierda.

4. "company_id" debes obtenerlo de esta lista:
${JSON.stringify(COMPANIES, null, 2)}

5. "documento_asegurado" depende de "tipo_bien":
   - Si es "vehiculo": matrícula → cédula/RUT del titular → "DESCONOCIDO".
   - En TODOS los demás casos ("inmueble", "persona", "garantia_alquiler",
     "otro"): la cédula o RUT del asegurado. Estos documentos NO tienen
     matrícula, así que NO devuelvas "DESCONOCIDO" sin antes buscar la cédula:
     aparece junto al nombre del titular, con etiquetas como "C.I.", "CI",
     "CÉDULA", "DOCUMENTO", "RUT" o "RUC", y suele venir con puntos y guion
     ("1.234.567-8"). Devuélvela tal como figura.
   - Sólo usa "DESCONOCIDO" si de verdad no hay ningún identificador.

6. CAMPOS DE FACTURACIÓN — este es el punto donde más se falla, léelo con atención.

   Los importes vienen en formato uruguayo: 53.790,00 significa cincuenta y tres mil
   setecientos noventa. El punto separa miles y la coma decimales. Devuélvelos SIEMPRE
   como número con punto decimal y sin símbolo de moneda: 53790.00

   - "total_a_pagar": el monto TOTAL que el cliente debe abonar, impuestos incluidos.
     Etiquetas habituales: "TOTAL A PAGAR", "PREMIO TOTAL", "PREMIO", "IMPORTE TOTAL",
     "TOTAL", "COSTO TOTAL", "MONTO A PAGAR", "TOTAL FACTURA".
     En garantías de alquiler el importe casi nunca se llama "prima": buscá
     "COSTO DEL SERVICIO", "PRECIO DEL SERVICIO", "COSTO DE LA GARANTÍA",
     "COSTO ANUAL", "HONORARIOS" o "CUOTA".
     Si hay una tabla de importes, este valor suele estar en la ÚLTIMA fila.
   - "prima_monto": la prima pura, antes de impuestos y recargos. Etiquetas:
     "PRIMA", "PRIMA PURA", "PRIMA COMERCIAL".
     Si el documento informa un único importe sin distinguir prima de total,
     ponlo en "total_a_pagar" y deja "prima_monto" en null.
   - "diferencia": SOLO para "endoso". Es el ajuste a cobrar o devolver por la
     modificación. POSITIVO si el cliente debe pagar más, NEGATIVO si le corresponde
     una devolución o crédito ("A DEVOLVER", "SALDO A FAVOR", importe entre paréntesis
     o con signo menos). En los demás tipos de movimiento va null.
   - "moneda": "USD" o "UYU". "$" o "$U" es UYU; "U$S" o "USD" es USD.
   - "forma_pago": "Contado", "Mensual", "Trimestral", "Semestral", "Anual", etc.
   - "numero_factura": número de factura o recibo si aparece, sino null.

   DOS ERRORES QUE DEBES EVITAR:

   a) No confundas la SUMA ASEGURADA (el valor del vehículo o bien cubierto, suele ser
      un número grande y redondo) con el importe a pagar. La suma asegurada NO va en
      estos campos: va en "notas".
      En garantías de alquiler pasa lo mismo con el ALQUILER MENSUAL y con el MONTO
      GARANTIZADO: son el bien cubierto, no lo que cobra la aseguradora. Van en
      "notas", nunca en "total_a_pagar".

   b) Si el documento es una FACTURA o RECIBO, SIEMPRE informa un importe. No devuelvas
      null: busca en las tablas y en el pie del documento hasta encontrarlo.

   Devuelve null únicamente si el documento realmente no informa ningún importe
   (por ejemplo, algunos certificados de cobertura).

7. Para "endoso" por cambio de vehículo, completa "vehiculo_anterior" y
   "vehiculo_nuevo" con la matrícula y descripción de cada uno. En los demás
   tipos de movimiento van null.

8. El campo "notas" describe el bien asegurado, y su formato depende de
   "tipo_bien":
   - "vehiculo": empieza con "Matrícula: <valor o 'DESCONOCIDO'>." y sigue con
     tipo de vehículo, año, suma asegurada y cobertura.
   - "inmueble": dirección del inmueble, sumas aseguradas y coberturas.
   - "garantia_alquiler": dirección del inmueble arrendado, monto del alquiler
     mensual garantizado, plazo del contrato y nombre del propietario si figura.
   - "persona" u "otro": capital asegurado y coberturas.
   NO escribas "Matrícula:" en pólizas que no son de vehículos.

Ejemplo vehículo: "Matrícula: ABC123. Vehículo PONSSE ELEPHANT 8W año 2011, suma asegurada U$S 70.000, plan Todo Riesgo y RC del BSE."
Ejemplo garantía de alquiler: "Garantía de alquiler para vivienda en Av. Italia 1234 ap. 302, Montevideo. Alquiler mensual garantizado $ 28.000, contrato a 24 meses."

Devuelve SOLO el JSON, sin comentarios ni explicaciones.`;

// Prompt para modelos de visión (recibe la imagen directamente)
const OCR_PROMPT = `Te adjunto una póliza. Debes analizarla y ${SCHEMA_RULES}`;

// Prompt para el paso 2 del flujo de PDF (recibe el texto ya extraído por el OCR)
const TEXT_TO_JSON_PROMPT = (text: string) =>
  `A continuación está el texto de una póliza extraído por OCR. Analízalo y ${SCHEMA_RULES}

--- TEXTO DE LA PÓLIZA ---
${text}
--- FIN DEL TEXTO ---`;

// Parse JSON from response text
function parseJsonResponse(responseText: string): any {
  let jsonText = responseText.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  return JSON.parse(jsonText);
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.error?.message || body.message || JSON.stringify(body).slice(0, 500);
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}

// Paso 1 del flujo PDF: endpoint dedicado de OCR de Mistral.
// Acepta PDFs como data URL en base64 y devuelve el texto en markdown por página.
async function mistralOcrToText(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

  console.log('Mistral OCR: extracting text', { fileName, mediaType });

  const response = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: `data:${mediaType};base64,${base64Data}`,
      },
    }),
  });

  if (!response.ok) {
    const errorMsg = await readApiError(response);
    console.error('Mistral OCR API error:', { status: response.status, errorMsg });
    throw new Error(`Mistral OCR error: ${errorMsg}`);
  }

  const data = await response.json();
  const pages: any[] = Array.isArray(data.pages) ? data.pages : [];

  const text = pages
    .map((page) => page.markdown ?? page.text ?? '')
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!text) {
    throw new Error('Mistral OCR devolvió el documento sin texto');
  }

  console.log('Mistral OCR: text extracted', {
    pages: pages.length,
    chars: text.length,
  });

  return text;
}

// Paso 2 del flujo PDF: convertir el texto del OCR en el JSON estructurado.
// Se intenta con Mistral y, si falla, con OpenAI (ambas APIs las tiene el usuario).
async function structureTextToJson(text: string) {
  const prompt = TEXT_TO_JSON_PROMPT(text);
  const errors: string[] = [];

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mistralKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Modelo grande a propósito: este paso lee tablas de importes y es
          // donde se perdían las primas con mistral-small.
          model: 'mistral-large-latest',
          max_tokens: 2048,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía de Mistral');

      console.log('Structured with Mistral', { model: 'mistral-large-latest' });
      return parseJsonResponse(content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Structuring with Mistral failed:', msg);
      errors.push(`mistral: ${msg}`);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 2048,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía de OpenAI');

      console.log('Structured with OpenAI', { model: 'gpt-4o-mini' });
      return parseJsonResponse(content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Structuring with OpenAI failed:', msg);
      errors.push(`openai: ${msg}`);
    }
  }

  throw new Error(`No se pudo estructurar el texto del OCR. ${errors.join('; ')}`);
}

// Etiquetas con las que los documentos nombran el importe a cobrar, de la más
// específica a la más ambigua. Las de garantía de alquiler ("costo del
// servicio", "honorarios") no dicen "prima" en ninguna parte, que es por lo que
// el modelo devolvía null en esas pólizas.
const AMOUNT_LABELS = [
  "total a pagar",
  "premio total",
  "importe total",
  "monto a pagar",
  "costo total",
  "total factura",
  "costo del servicio",
  "precio del servicio",
  "costo de la garantia",
  "costo anual",
  "honorarios",
  "premio",
  "prima comercial",
  "prima pura",
  "prima",
  "cuota",
  "total",
];

// Líneas donde el número es el bien cubierto, no lo que se cobra.
const AMOUNT_DECOYS = [
  "suma asegurada",
  "capital asegurado",
  "monto garantizado",
  "alquiler mensual",
  "valor del inmueble",
  "limite",
];

// Las etiquetas se escriben sin tildes, pero en el documento pueden venir con
// ellas ("garantía"). Cada vocal matchea sus dos formas, sobre el texto ORIGINAL:
// así el índice del match sigue alineado con la línea, cosa que se perdería si
// normalizáramos con NFD (quitar una tilde cambia el largo del string).
const ACCENT_CLASSES: Record<string, string> = {
  a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uúü]", n: "[nñ]",
};

const labelPattern = (label: string) =>
  new RegExp(
    label.replace(/[aeioun]/g, (vowel) => ACCENT_CLASSES[vowel]).replace(/ /g, "\\s+"),
    "i",
  );

// Diagnóstico: qué importes hay en el texto del OCR. Sirve para distinguir si
// una póliza queda sin prima porque el documento no la informa o porque el
// modelo que arma el JSON no la encontró.
function findAmountsInText(text: string) {
  const labelled = text.match(
    new RegExp(`(${AMOUNT_LABELS.join('|')})\\s*:?\\s*[^\\n]{0,60}`, 'gi')
  );
  const currency = text.match(/(?:U\$S|USD|\$U|\$)\s?[\d.,]{3,}/g);
  return {
    labelledMatches: labelled ? labelled.slice(0, 8) : [],
    currencyMatches: currency ? currency.slice(0, 8) : [],
  };
}

// Rescate determinístico del importe cuando el modelo devolvió todo en null.
// Recorre las etiquetas por prioridad y se queda con el primer número de la
// misma línea. El texto viene en markdown, así que la etiqueta y el importe
// pueden estar separados por celdas de tabla ("| TOTAL A PAGAR | $ 53.790,00 |").
function rescueAmountFromText(text: string): { amount: number; label: string; line: string } | null {
  const decoys = AMOUNT_DECOYS.map(labelPattern);
  const lines = text
    .split('\n')
    .filter((line) => !decoys.some((decoy) => decoy.test(line)));

  for (const label of AMOUNT_LABELS) {
    const pattern = labelPattern(label);

    for (const line of lines) {
      const found = pattern.exec(line);
      if (!found) continue;

      // Sólo lo que viene DESPUÉS de la etiqueta, para no tomar el número de la
      // columna anterior de la tabla.
      const after = line.slice(found.index + found[0].length);
      const match = after.match(/\d[\d.,]*/);
      if (!match) continue;

      const amount = parseOcrAmount(match[0]);
      if (amount === null || amount <= 0) continue;

      return { amount, label, line: line.trim().slice(0, 120) };
    }
  }

  return null;
}

// Flujo completo para PDFs: OCR de Mistral + estructuración a JSON.
async function extractFromPdf(base64Data: string, mediaType: string, fileName: string) {
  const text = await mistralOcrToText(base64Data, mediaType, fileName);
  const result = await structureTextToJson(text);

  // Si no salió ningún importe, lo buscamos nosotros en el texto del OCR antes
  // de devolver la póliza sin prima.
  if (result.total_a_pagar == null && result.prima_monto == null) {
    const rescued = rescueAmountFromText(text);

    if (rescued) {
      result.total_a_pagar = rescued.amount;
      console.log('Amount rescued from OCR text', {
        fileName,
        amount: rescued.amount,
        label: rescued.label,
        line: rescued.line,
      });
    } else {
      console.warn('No amount extracted', {
        fileName,
        ...findAmountsInText(text),
      });
    }
  }

  return result;
}

// Flujo para imágenes: modelo de visión de OpenAI (una sola llamada).
async function extractWithOpenAIVision(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  console.log('Attempting OCR with OpenAI vision', { fileName, model: 'gpt-4o-mini' });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64Data}`,
                detail: 'auto',
              },
            },
            { type: 'text', text: OCR_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorMsg = await readApiError(response);
    console.error('OpenAI API error:', { status: response.status, errorMsg });
    throw new Error(`OpenAI API error: ${errorMsg}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  if (!responseText) throw new Error('No response text from OpenAI');

  console.log('OpenAI response received', {
    model: 'gpt-4o-mini',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  return parseJsonResponse(responseText);
}

// Fallback para PDFs cuando Mistral no está disponible.
// OpenAI acepta PDFs como parte de contenido "file" (distinto de "image_url",
// que sólo admite imágenes y es el que devolvía "Invalid MIME type").
async function extractPdfWithOpenAI(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  console.log('Attempting PDF OCR with OpenAI file input', { fileName, model: 'gpt-4o' });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2048,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: fileName,
                file_data: `data:${mediaType};base64,${base64Data}`,
              },
            },
            { type: 'text', text: OCR_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorMsg = await readApiError(response);
    console.error('OpenAI PDF API error:', { status: response.status, errorMsg });
    throw new Error(`OpenAI PDF error: ${errorMsg}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  if (!responseText) throw new Error('No response text from OpenAI');

  console.log('OpenAI PDF response received', {
    model: 'gpt-4o',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  return parseJsonResponse(responseText);
}

// Flujo alternativo para imágenes: modelo de visión de Mistral.
async function extractWithMistralVision(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

  console.log('Attempting OCR with Mistral vision', { fileName, model: 'pixtral-12b-2409' });

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'pixtral-12b-2409',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: `data:${mediaType};base64,${base64Data}` },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorMsg = await readApiError(response);
    console.error('Mistral vision API error:', { status: response.status, errorMsg });
    throw new Error(`Mistral API error: ${errorMsg}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  if (!responseText) throw new Error('No response text from Mistral');

  console.log('Mistral vision response received', {
    model: 'pixtral-12b-2409',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  return parseJsonResponse(responseText);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    if (!process.env.MISTRAL_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error('No OCR provider configured');
      return NextResponse.json(
        { error: 'Servicio de OCR no configurado. Falta MISTRAL_API_KEY u OPENAI_API_KEY.' },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mediaType: string = file.type;
    const base64Data = buffer.toString('base64');

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(mediaType)) {
      return NextResponse.json(
        { error: `Tipo de archivo no soportado: ${file.type}. Solo se aceptan PDF, JPEG, PNG, GIF o WebP.` },
        { status: 400 }
      );
    }

    console.log('Starting OCR extraction', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      clientId,
    });

    let extractedData;
    let usedProvider = '';

    // Los modelos de visión (OpenAI y Mistral) rechazan PDFs en base64: sólo
    // aceptan imágenes. Por eso los PDFs van al endpoint dedicado /v1/ocr de
    // Mistral, que sí acepta data:application/pdf;base64 y devuelve markdown,
    // y luego ese texto se estructura a JSON con un modelo de chat.
    const providers: Array<{ name: string; run: () => Promise<any> }> =
      mediaType === 'application/pdf'
        ? [
            { name: 'mistral-ocr', run: () => extractFromPdf(base64Data, mediaType, file.name) },
            { name: 'openai-pdf', run: () => extractPdfWithOpenAI(base64Data, mediaType, file.name) },
          ]
        : [
            { name: 'openai', run: () => extractWithOpenAIVision(base64Data, mediaType, file.name) },
            { name: 'mistral', run: () => extractWithMistralVision(base64Data, mediaType, file.name) },
          ];

    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of providers) {
      try {
        extractedData = await provider.run();
        usedProvider = provider.name;
        console.log('OCR extraction successful', {
          provider: usedProvider,
          mediaType,
          hasNumeroPoliza: !!extractedData.numero_poliza,
          hasTipo: !!extractedData.tipo,
          hasVigencia: !!extractedData.vigencia_inicio && !!extractedData.vigencia_fin,
        });
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Provider ${provider.name} failed:`, errorMessage);
        errors.push({ provider: provider.name, error: errorMessage });
      }
    }

    if (!extractedData) {
      const errorSummary = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
      throw new Error(`All OCR providers failed. Errors: ${errorSummary}`);
    }

    return NextResponse.json({
      extractedData,
      status: 'success',
      provider: usedProvider,
    });
  } catch (error) {
    console.error('OCR extraction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    return NextResponse.json(
      { error: `Error al procesar el documento: ${errorMessage}` },
      { status: 500 }
    );
  }
}
