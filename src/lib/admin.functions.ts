import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const listUsersSchema = z.object({
  search: z.string().trim().max(120).optional().nullable(),
  page: z.number().int().min(0).max(500).default(0),
  pageSize: z.number().int().min(5).max(100).default(20),
});

const userIdSchema = z.object({ userId: z.string().uuid() });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  isInfluencer: z.boolean().optional(),
  customCommissionPercent: z.number().min(0).max(100).nullable().optional(),
  customBonusPercent: z.number().min(0).max(500).nullable().optional(),
  customCoinReturn: z.number().min(0).max(100).nullable().optional(),
  customGameDifficulty: z.number().min(0).max(100).nullable().optional(),
  customGameSpeed: z.number().min(0).max(100).nullable().optional(),
  customJumpHeight: z.number().min(0).max(100).nullable().optional(),
  comissaoCpa: z.number().min(0).max(100000).nullable().optional(),
  comissaoCpaNivel2: z.number().min(0).max(100000).nullable().optional(),
});

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
  grant: z.boolean(),
});

const adjustBalanceSchema = z.object({
  userId: z.string().uuid(),
  wallet: z.enum(["player", "affiliate"]),
  amount: z.number().refine((v) => v !== 0, "Informe um valor diferente de zero"),
  reason: z.string().trim().min(3).max(200),
});

const listSchema = z.object({
  status: z.string().trim().max(20).optional().nullable(),
  search: z.string().trim().max(120).optional().nullable(),
  limit: z.number().int().min(1).max(200).default(50),
});

const depositIdSchema = z.object({ depositId: z.string().uuid(), reason: z.string().trim().max(200).optional() });
const withdrawalIdSchema = z.object({
  withdrawalId: z.string().uuid(),
  reason: z.string().trim().max(200).optional(),
});

const bannerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  imageUrl: z.string().trim().url().max(500),
  title: z.string().trim().max(120).optional().nullable(),
  subtitle: z.string().trim().max(200).optional().nullable(),
  placement: z.enum(["landing", "login", "register", "dashboard", "global"]),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

const settingsSchema = z.object({
  table: z.enum([
    "game_settings",
    "character_settings",
    "financial_settings",
    "commission_settings",
    "influencer_settings",
    "onixpay_config",
  ]),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

/** Métricas gerais do painel administrativo. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, deposits, withdrawals, pendingWithdrawals, sessions, wallets] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }),
      supabaseAdmin.from("deposits").select("amount, total_credited, status, created_at").eq("status", "paid"),
      supabaseAdmin.from("withdrawals").select("amount, status, created_at"),
      supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("game_sessions").select("bet_amount, payout_amount, status"),
      supabaseAdmin.from("wallets").select("player_balance, affiliate_balance"),
    ]);

    const depositRows = deposits.data ?? [];
    const withdrawalRows = withdrawals.data ?? [];
    const sessionRows = sessions.data ?? [];
    const walletRows = wallets.data ?? [];
    const today = new Date().toISOString().slice(0, 10);

    const sum = (rows: { amount: number | null }[]) => rows.reduce((a, r) => a + Number(r.amount ?? 0), 0);

    const totalBets = sessionRows.reduce((a, r) => a + Number(r.bet_amount ?? 0), 0);
    const totalPayouts = sessionRows.reduce((a, r) => a + Number(r.payout_amount ?? 0), 0);

    return {
      totalUsers: users.count ?? 0,
      totalDeposited: sum(depositRows),
      depositedToday: sum(depositRows.filter((d) => (d.created_at ?? "").startsWith(today))),
      totalWithdrawn: sum(withdrawalRows.filter((w) => w.status === "paid")),
      pendingWithdrawals: pendingWithdrawals.count ?? 0,
      totalBets,
      totalPayouts,
      ggr: Number((totalBets - totalPayouts).toFixed(2)),
      liabilityPlayer: walletRows.reduce((a, w) => a + Number(w.player_balance ?? 0), 0),
      liabilityAffiliate: walletRows.reduce((a, w) => a + Number(w.affiliate_balance ?? 0), 0),
      gamesPlayed: sessionRows.length,
    };
  });

/* ------------------------------------------------------------------ */
/* Usuários e roles                                                     */
/* ------------------------------------------------------------------ */

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listUsersSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * data.pageSize, data.page * data.pageSize + data.pageSize - 1);

    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(
        `full_name.ilike.${term},email.ilike.${term},cpf.ilike.${term},referral_code.ilike.${term}`,
      );
    }

    const { data: profiles, count, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.user_id);
    const [{ data: wallets }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("wallets").select("*").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    return {
      total: count ?? 0,
      users: (profiles ?? []).map((profile) => ({
        ...profile,
        wallet: (wallets ?? []).find((w) => w.user_id === profile.user_id) ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === profile.user_id).map((r) => r.role),
      })),
    };
  });

