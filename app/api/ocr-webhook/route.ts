import { NextRequest, NextResponse } from 'next/server';

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
