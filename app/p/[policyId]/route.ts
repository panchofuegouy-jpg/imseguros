import { createClient } from "@/lib/supabase/server";
import { resolvePolicyFileUrl } from "@/lib/policy-file-url";
import { redirect } from "next/navigation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ policyId: string }> }
) {
  const { policyId } = await params;

  try {
    const supabase = await createClient();

    const { data: policy, error } = await supabase
      .from("policies")
      .select("archivo_urls")
      .eq("id", policyId)
      .single();

    if (error || !policy || !policy.archivo_urls || policy.archivo_urls.length === 0) {
      return new Response("Póliza no encontrada", { status: 404 });
    }

    const fileUrl = resolvePolicyFileUrl(policy.archivo_urls[0]);
    redirect(fileUrl);
  } catch (error) {
    console.error("Error fetching policy:", error);
    return new Response("Error al obtener la póliza", { status: 500 });
  }
}
