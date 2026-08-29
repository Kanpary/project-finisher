import type { Database } from "@/integrations/supabase/types";

type Enums = Database["public"]["Enums"];

/* ------------------------------------------------------------------ */
/* Status filters — espelham exatamente os enums do banco              */
/* ------------------------------------------------------------------ */

export type DepositStatus = Enums["deposit_status"];
export type WithdrawalStatus = Enums["withdrawal_status"];
export type CommissionStatus = Enums["commission_status"];

export type StatusFilter<T extends string> = "all" | T;

export const DEPOSIT_STATUSES: DepositStatus[] = [
  "pending",
  "paid",
  "failed",
  "rejected",
  "canceled",
];

export const WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  "pending",
  "approved",
  "processing",
  "paid",
  "rejected",
  "canceled",
];

export const COMMISSION_STATUSES: CommissionStatus[] = [
  "pending",
  "available",
  "paid",
  "canceled",
];

export const STATUS_LABELS: Record<string, string> = {
  all: "Todos",
  pending: "Pendente",
  approved: "Aprovado",
  processing: "Processando",
  paid: "Pago",
  available: "Disponível",
  failed: "Falhou",
  rejected: "Recusado",
  canceled: "Cancelado",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export function statusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "paid":
    case "available":
    case "approved":
      return "success";
    case "pending":
    case "processing":
      return "warning";
    case "rejected":
    case "failed":
    case "canceled":
      return "danger";
    default:
      return "neutral";
  }
}

/* ------------------------------------------------------------------ */
/* Mensagens de erro                                                   */
/* ------------------------------------------------------------------ */

export function isForbiddenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /forbidden|unauthorized|not allowed|permission|403|401/i.test(message);
}

