import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL, formatDateTime } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMISSION_STATUSES,
  DEPOSIT_STATUSES,
  SETTINGS_SECTIONS,
  WITHDRAWAL_STATUSES,
  fieldMeta,
  friendlyError,
  statusLabel,
  statusTone,
  type FieldMeta,
} from "@/lib/admin-ui";
import {
  adjustBalance,
  approveDeposit,
  approveWithdrawal,
  deleteBanner,
  getAdminOverview,
  getAllSettings,
  listAdminLogs,
  listBanners,
  listCommissions,
  listDeposits,
  listUsers,
  listWithdrawals,
  rejectDeposit,
  rejectWithdrawal,
  saveBanner,
  setUserRole,
  updateSettings,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo | Panda Pay" },
      {
        name: "description",
        content:
          "Área restrita: acompanhe métricas, usuários, depósitos, saques, comissões e configurações da plataforma.",
      },
      { property: "og:title", content: "Painel administrativo | Panda Pay" },
      { property: "og:description", content: "Gestão completa da plataforma Panda Pay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type StatusFilter = string;

function StatusBadge({ status }: { status: string | null }) {
  const tone = statusTone(status);
  const variant = tone === "success" ? "default" : tone === "warning" ? "secondary" : tone === "danger" ? "destructive" : "outline";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <span>{friendlyError(error)}</span>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function RestrictedAccess() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="items-center text-center">
        <ShieldAlert className="size-8 text-destructive" />
        <CardTitle className="text-lg">Acesso restrito</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Esta área é exclusiva para administradores. Sua conta não tem essa permissão.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Voltar para minha conta</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const ADMIN_TABS = [
  { value: "overview", label: "Visão geral" },
  { value: "users", label: "Usuários" },
  { value: "deposits", label: "Depósitos" },
  { value: "withdrawals", label: "Saques" },
  { value: "settings", label: "Configurações" },
  { value: "banners", label: "Banners" },
  { value: "commissions", label: "Comissões" },
  { value: "logs", label: "Logs" },
] as const;

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const isAdmin = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });

  const checking = loading || (Boolean(user) && isAdmin.isLoading);
  const allowed = isAdmin.data === true;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black tracking-tight text-foreground sm:text-xl">
            Painel administrativo
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Gestão da plataforma Panda Pay</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 size-4" /> Minha conta
          </Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-5">
        {checking ? (
          <p className="text-sm text-muted-foreground">Verificando permissões...</p>
        ) : isAdmin.error ? (
          <ErrorState error={isAdmin.error} />
        ) : !user ? (
          <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
        ) : !allowed ? (
          <RestrictedAccess />
        ) : (
          <Tabs defaultValue="overview">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
              <TabsList className="inline-flex w-max min-w-full gap-1 sm:flex sm:flex-wrap sm:justify-start">
                {ADMIN_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="whitespace-nowrap text-xs sm:text-sm">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="mt-6">
              <TabsContent value="overview">
                <OverviewTab />
              </TabsContent>
              <TabsContent value="users">
                <UsersTab />
              </TabsContent>
              <TabsContent value="deposits">
                <DepositsTab />
              </TabsContent>
              <TabsContent value="withdrawals">
                <WithdrawalsTab />
              </TabsContent>
              <TabsContent value="settings">
                <SettingsTab />
              </TabsContent>
              <TabsContent value="banners">
                <BannersTab />
              </TabsContent>
              <TabsContent value="commissions">
                <CommissionsTab />
              </TabsContent>
              <TabsContent value="logs">
                <LogsTab />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function OverviewTab() {
  const fn = useServerFn(getAdminOverview);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando métricas...</p>;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const cards: { label: string; value: string }[] = [
    { label: "Usuários", value: String(data.totalUsers) },
    { label: "Depositado (total)", value: formatBRL(data.totalDeposited) },
    { label: "Depositado hoje", value: formatBRL(data.depositedToday) },
    { label: "Sacado (pago)", value: formatBRL(data.totalWithdrawn) },
    { label: "Saques pendentes", value: String(data.pendingWithdrawals) },
    { label: "Total apostado", value: formatBRL(data.totalBets) },
    { label: "Total pago em prêmios", value: formatBRL(data.totalPayouts) },
    { label: "GGR", value: formatBRL(data.ggr) },
    { label: "Saldo jogadores", value: formatBRL(data.liabilityPlayer) },
    { label: "Saldo afiliados", value: formatBRL(data.liabilityAffiliate) },
    { label: "Partidas jogadas", value: String(data.gamesPlayed) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-foreground">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function UsersTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listUsers);
  const roleFn = useServerFn(setUserRole);
  const balanceFn = useServerFn(adjustBalance);

  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const users = useQuery({
    queryKey: ["admin-users", term, page],
    queryFn: () => listFn({ data: { search: term || null, page, pageSize } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; grant: boolean }) =>
      roleFn({ data: { userId: input.userId, role: "admin" as const, grant: input.grant } }),
    onSuccess: () => {
      toast.success("Permissão atualizada");
      void invalidate();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  const balanceMutation = useMutation({
    mutationFn: (input: { userId: string; wallet: "player" | "affiliate"; amount: number; reason: string }) =>
      balanceFn({ data: input }),
    onSuccess: () => {
      toast.success("Saldo ajustado");
      void invalidate();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  const promptAdjust = (userId: string) => {
    const raw = window.prompt("Valor do ajuste (use - para debitar):", "0");
    if (raw === null) return;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error("Informe um valor válido diferente de zero.");
      return;
    }
    const reason = window.prompt("Motivo do ajuste:", "Ajuste manual") ?? "";
    if (reason.trim().length < 3) {
      toast.error("Descreva o motivo do ajuste.");
      return;
    }
    balanceMutation.mutate({ userId, wallet: "player", amount, reason: reason.trim() });
  };

  const total = users.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setTerm(search.trim());
        }}
      >
        <Input
          placeholder="Buscar por nome, e-mail, CPF ou código"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit">Buscar</Button>
      </form>

      {users.isLoading ? <p className="text-sm text-muted-foreground">Carregando usuários...</p> : null}
      {users.error ? <ErrorState error={users.error} /> : null}
      {!users.isLoading && !users.error && (users.data?.users ?? []).length === 0 ? (
        <EmptyState>Nenhum usuário encontrado para esta busca.</EmptyState>
      ) : null}

      <div className="space-y-3">
        {(users.data?.users ?? []).map((item) => (
          <Card key={item.user_id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-52">
                <p className="font-semibold text-foreground">{item.full_name ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{item.email ?? "-"}</p>
                <p className="text-xs text-muted-foreground">Código: {item.referral_code ?? "-"}</p>
              </div>
              <div className="text-sm">
                <p>Jogador: {formatBRL(item.wallet?.player_balance)}</p>
                <p>Afiliado: {formatBRL(item.wallet?.affiliate_balance)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.roles.includes("admin") ? <Badge>admin</Badge> : null}
                {item.is_influencer ? <Badge variant="secondary">influencer</Badge> : null}
                <Button size="sm" variant="outline" onClick={() => promptAdjust(item.user_id)}>
                  Ajustar saldo
                </Button>
                <Button
                  size="sm"
                  variant={item.roles.includes("admin") ? "destructive" : "secondary"}
                  onClick={() =>
                    roleMutation.mutate({ userId: item.user_id, grant: !item.roles.includes("admin") })
                  }
                >
                  {item.roles.includes("admin") ? "Remover admin" : "Tornar admin"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} usuário(s) — página {page + 1}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function StatusFilterBar({
  value,
  onChange,
  options,
}: {
  value: StatusFilter;
  onChange: (next: StatusFilter) => void;
  options: readonly string[];
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {["all", ...options].map((option) => (
        <Button
          key={option}
          size="sm"
          className="whitespace-nowrap"
          variant={option === value ? "default" : "outline"}
          onClick={() => onChange(option)}
        >
          {statusLabel(option)}
        </Button>
      ))}
    </div>
  );
}

function DepositsTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listDeposits);
  const approveFn = useServerFn(approveDeposit);
  const rejectFn = useServerFn(rejectDeposit);
  const [status, setStatus] = useState<StatusFilter>("pending");

  const deposits = useQuery({
    queryKey: ["admin-deposits", status],
    queryFn: () => listFn({ data: { status, limit: 50 } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });

  const approveMutation = useMutation({
    mutationFn: (depositId: string) => approveFn({ data: { depositId } }),
    onSuccess: () => {
      toast.success("Depósito confirmado");
      void refresh();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });
  const rejectMutation = useMutation({
    mutationFn: (depositId: string) => rejectFn({ data: { depositId } }),
    onSuccess: () => {
      toast.success("Depósito recusado");
      void refresh();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  return (
    <div className="space-y-4">
      <StatusFilterBar value={status} onChange={setStatus} options={DEPOSIT_STATUSES} />
      {deposits.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : null}
      {deposits.error ? <ErrorState error={deposits.error} /> : null}
      {!deposits.isLoading && !deposits.error && (deposits.data ?? []).length === 0 ? (
        <EmptyState>Nenhum registro para este filtro.</EmptyState>
      ) : null}
      <div className="space-y-3">
        {(deposits.data ?? []).map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-52">
                <p className="font-semibold text-foreground">{row.profile?.full_name ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{row.profile?.email ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
              </div>
              <p className="text-lg font-bold text-foreground">{formatBRL(row.amount)}</p>
              <StatusBadge status={row.status} />
              {row.status === "pending" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveMutation.mutate(row.id)}>
                    Confirmar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(row.id)}>
                    Recusar
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WithdrawalsTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listWithdrawals);
  const approveFn = useServerFn(approveWithdrawal);
  const rejectFn = useServerFn(rejectWithdrawal);
  const [status, setStatus] = useState<StatusFilter>("pending");

  const withdrawals = useQuery({
    queryKey: ["admin-withdrawals", status],
    queryFn: () => listFn({ data: { status, limit: 50 } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });

  const approveMutation = useMutation({
    mutationFn: (withdrawalId: string) => approveFn({ data: { withdrawalId } }),
    onSuccess: () => {
      toast.success("Saque enviado para pagamento");
      void refresh();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });
  const rejectMutation = useMutation({
    mutationFn: (input: { withdrawalId: string; reason: string }) => rejectFn({ data: input }),
    onSuccess: () => {
      toast.success("Saque recusado e valor devolvido");
      void refresh();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  return (
    <div className="space-y-4">
      <StatusFilterBar value={status} onChange={setStatus} options={WITHDRAWAL_STATUSES} />
      {withdrawals.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : null}
      {withdrawals.error ? <ErrorState error={withdrawals.error} /> : null}
      {!withdrawals.isLoading && !withdrawals.error && (withdrawals.data ?? []).length === 0 ? (
        <EmptyState>Nenhum registro para este filtro.</EmptyState>
      ) : null}
      <div className="space-y-3">
        {(withdrawals.data ?? []).map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-52">
                <p className="font-semibold text-foreground">{row.profile?.full_name ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{row.profile?.email ?? "-"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.pix_key_type}: {row.pix_key}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
              </div>
              <div className="text-sm">
                <p className="text-lg font-bold text-foreground">{formatBRL(row.amount)}</p>
                <p className="text-xs text-muted-foreground">Líquido: {formatBRL(row.net_amount)}</p>
              </div>
              <StatusBadge status={row.status} />
              {row.status === "pending" || row.status === "approved" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveMutation.mutate(row.id)}>
                    Aprovar e pagar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const reason = window.prompt("Motivo da recusa:", "Dados inválidos") ?? "";
                      if (!reason.trim()) return;
                      rejectMutation.mutate({ withdrawalId: row.id, reason: reason.trim() });
                    }}
                  >
                    Recusar
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at", "user_id"]);

type SettingsValue = string | number | boolean | null;

function SettingsField({
  table,
  fieldKey,
  meta,
  value,
  onChange,
}: {
  table: string;
  fieldKey: string;
  meta: FieldMeta;
  value: SettingsValue;
  onChange: (next: SettingsValue) => void;
}) {
  const id = `${table}-${fieldKey}`;
  const control = meta.control ?? "text";

  if (control === "switch") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium text-foreground">
            {meta.label}
          </Label>
          {meta.help ? <p className="text-xs text-muted-foreground">{meta.help}</p> : null}
        </div>
        <Switch id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
      </div>
    );
  }

  if (control === "select" && meta.options) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {meta.label}
        </Label>
        <select
          id={id}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={value === null ? "" : String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {meta.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {meta.help ? <p className="text-xs text-muted-foreground">{meta.help}</p> : null}
      </div>
    );
  }

  const numeric = control === "number" || control === "currency" || control === "percent";
  const step = meta.step ?? (control === "currency" ? 0.01 : control === "percent" ? 0.1 : "any");

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {meta.label}
      </Label>
      <div className="relative">
        {control === "currency" ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            R$
          </span>
        ) : null}
        <Input
          id={id}
          type={numeric ? "number" : control === "url" ? "url" : "text"}
          inputMode={numeric ? "decimal" : undefined}
          step={numeric ? step : undefined}
          min={meta.min}
          max={meta.max}
          placeholder={control === "url" ? "https://..." : undefined}
          className={control === "currency" ? "pl-9" : control === "percent" ? "pr-9" : undefined}
          value={value === null ? "" : String(value)}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(numeric ? (raw === "" ? null : Number(raw)) : raw);
          }}
        />
        {control === "percent" ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </span>
        ) : null}
      </div>
      {meta.help ? <p className="text-xs text-muted-foreground">{meta.help}</p> : null}
    </div>
  );
}

function SettingsGroup({
  label,
  description,
  table,
  row,
}: {
  label: string;
  description: string;
  table: string;
  row: Record<string, unknown> | null;
}) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(updateSettings);
  const [draft, setDraft] = useState<Record<string, SettingsValue>>({});

  const mutation = useMutation({
    mutationFn: (values: Record<string, SettingsValue>) =>
      saveFn({ data: { table: table as never, values } }),
    onSuccess: () => {
      toast.success(`${label}: configurações salvas`);
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  if (!row) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma configuração encontrada para esta seção.</p>
        </CardContent>
      </Card>
    );
  }

  const fields = Object.keys(row).filter(
    (key) => !HIDDEN_FIELDS.has(key) && (typeof row[key] !== "object" || row[key] === null),
  );

  const current = (key: string): SettingsValue => {
    if (key in draft) return draft[key] ?? null;
    const value = row[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    return null;
  };

  const grouped = new Map<string, string[]>();
  for (const key of fields) {
    const group = fieldMeta(table, key).group ?? "Outros";
    grouped.set(group, [...(grouped.get(group) ?? []), key]);
  }

  const dirty = Object.keys(draft).length > 0;

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{label}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {[...grouped.entries()].map(([group, keys]) => (
          <section key={group} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {keys.map((key) => (
                <SettingsField
                  key={key}
                  table={table}
                  fieldKey={key}
                  meta={fieldMeta(table, key)}
                  value={current(key)}
                  onChange={(next) => setDraft((prev) => ({ ...prev, [key]: next }))}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate(draft)}>
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setDraft({})}>
            Descartar
          </Button>
          {dirty ? (
            <span className="text-xs text-muted-foreground">
              {Object.keys(draft).length} campo(s) alterado(s)
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsTab() {
  const fn = useServerFn(getAllSettings);
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => fn() });

  if (settings.isLoading) return <p className="text-sm text-muted-foreground">Carregando configurações...</p>;
  if (settings.error) return <ErrorState error={settings.error} />;

  const data = settings.data as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      {SETTINGS_SECTIONS.map((section) => (
        <SettingsGroup
          key={section.table}
          label={section.label}
          description={section.description}
          table={section.table}
          row={(data?.[section.key] ?? null) as Record<string, unknown> | null}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */

const PLACEMENTS = ["landing", "login", "register", "dashboard", "global"] as const;

function BannersTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listBanners);
  const saveFn = useServerFn(saveBanner);
  const deleteFn = useServerFn(deleteBanner);

  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]>("landing");

  const banners = useQuery({ queryKey: ["admin-banners"], queryFn: () => listFn() });
  // erro exibido abaixo do formulário
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-banners"] });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          imageUrl: imageUrl.trim(),
          title: title.trim() || null,
          placement,
          sortOrder: 0,
          isActive: true,
        },
      }),
    onSuccess: () => {
      toast.success("Banner salvo");
      setImageUrl("");
      setTitle("");
      void refresh();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Banner removido");
      void refresh();
    },
    onError: (err: Error) => toast.error(friendlyError(err)),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo banner</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Input
            className="sm:col-span-2"
            placeholder="https://.../banner.jpg"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />
          <Input placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex gap-2">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={placement}
              onChange={(event) => setPlacement(event.target.value as (typeof PLACEMENTS)[number])}
            >
              {PLACEMENTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Button disabled={!imageUrl.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {(banners.data ?? []).map((banner) => (
          <Card key={banner.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <img
                src={banner.image_url}
                alt={banner.title ?? "Banner promocional"}
                loading="lazy"
                className="h-16 w-28 rounded-md object-cover"
              />
              <div className="flex-1">
                <p className="font-semibold text-foreground">{banner.title ?? "Sem título"}</p>
                <p className="text-xs text-muted-foreground">
                  {banner.placement} — {banner.is_active ? "ativo" : "inativo"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(banner.id)}>
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function CommissionsTab() {
  const listFn = useServerFn(listCommissions);
  const [status, setStatus] = useState<StatusFilter>("all");
  const commissions = useQuery({
    queryKey: ["admin-commissions", status],
    queryFn: () => listFn({ data: { status, limit: 100 } }),
  });

  return (
    <div className="space-y-4">
      <StatusFilterBar value={status} onChange={setStatus} options={COMMISSION_STATUSES} />
      {commissions.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : null}
      {commissions.error ? <ErrorState error={commissions.error} /> : null}
      {!commissions.isLoading && !commissions.error && (commissions.data ?? []).length === 0 ? (
        <EmptyState>Nenhum registro para este filtro.</EmptyState>
      ) : null}
      <div className="space-y-2">
        {(commissions.data ?? []).map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-foreground">{row.affiliate?.full_name ?? "Afiliado"}</p>
                <p className="text-xs text-muted-foreground">
                  Indicado: {row.referred?.full_name ?? row.referred?.email ?? "-"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{row.source_type}</p>
              <p className="font-bold text-foreground">{formatBRL(row.amount)}</p>
              <StatusBadge status={row.status} />
              <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LogsTab() {
  const listFn = useServerFn(listAdminLogs);
  const logs = useQuery({ queryKey: ["admin-logs"], queryFn: () => listFn() });

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={() => void logs.refetch()}>
        <RefreshCw className="mr-1.5 size-4" /> Atualizar
      </Button>
      {logs.isLoading ? <p className="text-sm text-muted-foreground">Carregando logs...</p> : null}
      {logs.error ? <ErrorState error={logs.error} /> : null}
      <div className="space-y-2">
        {(logs.data ?? []).map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-foreground">{row.action}</p>
                <p className="text-xs text-muted-foreground">
                  por {row.admin?.full_name ?? row.admin?.email ?? row.admin_user_id}
                </p>
              </div>
              <p className="max-w-md truncate text-xs text-muted-foreground">
                {row.metadata ? JSON.stringify(row.metadata) : ""}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
