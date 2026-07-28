import { NextRequest, NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

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
   - Las fechas del documento están en formato uruguayo/latino: DD/MM/AAAA (día/mes/año).
   - Ejemplo: si el documento dice "04/05/2026", debes devolver "2026-05-04" (4 de mayo de 2026).

2. El campo "parentesco" SIEMPRE debe ser "Titular".

3. El "numero_poliza" debe ser el número de póliza SIN ceros a la izquierda.

4. "company_id" debes obtenerlo de esta lista de compañías por nombre (campo "name"):
${JSON.stringify(COMPANIES, null, 2)}

5. En "documento_asegurado" PRIORIZA SIEMPRE la matrícula del vehículo asegurado.
   - Si hay matrícula, poné ese valor aunque sea "0" o un formato raro.
   - Si NO hay matrícula, entonces usá el documento de la persona (cédula/RUT) si aparece.
   - Si no encontrás nada, usa "DESCONOCIDO".

6. CAMPOS DE FACTURACIÓN — extrae los siguientes valores numéricos (sin símbolo de moneda, solo el número):
   - "total_a_pagar": el monto TOTAL que el cliente debe abonar según la póliza.
   - "prima_monto": el monto de la prima pura (sin impuestos/recargos), si está desglosado.
   - "moneda": "USD" si el monto está en dólares, "UYU" si está en pesos uruguayos.
   - "forma_pago": cómo se paga (ejemplos: "Contado", "Mensual", "Anual", "Débito automático").
   - "numero_factura": número de factura o recibo, si aparece en el documento.

7. El campo "notas" SIEMPRE debe incluir:
   - La matrícula en texto, en el formato: "Matrícula: <valor o 'DESCONOCIDO'>."
   - Un breve detalle de la póliza en 1–2 frases (tipo de vehículo/bien, año, suma asegurada, cobertura).

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

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'Servicio de OCR no configurado' },
        { status: 500 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' = 'image/jpeg';
    if (file.type === 'image/png') mediaType = 'image/png';
    else if (file.type === 'image/gif') mediaType = 'image/gif';
    else if (file.type === 'image/webp') mediaType = 'image/webp';
    else if (file.type === 'application/pdf') mediaType = 'application/pdf';

    console.log('Starting OCR extraction', {
      fileName: file.name,
      fileType: file.type,
      mediaType,
      fileSize: file.size,
      clientId,
    });

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

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
                media_type: mediaType,
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

    // Extract JSON from response
    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    console.log('Claude response received', {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      responseLength: responseText.length,
    });

    // Parse JSON from response (Claude should return pure JSON)
    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Invalid JSON response from Claude');
      }
    }

    console.log('OCR extraction successful', {
      hasNumeroPoliza: !!extractedData.numero_poliza,
      hasTipo: !!extractedData.tipo,
      hasVigencia: !!extractedData.vigencia_inicio && !!extractedData.vigencia_fin,
    });

    return NextResponse.json({
      extractedData,
      status: 'success',
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