export function friendlyError(error: unknown): string {
  if (!error) return "Ocorreu um erro inesperado.";
  const message = error instanceof Error ? error.message : String(error);
  if (isForbiddenError(error)) {
    return "Acesso restrito: sua conta não tem permissão de administrador para esta ação.";
  }
  if (/network|fetch failed|failed to fetch/i.test(message)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (/not found|404/i.test(message)) return "Registro não encontrado.";
  return message || "Ocorreu um erro inesperado.";
}

/* ------------------------------------------------------------------ */
/* Configurações — rótulos, grupos e controles por campo               */
/* ------------------------------------------------------------------ */

export type FieldControl = "text" | "number" | "currency" | "percent" | "switch" | "url" | "select";

export type FieldMeta = {
  label: string;
  help?: string;
  control?: FieldControl;
  group?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
};

export const SETTINGS_SECTIONS = [
  {
    key: "game",
    table: "game_settings",
    label: "Jogo",
    description: "Identidade, dificuldade e economia da partida.",
    groups: ["Identidade", "Dificuldade", "Física", "Economia", "Imagens"],
  },
  {
    key: "character",
    table: "character_settings",
    label: "Personagem e áudio",
    description: "Aparência do personagem e sons do jogo.",
    groups: ["Personagem", "Áudio"],
  },
  {
    key: "financial",
    table: "financial_settings",
    label: "Financeiro",
    description: "Limites de depósito e saque, taxas e bônus.",
    groups: ["Depósitos", "Saques", "Bônus", "Atalhos de valor"],
  },
  {
    key: "commission",
    table: "commission_settings",
    label: "Comissões de afiliados",
    description: "Percentuais e regras do programa de indicação.",
    groups: ["Regras", "Percentuais"],
  },
  {
    key: "influencer",
    table: "influencer_settings",
    label: "Influencers",
    description: "Ajustes exclusivos para contas marcadas como influencer.",
    groups: ["Modo de cálculo", "Vantagens"],
  },
  {
    key: "onixpay",
    table: "onixpay_config",
    label: "Gateway PIX (OnixPay)",
    description: "Integração de pagamentos. Chaves secretas ficam no servidor.",
    groups: ["Status", "Endpoints"],
  },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const FIELD_META: Record<string, FieldMeta> = {
  /* --- game_settings --- */
  game_title: { label: "Título do jogo", group: "Identidade", control: "text" },
  game_subtitle: { label: "Subtítulo do jogo", group: "Identidade", control: "text" },
  difficulty: { label: "Dificuldade base", group: "Dificuldade", control: "number", step: 0.1 },
  difficulty_per_level: {
    label: "Acréscimo de dificuldade por nível",
    group: "Dificuldade",
    control: "number",
    step: 0.01,
  },
  difficulty_rtp_balance: {
    label: "Equilíbrio dificuldade x RTP",
    help: "0 = prioriza dificuldade, 1 = prioriza o RTP configurado.",
    group: "Dificuldade",
    control: "number",
    step: 0.01,
  },
  progressive_distance_multiplier: {
    label: "Multiplicador de distância progressiva",
    group: "Dificuldade",
    control: "number",
    step: 0.01,
  },
  game_speed: { label: "Velocidade do jogo", group: "Física", control: "number", step: 0.1 },
  jump_height: { label: "Altura do pulo", group: "Física", control: "number", step: 0.1 },
  spring_boost: { label: "Impulso da mola", group: "Física", control: "number", step: 0.1 },
  spring_frequency: {
    label: "Frequência de molas",
    help: "Chance de aparecer uma mola nas plataformas.",
    group: "Física",
    control: "number",
    step: 0.01,
  },
  moving_platform_speed_multiplier: {
    label: "Velocidade das plataformas móveis",
    group: "Física",
    control: "number",
    step: 0.1,
  },
  coin_frequency: { label: "Frequência de moedas", group: "Economia", control: "number", step: 0.01 },
  coin_return: { label: "Retorno por moeda (R$)", group: "Economia", control: "currency" },
  common_player_coin_percentage: {
    label: "Percentual de moedas — jogador comum",
    group: "Economia",
    control: "percent",
  },
  rtp_global: { label: "RTP global", group: "Economia", control: "percent" },
  login_banner_url: { label: "Banner da tela de login", group: "Imagens", control: "url" },
  register_banner_url: { label: "Banner da tela de cadastro", group: "Imagens", control: "url" },

  /* --- character_settings --- */
  character_name: { label: "Nome do personagem", group: "Personagem", control: "text" },
  character_image_url: { label: "Imagem do personagem", group: "Personagem", control: "url" },
  bg_music_enabled: { label: "Música de fundo ativa", group: "Áudio", control: "switch" },
  bg_music_url: { label: "Música de fundo (URL)", group: "Áudio", control: "url" },
  jump_sound_url: { label: "Som de pulo (URL)", group: "Áudio", control: "url" },
  land_sound_url: { label: "Som de aterrissagem (URL)", group: "Áudio", control: "url" },
  coin_sound_url: { label: "Som de moeda (URL)", group: "Áudio", control: "url" },
  spring_sound_url: { label: "Som da mola (URL)", group: "Áudio", control: "url" },

  /* --- financial_settings --- */
  pix_enabled: { label: "Depósitos via PIX ativos", group: "Depósitos", control: "switch" },
  min_deposit: { label: "Depósito mínimo", group: "Depósitos", control: "currency" },
  min_withdrawal_player: { label: "Saque mínimo — jogador", group: "Saques", control: "currency" },
  min_withdrawal_affiliate: { label: "Saque mínimo — afiliado", group: "Saques", control: "currency" },
  withdrawal_fee_percent: { label: "Taxa de saque (%)", group: "Saques", control: "percent" },
  withdrawal_fee_fixed: { label: "Taxa de saque fixa", group: "Saques", control: "currency" },
  deposit_bonus_enabled: { label: "Bônus de depósito ativo", group: "Bônus", control: "switch" },
  deposit_bonus_percent: { label: "Percentual do bônus", group: "Bônus", control: "percent" },
  deposit_bonus_min_amount: { label: "Depósito mínimo para bônus", group: "Bônus", control: "currency" },
  deposit_card_1: { label: "Atalho de valor 1", group: "Atalhos de valor", control: "currency" },
  deposit_card_2: { label: "Atalho de valor 2", group: "Atalhos de valor", control: "currency" },
  deposit_card_3: { label: "Atalho de valor 3", group: "Atalhos de valor", control: "currency" },
  deposit_card_4: { label: "Atalho de valor 4", group: "Atalhos de valor", control: "currency" },

  /* --- commission_settings --- */
  is_active: { label: "Programa ativo", group: "Regras", control: "switch" },
  first_deposit_only: {
    label: "Comissionar apenas o primeiro depósito",
    group: "Regras",
    control: "switch",
  },
  min_deposit_for_commission: {
    label: "Depósito mínimo para gerar comissão",
    group: "Regras",
    control: "currency",
  },
  affiliate_skip_interval: {
    label: "Intervalo de dispensa entre comissões",
    help: "Quantidade de eventos ignorados entre comissões pagas.",
    group: "Regras",
    control: "number",
    step: 1,
  },
  default_commission_percent: { label: "Comissão nível 1 (%)", group: "Percentuais", control: "percent" },
  default_commission_percent_level2: {
    label: "Comissão nível 2 (%)",
    group: "Percentuais",
    control: "percent",
  },

  /* --- influencer_settings --- */
  influencer_calculation_mode: {
    label: "Modo de cálculo",
    group: "Modo de cálculo",
    control: "select",
    options: [
      { value: "percentage", label: "Percentual das moedas" },
      { value: "fixed", label: "Valor fixo por moeda" },
      { value: "multiplier", label: "Multiplicador de ganho" },
    ],
  },
  influencer_coin_percentage: {
    label: "Percentual de moedas — influencer",
    group: "Modo de cálculo",
    control: "percent",
  },
  influencer_fixed_coin_value_v2: {
    label: "Valor fixo por moeda",
    group: "Modo de cálculo",
    control: "currency",
  },
  gain_multiplier: { label: "Multiplicador de ganho", group: "Vantagens", control: "number", step: 0.1 },
  influencer_double_coins_v2: { label: "Moedas em dobro", group: "Vantagens", control: "switch" },
  influencer_jump_multiplier_v2: {
    label: "Multiplicador de pulo (v2)",
    group: "Vantagens",
    control: "number",
    step: 0.1,
  },
  jump_multiplier: { label: "Multiplicador de pulo", group: "Vantagens", control: "number", step: 0.1 },
  difficulty_reduction: {
    label: "Redução de dificuldade",
    group: "Vantagens",
    control: "number",
    step: 0.01,
  },

  /* --- onixpay_config --- */
  is_enabled: { label: "Gateway habilitado", group: "Status", control: "switch" },
  api_base_url: { label: "URL base da API", group: "Endpoints", control: "url" },
  deposit_callback_url: { label: "Callback de depósito", group: "Endpoints", control: "url" },
  withdrawal_callback_url: { label: "Callback de saque", group: "Endpoints", control: "url" },
};

/** Sobrescritas quando o mesmo nome de coluna existe em tabelas diferentes. */
export const FIELD_META_BY_TABLE: Record<string, FieldMeta> = {
  "onixpay_config.is_active": { label: "Conexão ativa", group: "Status", control: "switch" },
  "influencer_settings.coin_return": {
    label: "Retorno por moeda — influencer (R$)",
    group: "Vantagens",
    control: "currency",
  },
};

export function fieldMeta(table: string, key: string): FieldMeta {
  const meta = FIELD_META_BY_TABLE[`${table}.${key}`] ?? FIELD_META[key];
  if (meta) return meta;
  return {
    label: key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
    group: "Outros",
    control: "text",
  };
}
