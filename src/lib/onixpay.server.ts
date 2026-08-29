/**
 * OnixPay API v2 client (server-only).
 * Docs: https://onixpay.space/docs/
 *
 * Endpoints (form-urlencoded POST, credentials in the body):
 *  - POST /pix/qrcode.php   -> gera QR Code PIX (depósito)
 *  - POST /pix/payment.php  -> transferência PIX (saque)
 *  - GET  /pix/status.php   -> consulta status da transação
 *  - GET  /account/balance.php -> saldo da conta
 */

const DEFAULT_BASE_URL = "https://onixpay.space/api/v2";

function credentials() {
  const clientId = process.env["ONIXPAY_CLIENT_ID"];
  const clientSecret = process.env["ONIXPAY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais OnixPay não configuradas (ONIXPAY_CLIENT_ID / ONIXPAY_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

function baseUrl(override?: string | null): string {
  const raw = (override || process.env["ONIXPAY_API_BASE_URL"] || DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

export interface OnixPixQrCodeResult {
  statusCode: number;
  message?: string;
  qrcode?: string;
  transactionId?: string;
  amount?: number;
  reference_code?: string;
  gateway?: string;
  [key: string]: unknown;
}

export interface OnixPaymentResult {
  statusCode: number;
  message?: string;
  transactionId?: string;
  reference_code?: string;
  status?: string;
  [key: string]: unknown;
}

export interface OnixTransactionStatus {
  statusCode: number;
  message?: string;
  transaction?: {
    transactionId: string;
    external_id?: string;
    status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | string;
    type?: "DEPOSIT" | "WITHDRAW" | string;
    amount?: number;
    tax?: number;
    total?: number;
    paid_at?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { statusCode: response.status, message: text.slice(0, 500) };
  }
}

async function postForm(path: string, params: Record<string, string>, apiBaseUrl?: string | null) {
  const response = await fetch(`${baseUrl(apiBaseUrl)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = typeof data["message"] === "string" ? data["message"] : `HTTP ${response.status}`;
    throw new Error(`OnixPay ${path}: ${message}`);
  }
  return data;
}

/** Gera um QR Code PIX para depósito. `valor` em reais. */
export async function createPixQrCode(input: {
  nome: string;
  cpf: string;
  valor: number;
  descricao?: string;
  urlnoty?: string;
  apiBaseUrl?: string | null;
}): Promise<OnixPixQrCodeResult> {
  const { clientId, clientSecret } = credentials();
  const params: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    nome: input.nome,
    cpf: input.cpf.replace(/\D/g, ""),
    valor: input.valor.toFixed(2),
  };
  if (input.descricao) params["descricao"] = input.descricao;
  if (input.urlnoty) params["urlnoty"] = input.urlnoty;
  return (await postForm("/pix/qrcode.php", params, input.apiBaseUrl)) as OnixPixQrCodeResult;
}

/** Realiza uma transferência PIX (saque) para a chave informada. */
export async function createPixPayment(input: {
  nome: string;
  cpf: string;
  valor: number;
  chave_pix: string;
  descricao?: string;
  urlnoty?: string;
  apiBaseUrl?: string | null;
}): Promise<OnixPaymentResult> {
  const { clientId, clientSecret } = credentials();
  const params: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    nome: input.nome,
    cpf: input.cpf.replace(/\D/g, ""),
    valor: input.valor.toFixed(2),
    chave_pix: input.chave_pix,
  };
  if (input.descricao) params["descricao"] = input.descricao;
  if (input.urlnoty) params["urlnoty"] = input.urlnoty;
  return (await postForm("/pix/payment.php", params, input.apiBaseUrl)) as OnixPaymentResult;
}

/** Consulta o status de uma transação (depósito ou saque). */
export async function getTransactionStatus(input: {
  transactionId?: string | undefined;
  referenceCode?: string | undefined;
  apiBaseUrl?: string | null;
}): Promise<OnixTransactionStatus> {
  const { clientId, clientSecret } = credentials();
  const query = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  if (input.transactionId) query.set("transaction_id", input.transactionId);
  if (input.referenceCode) query.set("reference_code", input.referenceCode);
  const response = await fetch(`${baseUrl(input.apiBaseUrl)}/pix/status.php?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = typeof data["message"] === "string" ? data["message"] : `HTTP ${response.status}`;
    throw new Error(`OnixPay status: ${message}`);
  }
  return data as OnixTransactionStatus;
}

/** Consulta o saldo da conta OnixPay. */
export async function getAccountBalance(apiBaseUrl?: string | null) {
  const { clientId, clientSecret } = credentials();
  const query = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  const response = await fetch(`${baseUrl(apiBaseUrl)}/account/balance.php?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });
  return (await readJson(response)) as {
    statusCode: number;
    message?: string;
    balance?: { available: number; blocked: number; total: number };
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Valida a assinatura HMAC do webhook.
 * Header: `X-OnixPay-Signature: sha256=<hex>` — HMAC-SHA256 do corpo bruto
 * usando o webhook secret gerado no painel OnixPay.
 */
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = process.env["ONIXPAY_WEBHOOK_SECRET"];
  if (!secret) return false;
  if (!signatureHeader) return false;
  const received = signatureHeader.trim().replace(/^sha256=/i, "").toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(expected, received);
}

/** true quando o segredo de webhook está configurado (assinatura obrigatória). */
export function webhookSignatureRequired(): boolean {
  return Boolean(process.env["ONIXPAY_WEBHOOK_SECRET"]);
}