export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => userIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profile, wallet, transactions, deposits, withdrawals, roles, referrals] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("wallets").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabaseAdmin
        .from("deposits")
        .select("id, amount, status, created_at, paid_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("withdrawals")
        .select("id, amount, net_amount, status, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
      supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }).eq("referred_by", data.userId),
    ]);

    return {
      profile: profile.data,
      wallet: wallet.data,
      transactions: transactions.data ?? [],
      deposits: deposits.data ?? [],
      withdrawals: withdrawals.data ?? [],
      roles: (roles.data ?? []).map((r) => r.role),
      referralCount: referrals.count ?? 0,
    };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {};
    if (data.fullName !== undefined) patch["full_name"] = data.fullName;
    if (data.phone !== undefined) patch["phone"] = data.phone || null;
    if (data.isInfluencer !== undefined) patch["is_influencer"] = data.isInfluencer;
    if (data.customCommissionPercent !== undefined) patch["custom_commission_percent"] = data.customCommissionPercent;
    if (data.customBonusPercent !== undefined) patch["custom_bonus_percent"] = data.customBonusPercent;
    if (data.customCoinReturn !== undefined) patch["custom_coin_return"] = data.customCoinReturn;
    if (data.customGameDifficulty !== undefined) patch["custom_game_difficulty"] = data.customGameDifficulty;
    if (data.customGameSpeed !== undefined) patch["custom_game_speed"] = data.customGameSpeed;
    if (data.customJumpHeight !== undefined) patch["custom_jump_height"] = data.customJumpHeight;
    if (data.comissaoCpa !== undefined) patch["comissao_cpa"] = data.comissaoCpa;
    if (data.comissaoCpaNivel2 !== undefined) patch["comissao_cpa_nivel2"] = data.comissaoCpaNivel2;

    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabaseAdmin.from("profiles").update(patch as never).eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await logAdminAction(supabaseAdmin, {
      admin_user_id: context.userId,
      action: "update_user",
      target_user_id: data.userId,
      metadata: patch,
    });
    return { ok: true as const };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.role === "admin" && !data.grant && data.userId === context.userId) {
      throw new Error("Você não pode remover a sua própria permissão de admin.");
    }

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    await logAdminAction(supabaseAdmin, {
      admin_user_id: context.userId,
      action: data.grant ? "grant_role" : "revoke_role",
      target_user_id: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true as const };
  });

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adjustBalanceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyWalletMovement } = await import("./payments.server");

    const credit = data.amount > 0;
    const type =
      data.wallet === "player"
        ? credit
          ? ("admin_credit_player" as const)
          : ("admin_debit_player" as const)
        : credit
          ? ("admin_credit_affiliate" as const)
          : ("admin_debit_affiliate" as const);

    const result = await applyWalletMovement(supabaseAdmin, {
      userId: data.userId,
      wallet: data.wallet,
      amount: Number(data.amount.toFixed(2)),
      type,
      description: credit ? "Crédito manual do administrador" : "Débito manual do administrador",
      reason: data.reason,
      adminId: context.userId,
    });

    await logAdminAction(supabaseAdmin, {
      admin_user_id: context.userId,
      action: "adjust_balance",
      target_user_id: data.userId,
      metadata: { wallet: data.wallet, amount: data.amount, reason: data.reason },
    });

    return result;
  });

