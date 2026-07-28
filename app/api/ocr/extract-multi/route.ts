import { NextRequest, NextResponse } from 'next/server';

const COMPANIES = [
  { id: "75d6c24c-85ad-4a6a-b33e-80c871a65bb3", name: "SURA" },
  { id: "94752145-4454-4365-888c-7bd9194798e8", name: "Porto" },
  { id: "954f4352-6993-4ece-946b-d114cbe238e0", name: "BSE" },
  { id: "b440634a-0ec9-4467-aa62-71932536fc56", name: "Sancor" },
  { id: "da3a4d2e-539d-4d1a-95d8-d26c10020cfd", name: "Mapfre" },
];

const OCR_PROMPT = `Te adjunto una póliza. Debes analizarla y devolver ÚNICAMENTE un JSON válido que cumpla EXACTAMENTE con el siguiente JSON Schema (sin texto adicional):

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

6. CAMPOS DE FACTURACIÓN — extrae valores numéricos (sin símbolo de moneda):
   - "total_a_pagar": monto TOTAL a abonar
   - "prima_monto": prima pura (sin impuestos)
   - "moneda": "USD" o "UYU"
   - "forma_pago": "Contado", "Mensual", etc.
   - "numero_factura": si aparece, sino null

7. El campo "notas" SIEMPRE debe incluir:
   - "Matrícula: <valor o 'DESCONOCIDO'>."
   - Breve detalle: tipo vehículo/bien, año, suma asegurada, cobertura

Ejemplo: "Matrícula: ABC123. Vehículo PONSSE ELEPHANT 8W año 2011, suma asegurada U$S 70.000, plan Todo Riesgo y RC del BSE."

Devuelve SOLO el JSON, sin comentarios ni explicaciones.`;

async function extractWithOpenAI(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  // Map to OpenAI media types
  const mediaTypeMap: Record<string, string> = {
    'image/jpeg': 'image_jpeg',
    'image/png': 'image_png',
    'image/gif': 'image_gif',
    'image/webp': 'image_webp',
    'application/pdf': 'pdf',
  };

  const openaiMediaType = mediaTypeMap[mediaType];
  if (!openaiMediaType) throw new Error(`Unsupported media type: ${mediaType}`);

  console.log('Attempting OCR with OpenAI GPT-4o mini', { fileName });

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
            {
              type: 'text',
              text: OCR_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content || '';

  console.log('OpenAI response received', {
    model: 'gpt-4o-mini',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  return parseJsonResponse(responseText);
}

async function extractWithMistral(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

  console.log('Attempting OCR with Mistral', { fileName });

  // Mistral doesn't support PDF directly, only images
  if (mediaType === 'application/pdf') {
    throw new Error('Mistral does not support PDF vision');
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: OCR_PROMPT,
            },
            {
              type: 'image_url',
              image_url: `data:${mediaType};base64,${base64Data}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Mistral API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const responseText = data.choices[0]?.message?.content || '';

  console.log('Mistral response received', {
    model: 'mistral-large-latest',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  return parseJsonResponse(responseText);
}

async function extractWithClaude(base64Data: string, mediaType: string, fileName: string) {
  const { Anthropic } = await import('@anthropic-ai/sdk');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  console.log('Attempting OCR with Claude', { fileName });

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as any,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: OCR_PROMPT,
          },
        ],
      },
    ],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  console.log('Claude response received', {
    model: 'claude-3-5-sonnet-20241022',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return parseJsonResponse(responseText);
}

function parseJsonResponse(responseText: string): any {
  let jsonText = responseText.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  return JSON.parse(jsonText);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;
    const provider = (formData.get('provider') as string) || 'auto';

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' = 'image/jpeg';
    if (file.type === 'image/png') mediaType = 'image/png';
    else if (file.type === 'image/gif') mediaType = 'image/gif';
    else if (file.type === 'image/webp') mediaType = 'image/webp';
    else if (file.type === 'application/pdf') mediaType = 'application/pdf';

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    console.log('Starting OCR extraction', {
      fileName: file.name,
      fileType: file.type,
      mediaType,
      fileSize: file.size,
      clientId,
      provider,
    });

    let extractedData: any;
    let usedProvider: string = '';
    const errors: Array<{ provider: string; error: string }> = [];

    // Define provider order
    const providers: Array<'openai' | 'mistral' | 'claude'> = provider === 'auto'
      ? ['openai', 'mistral', 'claude']
      : [provider as 'openai' | 'mistral' | 'claude'];

    // Try each provider in order
    for (const providerName of providers) {
      try {
        if (providerName === 'openai') {
          extractedData = await extractWithOpenAI(base64Data, mediaType, file.name);
        } else if (providerName === 'mistral') {
          extractedData = await extractWithMistral(base64Data, mediaType, file.name);
        } else if (providerName === 'claude') {
          extractedData = await extractWithClaude(base64Data, mediaType, file.name);
        }

        usedProvider = providerName;
        console.log('OCR extraction successful', {
          provider: usedProvider,
          hasNumeroPoliza: !!extractedData.numero_poliza,
          hasTipo: !!extractedData.tipo,
          hasVigencia: !!extractedData.vigencia_inicio && !!extractedData.vigencia_fin,
        });
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Provider ${providerName} failed:`, errorMessage);
        errors.push({ provider: providerName, error: errorMessage });
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
