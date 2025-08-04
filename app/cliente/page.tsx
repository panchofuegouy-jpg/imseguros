import { createClient } from "@/lib/supabase/server";
import { ClientLayout } from "@/components/client-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Shield } from "lucide-react";
import ClientStats from "@/components/client-stats";

async function getClientName() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return "Tu";
  }

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("clients(nombre)")
    .eq("id", user.id)
    .single();

  return (profileData?.clients as any)?.nombre || "Tu";
}

export default async function ClientDashboard() {
  const clientName = await getClientName();

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bienvenido, {clientName}!</h1>
          <p className="text-muted-foreground">Aquí puedes ver un resumen de tu información y gestionar tus pólizas.</p>
        </div>

        {/* Client Stats */}
        <ClientStats />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Mis Pólizas
              </CardTitle>
              <CardDescription>
                Gestiona y consulta todas tus pólizas de seguro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Accede a la información detallada de todas tus pólizas, fechas de vigencia y documentos.
                </p>
                <a 
                  href="/cliente/polizas" 
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  Ver mis pólizas
                  <FileText className="h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Portal de Cliente
              </CardTitle>
              <CardDescription>
                Tu espacio personal para gestionar tu información
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Mantén tu información actualizada y accede a todos los servicios disponibles.
                </p>
                <div className="flex flex-col space-y-1 text-sm">
                  <span className="text-muted-foreground">Servicios disponibles:</span>
                  <span>• Consulta de pólizas</span>
                  <span>• Descarga de documentos</span>
                  <span>• Información de vigencias</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientLayout>
  );
}
