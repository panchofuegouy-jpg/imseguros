import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      return NextResponse.json(
        { error: 'N8N webhook URL not configured' },
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
        return NextResponse.json(
          { error: `No se pudo generar la URL firmada: ${signedUrlError?.message ?? 'desconocido'}` },
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
      return NextResponse.json(
        { error: `N8N error: ${n8nResponse.statusText}` },
        { status: n8nResponse.status }
      );
    }

    const data = await n8nResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('OCR webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
