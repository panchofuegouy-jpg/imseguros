import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route para procesar OCR en archivos de pólizas
 * POST /api/policies/ocr
 * 
 * Body: FormData con archivo
 * Returns: { text: string, extractedData: object }
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que sea admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    // Aquí puedes integrar con servicios de OCR como:
    // - Google Cloud Vision API
    // - AWS Textract
    // - Azure Computer Vision
    // - Tesseract en servidor
    
    // Por ahora, retornamos un placeholder
    // En producción, implementa la integración con tu servicio de OCR preferido
    
    return NextResponse.json({
      error: 'OCR API no implementada. Usa el componente del cliente con Tesseract.js',
      message: 'Para implementar OCR del lado del servidor, integra con Google Cloud Vision, AWS Textract o similar'
    }, { status: 501 });

  } catch (error: any) {
    console.error('Error en OCR API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
