import { NextRequest, NextResponse } from 'next/server';

const COMPANIES = [
  { id: "75d6c24c-85ad-4a6a-b33e-80c871a65bb3", name: "SURA" },
  { id: "94752145-4454-4365-888c-7bd9194798e8", name: "Porto" },
  { id: "954f4352-6993-4ece-946b-d114cbe238e0", name: "BSE" },
  { id: "b440634a-0ec9-4467-aa62-71932536fc56", name: "Sancor" },
  { id: "da3a4d2e-539d-4d1a-95d8-d26c10020cfd", name: "Mapfre" },
];

// Extract with Mistral OCR (native PDF support)
async function extractWithMistral(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

  console.log('Attempting OCR with Mistral', { fileName, mediaType });

  // Mistral supports PDFs and images natively
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
    let errorMsg = 'Unknown error';
    let errorDetails: any = {};
    try {
      errorDetails = await response.json();
      errorMsg = errorDetails.error?.message || errorDetails.message || JSON.stringify(errorDetails);
    } catch (parseErr) {
      errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    }
    console.error('Mistral API error details:', {
      status: response.status,
      errorMsg,
      fullResponse: errorDetails
    });
    throw new Error(`Mistral API error: ${errorMsg}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';

  if (!responseText) {
    throw new Error('No response text from Mistral');
  }

  console.log('Mistral response received', {
    model: 'mistral-large-latest',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  return parseJsonResponse(responseText);
}

// Extract with OpenAI (images only, faster & cheaper)
async function extractWithOpenAI(base64Data: string, mediaType: string, fileName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

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
    let errorMsg = 'Unknown error';
    try {
      const error = await response.json();
      errorMsg = error.error?.message || error.message || JSON.stringify(error);
    } catch (parseErr) {
      errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    }
    console.error('OpenAI API error details:', { status: response.status, errorMsg });
    throw new Error(`OpenAI API error: ${errorMsg}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content || '';

  if (!responseText) {
    throw new Error('No response text from OpenAI');
  }

  console.log('OpenAI response received', {
    model: 'gpt-4o-mini',
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  });

  return parseJsonResponse(responseText);
}

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Servicio de OCR no configurado. Falta OPENAI_API_KEY.' },
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
    let usedProvider: string = '';

    // Strategy: Use Mistral for PDFs (native support), OpenAI for images (cheaper)
    // For PDFs: only try Mistral (OpenAI doesn't support PDFs)
    // For images: try OpenAI first (cheaper), then Mistral as fallback

    if (mediaType === 'application/pdf') {
      // PDF: must use Mistral, no fallback to OpenAI (it doesn't support PDFs)
      try {
        extractedData = await extractWithMistral(base64Data, mediaType, file.name);
        usedProvider = 'mistral';
        console.log('OCR extraction successful', {
          provider: usedProvider,
          hasNumeroPoliza: !!extractedData.numero_poliza,
          hasTipo: !!extractedData.tipo,
          hasVigencia: !!extractedData.vigencia_inicio && !!extractedData.vigencia_fin,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Mistral OCR failed for PDF:', errorMessage);
        throw new Error(`Error procesando PDF con OCR: ${errorMessage}`);
      }
    } else {
      // Image: try OpenAI first (cheaper), fallback to Mistral
      const imageProviders = ['openai', 'mistral'];
      const errors: Array<{ provider: string; error: string }> = [];

      for (const providerName of imageProviders) {
        try {
          if (providerName === 'openai') {
            extractedData = await extractWithOpenAI(base64Data, mediaType, file.name);
          } else if (providerName === 'mistral') {
            extractedData = await extractWithMistral(base64Data, mediaType, file.name);
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
        throw new Error(`All image OCR providers failed. Errors: ${errorSummary}`);
      }
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
