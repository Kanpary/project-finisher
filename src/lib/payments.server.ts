import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
type WalletTxType = Database["public"]["Enums"]["wallet_tx_type"];

export const ONIXPAY_WEBHOOK_PATH = "/api/public/webhooks/onixpay";

/** Aplica um lançamento na carteira e registra o extrato de forma consistente. */
export async function applyWalletMovement(
  admin: Admin,
  input: {
    userId: string;
    wallet: "player" | "affiliate";
    amount: number; // positivo credita, negativo debita
    type: WalletTxType;
    description?: string;
    reason?: string;
    adminId?: string | null;
    gameSessionId?: string | null;
    extra?: Partial<Database["public"]["Tables"]["wallets"]["Update"]>;
  },
) {
  const { data: wallet, error } = await admin
    .from("wallets")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!wallet) {
    await admin.from("wallets").insert({ user_id: input.userId });
  }
  const current = wallet ?? {
    player_balance: 0,
    affiliate_balance: 0,
    comissao_disponivel: 0,
    total_deposited: 0,
    total_withdrawn: 0,
    total_affiliate_earned: 0,
  };

  const balanceBefore = Number(
    input.wallet === "player" ? current.player_balance : current.affiliate_balance,
  );
  const balanceAfter = Number((balanceBefore + input.amount).toFixed(2));
  if (balanceAfter < 0) throw new Error("Saldo insuficiente.");

  const update: Database["public"]["Tables"]["wallets"]["Update"] = { ...(input.extra ?? {}) };
  if (input.wallet === "player") {
    update.player_balance = balanceAfter;
  } else {
    update.affiliate_balance = balanceAfter;
    update.comissao_disponivel = balanceAfter;
  }

  const { error: updateError } = await admin.from("wallets").update(update).eq("user_id", input.userId);
  if (updateError) throw new Error(updateError.message);

  await admin.from("wallet_transactions").insert({
    user_id: input.userId,
    type: input.type,
    amount: input.amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    description: input.description ?? null,
    reason: input.reason ?? null,
    admin_id: input.adminId ?? null,
    game_session_id: input.gameSessionId ?? null,
  });

  return { balanceBefore, balanceAfter };
}