/* ------------------------------------------------------------------ */
/* Depósitos                                                           */
/* ------------------------------------------------------------------ */

export const listDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("deposits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status && data.status !== "all") query = query.eq("status", data.status as never);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, email, cpf")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    return (rows ?? []).map((row) => ({
      ...row,
      profile: (profiles ?? []).find((p) => p.user_id === row.user_id) ?? null,
    }));
  });

/** Confirma manualmente um depósito pendente (credita saldo + bônus + comissões). */
export const approveDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => depositIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { creditDeposit } = await import("./payments.server");

    const result = await creditDeposit(supabaseAdmin, data.depositId, { adminId: context.userId });
    await logAdminAction(supabaseAdmin, {
      admin_user_id: context.userId,
      action: "approve_deposit",
      metadata: { depositId: data.depositId, credited: result.credited },
    });
    return result;
  });

export const rejectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => depositIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: updated, error } = await supabaseAdmin
      .from("deposits")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        admin_id: context.userId,
      })
      .eq("id", data.depositId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Somente depósitos pendentes podem ser recusados.");

    await logAdminAction(supabaseAdmin, {
      admin_user_id: context.userId,
      action: "reject_deposit",
      metadata: { depositId: data.depositId, reason: data.reason ?? null },
    });
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Saques                                                              */
/* ------------------------------------------------------------------ */

export const listWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status && data.status !== "all") query = query.eq("status", data.status as never);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, email, cpf")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    return (rows ?? []).map((row) => ({
      ...row,
      profile: (profiles ?? []).find((p) => p.user_id === row.user_id) ?? null,
    }));
  });

/** Aprova o saque e dispara a transferência PIX na OnixPay. */
export const approveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => withdrawalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPixPayment } = await import("./onixpay.server");
    const { resolveWebhookUrl } = await import("./payments.server");

    const { data: withdrawal } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (!withdrawal) throw new Error("Saque não encontrado.");
    if (withdrawal.status !== "pending" && withdrawal.status !== "approved") {
      throw new Error("Este saque já foi processado.");
    }
    if (!withdrawal.pix_key) throw new Error("Saque sem chave PIX informada.");

    const [{ data: profile }, { data: config }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, cpf").eq("user_id", withdrawal.user_id).maybeSingle(),
      supabaseAdmin.from("onixpay_config").select("*").limit(1).maybeSingle(),
    ]);
    if (!profile?.cpf) throw new Error("O jogador não possui CPF cadastrado.");

    // Trava o registro para evitar pagamento duplicado.
    const { data: claimed } = await supabaseAdmin
      .from("withdrawals")
      .update({ status: "processing", processed_at: new Date().toISOString(), admin_id: context.userId })
      .eq("id", withdrawal.id)
      .in("status", ["pending", "approved"])
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("Este saque já está sendo processado.");

    const urlnoty = resolveWebhookUrl(getRequest().url, config?.withdrawal_callback_url ?? null);

    try {
      const result = await createPixPayment({
        nome: profile.full_name || "Jogador",
        cpf: profile.cpf,
        valor: Number(withdrawal.net_amount || withdrawal.amount),
        chave_pix: withdrawal.pix_key,
        descricao: "Saque Panda Pay",
        urlnoty,
        apiBaseUrl: config?.api_base_url ?? null,
      });

      const remoteStatus = (result.status ?? "").toUpperCase();
      const paid = remoteStatus === "PAID" || remoteStatus === "COMPLETED";
      await supabaseAdmin
        .from("withdrawals")
        .update({
          status: paid ? "paid" : "processing",
          paid_at: paid ? new Date().toISOString() : null,
          transaction_id: result.transactionId ?? null,
          external_id: result.reference_code ?? result.transactionId ?? null,
          response: result as never,
        })
        .eq("id", withdrawal.id);

      if (paid) {
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("total_withdrawn")
          .eq("user_id", withdrawal.user_id)
          .maybeSingle();
        await supabaseAdmin
          .from("wallets")
          .update({ total_withdrawn: Number(wallet?.total_withdrawn ?? 0) + Number(withdrawal.amount) })
          .eq("user_id", withdrawal.user_id);
      }

      await logAdminAction(supabaseAdmin, {
        admin_user_id: context.userId,
        action: "approve_withdrawal",
        target_user_id: withdrawal.user_id,
        metadata: { withdrawalId: withdrawal.id, paid },
      });

      return { status: paid ? ("paid" as const) : ("processing" as const), message: result.message ?? null };
    } catch (error) {
      await supabaseAdmin
        .from("withdrawals")
        .update({ status: "pending", notes: (error as Error).message.slice(0, 200) })
        .eq("id", withdrawal.id);
      throw error;
    }
  });

