import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const depositSchema = z.object({ amount: z.number().positive().max(50000) });
const depositIdSchema = z.object({ depositId: z.string().uuid() });
const withdrawalSchema = z.object({
  amount: z.number().positive().max(50000),
  pixKey: z.string().trim().min(4).max(140),
  pixKeyType: z.enum(["cpf", "email", "phone", "random"]),
  walletType: z.enum(["player", "affiliate"]),
});

/** Cria um depósito PIX na OnixPay e devolve o copia-e-cola. */
export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => depositSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPixQrCode } = await import("./onixpay.server");
    const { resolveWebhookUrl } = await import("./payments.server");

    const [{ data: financial }, { data: config }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("financial_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("onixpay_config").select("*").limit(1).maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("full_name, cpf, email")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    if (financial && financial.pix_enabled === false) throw new Error("Depósitos via PIX estão desativados.");
    if (config && config.is_enabled === false) throw new Error("Gateway de pagamento indisponível no momento.");

    const min = Number(financial?.min_deposit ?? 10);
    if (data.amount < min) throw new Error(`O depósito mínimo é de R$ ${min.toFixed(2)}.`);
    if (!profile?.cpf) throw new Error("Complete seu cadastro com um CPF válido antes de depositar.");

    const urlnoty = resolveWebhookUrl(getRequest().url, config?.deposit_callback_url ?? null);

    const result = await createPixQrCode({
      nome: profile.full_name || "Jogador",
      cpf: profile.cpf,
      valor: data.amount,
      descricao: "Depósito Panda Pay",
      urlnoty,
      apiBaseUrl: config?.api_base_url ?? null,
    });

    if (!result.qrcode) {
      throw new Error(result.message || "Não foi possível gerar o QR Code PIX.");
    }

    const transactionId = result.transactionId ?? result.reference_code ?? null;
    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: context.userId,
        amount: data.amount,
        status: "pending",
        provider: "onixpay",
        gateway: "onixpay",
        pix_code: result.qrcode,
        qr_code: result.qrcode,
        transaction_id: transactionId,
        external_id: result.reference_code ?? transactionId,
        response: result as never,
      })
      .select("id, amount, pix_code, transaction_id, created_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      depositId: deposit.id,
      amount: Number(deposit.amount),
      pixCode: deposit.pix_code ?? result.qrcode,
      transactionId: deposit.transaction_id,
    };
  });

/** Consulta o status do depósito e credita caso a OnixPay já tenha confirmado. */
export const checkDepositStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => depositIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTransactionStatus } = await import("./onixpay.server");
    const { creditDeposit } = await import("./payments.server");

    const { data: deposit } = await supabaseAdmin
      .from("deposits")
      .select("*")
      .eq("id", data.depositId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!deposit) throw new Error("Depósito não encontrado.");
    if (deposit.status === "paid") return { status: "paid" as const, credited: false };
    if (deposit.status !== "pending") return { status: deposit.status, credited: false };

    if (!deposit.transaction_id && !deposit.external_id) {
      return { status: deposit.status, credited: false };
    }

    const { data: config } = await supabaseAdmin
      .from("onixpay_config")
      .select("api_base_url")
      .limit(1)
      .maybeSingle();

    try {
      const status = await getTransactionStatus({
        transactionId: deposit.transaction_id ?? undefined,
        referenceCode: deposit.external_id ?? undefined,
        apiBaseUrl: config?.api_base_url ?? null,
      });
      const remote = status.transaction?.status?.toUpperCase();
      if (remote === "PAID") {
        const result = await creditDeposit(supabaseAdmin, deposit.id);
        return { status: "paid" as const, credited: result.credited };
      }
      if (remote === "FAILED" || remote === "CANCELLED") {
        await supabaseAdmin
          .from("deposits")
          .update({ status: remote === "FAILED" ? "failed" : "canceled" })
          .eq("id", deposit.id)
          .eq("status", "pending");
        return { status: remote === "FAILED" ? ("failed" as const) : ("canceled" as const), credited: false };
      }
    } catch (error) {
      console.error("checkDepositStatus", error);
    }
    return { status: "pending" as const, credited: false };
  });

export const listMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("deposits")
      .select("id, amount, bonus_amount, total_credited, status, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

/** Solicita um saque: debita a carteira na hora e cria o pedido pendente. */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => withdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyWalletMovement } = await import("./payments.server");

    const [{ data: financial }, { data: wallet }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("financial_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("wallets").select("*").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name, cpf").eq("user_id", context.userId).maybeSingle(),
    ]);

    const min =
      data.walletType === "affiliate"
        ? Number(financial?.min_withdrawal_affiliate ?? 50)
        : Number(financial?.min_withdrawal_player ?? 50);
    if (data.amount < min) throw new Error(`O saque mínimo é de R$ ${min.toFixed(2)}.`);
    if (!profile?.cpf) throw new Error("Cadastre um CPF válido para solicitar saques.");

    const balance = Number(
      data.walletType === "affiliate" ? (wallet?.affiliate_balance ?? 0) : (wallet?.player_balance ?? 0),
    );
    if (data.amount > balance) throw new Error("Saldo insuficiente para este saque.");

    const feePercent = Number(financial?.withdrawal_fee_percent ?? 0);
    const feeFixed = Number(financial?.withdrawal_fee_fixed ?? 0);
    const fee = Number(((data.amount * feePercent) / 100 + feeFixed).toFixed(2));
    const net = Number((data.amount - fee).toFixed(2));
    if (net <= 0) throw new Error("O valor solicitado não cobre as taxas de saque.");

    await applyWalletMovement(supabaseAdmin, {
      userId: context.userId,
      wallet: data.walletType,
      amount: -data.amount,
      type: data.walletType === "affiliate" ? "withdrawal_affiliate" : "withdrawal_player",
      description: `Solicitação de saque PIX (${data.pixKeyType})`,
    });

    const { data: withdrawal, error } = await supabaseAdmin
      .from("withdrawals")
      .insert({
        user_id: context.userId,
        amount: data.amount,
        fee_amount: fee,
        net_amount: net,
        pix_key: data.pixKey,
        pix_key_type: data.pixKeyType,
        wallet_type: data.walletType,
        status: "pending",
      })
      .select("id, amount, fee_amount, net_amount, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    return withdrawal;
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("withdrawals")
      .select("id, amount, fee_amount, net_amount, status, wallet_type, pix_key, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });
