import { NextRequest, NextResponse } from 'next/server';

const COMPANIES = [
  { id: "75d6c24c-85ad-4a6a-b33e-80c871a65bb3", name: "SURA" },
  { id: "94752145-4454-4365-888c-7bd9194798e8", name: "Porto" },
  { id: "954f4352-6993-4ece-946b-d114cbe238e0", name: "BSE" },
  { id: "b440634a-0ec9-4467-aa62-71932536fc56", name: "Sancor" },
  { id: "da3a4d2e-539d-4d1a-95d8-d26c10020cfd", name: "Mapfre" },
];

const SCHEMA_RULES = `Devuelve ÚNICAMENTE un JSON válido que cumpla EXACTAMENTE con el siguiente JSON Schema (sin texto adicional):

{
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
  "moneda": "UYU" | "USD",
  "forma_pago": "string | null",
  "numero_factura": "string | null"
}

Reglas IMPORTANTES:

1. Usa el formato de fecha ISO: "YYYY-MM-DD" (ejemplo: 2025-09-30).
   - Las fechas del documento están en formato uruguayo/latino: DD/MM/AAAA.
   - Ejemplo: si dice "04/05/2026", devuelve "2026-05-04".

2. El campo "parentesco" SIEMPRE debe ser "Titular".

3. El "numero_poliza" debe ser SIN ceros a la izquierda.

4. "company_id" debes obtenerlo de esta lista:
${JSON.stringify(COMPANIES, null, 2)}

5. En "documento_asegurado" PRIORIZA: matrícula → documento → "DESCONOCIDO".

6. CAMPOS DE FACTURACIÓN — extrae valores numéricos (sin símbolo de moneda).
   Los importes vienen en formato uruguayo (1.234,56 = mil doscientos treinta y
   cuatro con 56). Devuélvelos como número con punto decimal: 1234.56

   - "total_a_pagar": monto TOTAL a abonar. Búscalo bajo etiquetas como
     "TOTAL A PAGAR", "PREMIO TOTAL", "IMPORTE TOTAL", "TOTAL", "COSTO TOTAL",
     "MONTO A PAGAR" o en la última fila de la tabla de importes.
   - "prima_monto": prima pura, sin impuestos ni recargos. Etiquetas habituales:
     "PRIMA", "PRIMA PURA", "PREMIO", "PRIMA COMERCIAL".
   - "moneda": "USD" o "UYU". Si ves "$" o "$U" es UYU; "U$S" o "USD" es USD.
   - "forma_pago": "Contado", "Mensual", etc.
   - "numero_factura": si aparece, sino null

   IMPORTANTE: no confundas la SUMA ASEGURADA (el valor del bien cubierto) con
   el importe a pagar. La suma asegurada NO va en estos campos, va en "notas".
   Si el documento realmente no informa ningún importe a pagar, devuelve null.

7. El campo "notas" SIEMPRE debe incluir:
   - "Matrícula: <valor o 'DESCONOCIDO'>."
   - Breve detalle: tipo vehículo/bien, año, suma asegurada, cobertura

Ejemplo: "Matrícula: ABC123. Vehículo PONSSE ELEPHANT 8W año 2011, suma asegurada U$S 70.000, plan Todo Riesgo y RC del BSE."

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
          model: 'mistral-small-latest',
          max_tokens: 2048,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía de Mistral');

      console.log('Structured with Mistral', { model: 'mistral-small-latest' });
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

// Diagnóstico: busca importes en el texto del OCR. Sirve para distinguir si una
// póliza queda sin prima porque el documento no la informa o porque el modelo
// que arma el JSON no la encontró.
function findAmountsInText(text: string) {
  const labelled = text.match(
    /(total a pagar|premio total|importe total|monto a pagar|costo total|prima pura|prima comercial|prima|premio|total)\s*:?\s*[^\n]{0,60}/gi
  );
  const currency = text.match(/(?:U\$S|USD|\$U|\$)\s?[\d.,]{3,}/g);
  return {
    labelledMatches: labelled ? labelled.slice(0, 8) : [],
    currencyMatches: currency ? currency.slice(0, 8) : [],
  };
}

// Flujo completo para PDFs: OCR de Mistral + estructuración a JSON.
async function extractFromPdf(base64Data: string, mediaType: string, fileName: string) {
  const text = await mistralOcrToText(base64Data, mediaType, fileName);
  const result = await structureTextToJson(text);

  // Si no salió ningún importe, dejamos rastro de lo que sí había en el texto.
  if (result.total_a_pagar == null && result.prima_monto == null) {
    console.warn('No amount extracted', {
      fileName,
      ...findAmountsInText(text),
    });
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
