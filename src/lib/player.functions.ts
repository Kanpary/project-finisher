import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dados completos do painel do jogador (perfil, carteira, extrato, afiliados). */
export const getPlayerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, walletRes, txRes, sessionsRes, commissionsRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("game_sessions")
        .select("id, bet_amount, payout_amount, coins_collected, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("affiliate_commissions")
        .select("id, amount, status, source_type, created_at")
        .eq("affiliate_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count: referralCount } = await supabaseAdmin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("referred_by", userId);

    return {
      profile: profileRes.data,
      wallet: walletRes.data,
      transactions: txRes.data ?? [],
      sessions: sessionsRes.data ?? [],
      commissions: commissionsRes.data ?? [],
      referralCount: referralCount ?? 0,
      isAdmin: Boolean(roleRes.data),
    };
  });

const profileSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 0 || (v.length >= 10 && v.length <= 11), "Telefone inválido"),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName, phone: data.phone || null })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