/** Recusa o saque e devolve o valor à carteira de origem. */
export const rejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => withdrawalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refundWithdrawal } = await import("./payments.server");

    await refundWithdrawal(
      supabaseAdmin,
      data.withdrawalId,
      data.reason || "Saque recusado pelo administrador",
      context.userId,
    );
    await logAdminAction(supabaseAdmin, {
      admin_user_id: context.userId,
      action: "reject_withdrawal",
      metadata: { withdrawalId: data.withdrawalId, reason: data.reason ?? null },
    });
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Configurações                                                        */
/* ------------------------------------------------------------------ */

export const getAllSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [game, character, financial, commission, influencer, onixpay] = await Promise.all([
      supabaseAdmin.from("game_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("character_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("financial_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("commission_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("influencer_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("onixpay_config").select("*").limit(1).maybeSingle(),
    ]);

    return {
      game: game.data,
      character: character.data,
      financial: financial.data,
      commission: commission.data,
      influencer: influencer.data,
      onixpay: onixpay.data,
    };
  });

/** Atualiza (ou cria) a linha única de uma tabela de configuração. */
export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, logAdminAction } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const values = { ...data.values, updated_at: new Date().toISOString() };
    const { data: existing } = await supabaseAdmin.from(data.table).select("id").limit(1).maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin.from(data.table).update(values as never).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from(data.table).insert(values as never);
      if (error) throw new Error(error.message);
    }

    await logAdminAction(supabaseAdmin, {
      admin_user_id: context.userId,
      action: "update_settings",
      metadata: { table: data.table, values: data.values },
    });
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Banners                                                             */
/* ------------------------------------------------------------------ */

export const listBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("banners")
      .select("*")
      .order("placement")
      .order("sort_order");
    return data ?? [];
  });

export const saveBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bannerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      image_url: data.imageUrl,
      title: data.title || null,
      subtitle: data.subtitle || null,
      placement: data.placement,
      sort_order: data.sortOrder,
      is_active: data.isActive,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("banners").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("banners")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: created.id };
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Comissões e logs                                                     */
/* ------------------------------------------------------------------ */

export const listCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("affiliate_commissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status && data.status !== "all") query = query.eq("status", data.status as never);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = [...new Set((rows ?? []).flatMap((r) => [r.affiliate_user_id, r.referred_user_id]))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    return (rows ?? []).map((row) => ({
      ...row,
      affiliate: (profiles ?? []).find((p) => p.user_id === row.affiliate_user_id) ?? null,
      referred: (profiles ?? []).find((p) => p.user_id === row.referred_user_id) ?? null,
    }));
  });

export const listAdminLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    const ids = [...new Set((rows ?? []).map((r) => r.admin_user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    return (rows ?? []).map((row) => ({
      ...row,
      admin: (profiles ?? []).find((p) => p.user_id === row.admin_user_id) ?? null,
    }));
  });
