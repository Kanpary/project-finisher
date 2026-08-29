import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Garante que o chamador autenticado possui a role admin.
 * Usa o client com RLS do próprio usuário (nunca o service role) para decidir.
 */
export async function assertAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

/** Registra uma ação administrativa em admin_logs. */
export async function logAdminAction(
  admin: SupabaseClient<Database>,
  entry: {
    admin_user_id: string;
    action: string;
    target_user_id?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await admin.from("admin_logs").insert({
    admin_user_id: entry.admin_user_id,
    action: entry.action,
    target_user_id: entry.target_user_id ?? null,
    metadata: (entry.metadata ?? null) as never,
  });
}
