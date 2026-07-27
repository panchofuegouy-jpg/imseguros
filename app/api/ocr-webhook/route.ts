import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      console.error('N8N webhook URL not configured');
      return NextResponse.json(
        { error: 'Servicio OCR no configurado' },
        { status: 500 }
      );
    }

    // Generate a signed URL server-side (service role bypasses RLS) so n8n can
    // fetch the uploaded document. Doing this on the client fails with
    // "Object not found" because the browser session cannot sign the object.
    const filePath = formData.get('filePath');
    if (typeof filePath === 'string' && filePath) {
      const supabase = createAdminClient();
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('policy-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiration

      if (signedUrlError || !signedUrlData) {
        console.error('Failed to create signed URL:', signedUrlError);
        return NextResponse.json(
          { error: 'No se pudo generar acceso al documento' },
          { status: 500 }
        );
      }

      formData.set('fileUrl', signedUrlData.signedUrl);
    }

    // Forward the request to n8n with authentication
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${process.env.N8N_WEBHOOK_SECRET}`,
      },
    });

    if (!n8nResponse.ok) {
      const errorBody = await n8nResponse.text().catch(() => n8nResponse.statusText);
      console.error('N8N webhook failed:', {
        status: n8nResponse.status,
        statusText: n8nResponse.statusText,
        body: errorBody,
      });
      return NextResponse.json(
        { error: 'Error al procesar el documento con OCR' },
        { status: n8nResponse.status }
      );
    }

    let data: any;
    try {
      data = await n8nResponse.json();
    } catch (parseError) {
      console.error('Failed to parse N8N response as JSON:', parseError);
      return NextResponse.json(
        { error: 'Respuesta inválida del servicio OCR' },
        { status: 500 }
      );
    }

    console.log('N8N response received:', {
      hasOutput: !!data?.output,
      outputLength: Array.isArray(data?.output) ? data.output.length : 0,
      dataKeys: Object.keys(data).slice(0, 5),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('OCR webhook error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor OCR' },
      { status: 500 }
    );
  }
}