async function payAffiliateCommissions(admin: Admin, userId: string, depositAmount: number, depositId: string) {
  const { data: settings } = await admin.from("commission_settings").select("*").limit(1).maybeSingle();
  if (!settings || !settings.is_active) return;
  if (depositAmount < Number(settings.min_deposit_for_commission ?? 0)) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, referred_by")
    .eq("user_id", userId)
    .maybeSingle();
  const level1Id = profile?.referred_by ?? null;
  if (!level1Id) return;

  if (settings.first_deposit_only) {
    const { count } = await admin
      .from("deposits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "paid");
    if ((count ?? 0) > 1) return;
  }

  const { data: level1Profile } = await admin
    .from("profiles")
    .select("user_id, referred_by, custom_commission_percent, comissao_cpa")
    .eq("user_id", level1Id)
    .maybeSingle();

  const percent1 = Number(
    level1Profile?.custom_commission_percent ?? settings.default_commission_percent ?? 0,
  );
  const amount1 = Number(((depositAmount * percent1) / 100).toFixed(2));
  if (amount1 > 0) {
    await admin.from("affiliate_commissions").insert({
      affiliate_user_id: level1Id,
      referred_user_id: userId,
      amount: amount1,
      source_type: "deposit",
      source_id: depositId,
      status: "available",
    });
    const { data: w } = await admin
      .from("wallets")
      .select("total_affiliate_earned")
      .eq("user_id", level1Id)
      .maybeSingle();
    await applyWalletMovement(admin, {
      userId: level1Id,
      wallet: "affiliate",
      amount: amount1,
      type: "commission",
      description: `Comissão nível 1 sobre depósito`,
      extra: { total_affiliate_earned: Number(w?.total_affiliate_earned ?? 0) + amount1 },
    });
  }

  const level2Id = level1Profile?.referred_by ?? null;
  const percent2 = Number(settings.default_commission_percent_level2 ?? 0);
  if (level2Id && percent2 > 0) {
    const amount2 = Number(((depositAmount * percent2) / 100).toFixed(2));
    if (amount2 > 0) {
      await admin.from("affiliate_commissions").insert({
        affiliate_user_id: level2Id,
        referred_user_id: userId,
        amount: amount2,
        source_type: "deposit",
        source_id: depositId,
        status: "available",
      });
      const { data: w2 } = await admin
        .from("wallets")
        .select("total_affiliate_earned")
        .eq("user_id", level2Id)
        .maybeSingle();
      await applyWalletMovement(admin, {
        userId: level2Id,
        wallet: "affiliate",
        amount: amount2,
        type: "commission",
        description: `Comissão nível 2 sobre depósito`,
        extra: { total_affiliate_earned: Number(w2?.total_affiliate_earned ?? 0) + amount2 },
      });
    }
  }
}

/**
 * Credita um depósito de forma idempotente: só processa quando o registro
 * ainda está pendente. Aplica bônus, extrato e comissões de afiliado.
 */
export async function creditDeposit(
  admin: Admin,
  depositId: string,
  options?: { adminId?: string | null },
): Promise<{ credited: boolean; total: number }> {
  const { data: deposit, error } = await admin
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!deposit) throw new Error("Depósito não encontrado.");
  if (deposit.status === "paid") return { credited: false, total: Number(deposit.total_credited ?? 0) };

  const amount = Number(deposit.amount);
  const { data: financial } = await admin.from("financial_settings").select("*").limit(1).maybeSingle();
  const { data: profile } = await admin
    .from("profiles")
    .select("custom_bonus_percent")
    .eq("user_id", deposit.user_id)
    .maybeSingle();

  let bonus = 0;
  const bonusPercent = Number(profile?.custom_bonus_percent ?? financial?.deposit_bonus_percent ?? 0);
  const bonusEnabled = financial?.deposit_bonus_enabled ?? false;
  const bonusMin = Number(financial?.deposit_bonus_min_amount ?? 0);
  if ((bonusEnabled || profile?.custom_bonus_percent) && bonusPercent > 0 && amount >= bonusMin) {
    bonus = Number(((amount * bonusPercent) / 100).toFixed(2));
  }
  const total = Number((amount + bonus).toFixed(2));

  // Marca como pago antes de creditar para evitar corrida com o webhook.
  const { data: claimed } = await admin
    .from("deposits")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      bonus_amount: bonus,
      total_credited: total,
      admin_id: options?.adminId ?? deposit.admin_id ?? null,
    })
    .eq("id", depositId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return { credited: false, total };

  const { data: wallet } = await admin
    .from("wallets")
    .select("total_deposited")
    .eq("user_id", deposit.user_id)
    .maybeSingle();

  await applyWalletMovement(admin, {
    userId: deposit.user_id,
    wallet: "player",
    amount: total,
    type: "deposit",
    description: bonus > 0 ? `Depósito PIX + bônus de ${formatPercent(bonusPercent)}` : "Depósito PIX",
    adminId: options?.adminId ?? null,
    extra: { total_deposited: Number(wallet?.total_deposited ?? 0) + amount },
  });

  await payAffiliateCommissions(admin, deposit.user_id, amount, depositId);

  return { credited: true, total };
}

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

/** Devolve o valor de um saque recusado/falho para a carteira de origem. */
export async function refundWithdrawal(
  admin: Admin,
  withdrawalId: string,
  reason: string,
  adminId?: string | null,
) {
  const { data: withdrawal } = await admin
    .from("withdrawals")
    .select("*")
    .eq("id", withdrawalId)
    .maybeSingle();
  if (!withdrawal) throw new Error("Saque não encontrado.");
  if (["rejected", "canceled", "paid"].includes(withdrawal.status)) {
    throw new Error("Este saque já foi finalizado.");
  }

  await applyWalletMovement(admin, {
    userId: withdrawal.user_id,
    wallet: withdrawal.wallet_type === "affiliate" ? "affiliate" : "player",
    amount: Number(withdrawal.amount),
    type: "withdrawal_refund",
    description: "Estorno de saque",
    reason,
    adminId: adminId ?? null,
  });

  await admin
    .from("withdrawals")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      notes: reason,
      admin_id: adminId ?? null,
    })
    .eq("id", withdrawalId);
}

/** Monta a URL de notificação (webhook) a partir da origem da requisição. */
export function resolveWebhookUrl(requestUrl: string, configured?: string | null): string {
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const origin = new URL(requestUrl).origin;
  return `${origin}${ONIXPAY_WEBHOOK_PATH}`;
}
