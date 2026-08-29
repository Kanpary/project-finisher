import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const registerSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(6).max(72),
  cpf: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 11, "CPF inválido"),
  phone: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 10 && v.length <= 11, "Telefone inválido"),
  referralCode: z.string().trim().max(32).optional().nullable(),
});

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** Cria a conta do jogador (perfil + carteira + vínculo de indicação). */
export const registerPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingCpf } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("cpf", data.cpf)
      .maybeSingle();
    if (existingCpf) throw new Error("Já existe uma conta cadastrada com este CPF.");

    let referredBy: string | null = null;
    if (data.referralCode) {
      const { data: referrer } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("referral_code", data.referralCode.toUpperCase())
        .maybeSingle();
      referredBy = referrer?.user_id ?? null;
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createError || !created.user) {
      const msg = createError?.message ?? "Falha ao criar usuário";
      throw new Error(/already/i.test(msg) ? "Este e-mail já está cadastrado." : msg);
    }

    const userId = created.user.id;

    let referralCode = randomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: clash } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("referral_code", referralCode)
        .maybeSingle();
      if (!clash) break;
      referralCode = randomCode();
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      email: data.email,
      full_name: data.fullName,
      cpf: data.cpf,
      phone: data.phone,
      username: data.email.split("@")[0] ?? null,
      referral_code: referralCode,
      referred_by: referredBy,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profileError.message);
    }

    await supabaseAdmin.from("wallets").insert({ user_id: userId });
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "user" });

    return { ok: true as const, userId, referralCode };
  });
