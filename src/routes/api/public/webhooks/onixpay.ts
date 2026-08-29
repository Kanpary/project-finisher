import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook OnixPay.
 * Header de assinatura: `X-OnixPay-Signature: sha256=<hmac-sha256(rawBody, ONIXPAY_WEBHOOK_SECRET)>`
 * Eventos: RECEIVEPIX (depósito) e transferências PIX (saque).
 */
export const Route = createFileRoute("/api/public/webhooks/onixpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature =
          request.headers.get("x-onixpay-signature") ??
          request.headers.get("x-signature") ??
          null;

        const { verifyWebhookSignature, webhookSignatureRequired } = await import(
          "@/lib/onixpay.server"
        );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { creditDeposit, applyWalletMovement } = await import("@/lib/payments.server");

        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const transactionId = String(payload["transactionId"] ?? payload["transaction_id"] ?? "");
        const eventType = String(payload["transactionType"] ?? payload["type"] ?? "unknown");
        const status = String(payload["status"] ?? "").toUpperCase();

        const logRow = {
          provider: "onixpay",
          event_type: eventType,
          external_id: transactionId || null,
          payload: payload as never,
          signature,
        };

        if (webhookSignatureRequired()) {
          const valid = await verifyWebhookSignature(rawBody, signature);
          if (!valid) {
            await supabaseAdmin
              .from("webhook_logs")
              .insert({ ...logRow, processing_status: "error", status_code: 401 });
            return new Response("Invalid signature", { status: 401 });
          }
        }

        try {
          if (!transactionId) {
            await supabaseAdmin
              .from("webhook_logs")
              .insert({ ...logRow, processing_status: "ignored", status_code: 200 });
            return new Response("Received", { status: 200 });
          }

          const { data: deposit } = await supabaseAdmin
            .from("deposits")
            .select("id, status")
            .or(`transaction_id.eq.${transactionId},external_id.eq.${transactionId}`)
            .maybeSingle();

          if (deposit) {
            if (status === "PAID") {
              await creditDeposit(supabaseAdmin, deposit.id);
            } else if (status === "FAILED" || status === "CANCELLED") {
              await supabaseAdmin
                .from("deposits")
                .update({ status: status === "FAILED" ? "failed" : "canceled", payload: payload as never })
                .eq("id", deposit.id)
                .eq("status", "pending");
            }
            await supabaseAdmin
              .from("webhook_logs")
              .insert({ ...logRow, processing_status: "processed", status_code: 200 });
            return new Response("OK", { status: 200 });
          }

          const { data: withdrawal } = await supabaseAdmin
            .from("withdrawals")
            .select("id, status, user_id, amount, wallet_type")
            .or(`transaction_id.eq.${transactionId},external_id.eq.${transactionId}`)
            .maybeSingle();

          if (withdrawal) {
            if (status === "PAID") {
              await supabaseAdmin
                .from("withdrawals")
                .update({ status: "paid", paid_at: new Date().toISOString(), response: payload as never })
                .eq("id", withdrawal.id)
                .neq("status", "paid");
              const { data: wallet } = await supabaseAdmin
                .from("wallets")
                .select("total_withdrawn")
                .eq("user_id", withdrawal.user_id)
                .maybeSingle();
              await supabaseAdmin
                .from("wallets")
                .update({
                  total_withdrawn: Number(wallet?.total_withdrawn ?? 0) + Number(withdrawal.amount),
                })
                .eq("user_id", withdrawal.user_id);
            } else if (status === "FAILED" || status === "CANCELLED") {
              if (!["rejected", "canceled", "paid"].includes(withdrawal.status)) {
                await applyWalletMovement(supabaseAdmin, {
                  userId: withdrawal.user_id,
                  wallet: withdrawal.wallet_type === "affiliate" ? "affiliate" : "player",
                  amount: Number(withdrawal.amount),
                  type: "withdrawal_refund",
                  description: "Estorno automático de saque não concluído",
                });
                await supabaseAdmin
                  .from("withdrawals")
                  .update({
                    status: "rejected",
                    rejected_at: new Date().toISOString(),
                    notes: "Falha reportada pelo gateway",
                    response: payload as never,
                  })
                  .eq("id", withdrawal.id);
              }
            }
            await supabaseAdmin
              .from("webhook_logs")
              .insert({ ...logRow, processing_status: "processed", status_code: 200 });
            return new Response("OK", { status: 200 });
          }

          await supabaseAdmin
            .from("webhook_logs")
            .insert({ ...logRow, processing_status: "ignored", status_code: 200 });
          return new Response("Received", { status: 200 });
        } catch (error) {
          console.error("[onixpay webhook]", error);
          await supabaseAdmin
            .from("webhook_logs")
            .insert({ ...logRow, processing_status: "error", status_code: 500 });
          return new Response("Processing error", { status: 500 });
        }
      },
      GET: async () => new Response("OnixPay webhook online", { status: 200 }),
    },
  },
});
