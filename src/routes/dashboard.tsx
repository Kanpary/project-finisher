import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Copy, Gamepad2, LogOut, ShieldCheck, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { DepositDialog } from "@/components/DepositDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { getPlayerOverview } from "@/lib/player.functions";
import { fetchPublicSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/money";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Minha conta | Panda Pay" },
      {
        name: "description",
        content: "Veja seu saldo, deposite via PIX, solicite saques e acompanhe suas comissões de afiliado.",
      },
      { property: "og:title", content: "Minha conta | Panda Pay" },
      { property: "og:description", content: "Painel do jogador Panda Pay: saldo, PIX, partidas e indicações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const overviewFn = useServerFn(getPlayerOverview);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const overview = useQuery({
    queryKey: ["player-overview", user?.id],
    queryFn: () => overviewFn(),
    enabled: Boolean(user),
  });
  const settings = useQuery({ queryKey: ["public-settings"], queryFn: fetchPublicSettings });

  const wallet = overview.data?.wallet;
  const profile = overview.data?.profile;
  const financial = settings.data?.financial;
  const referralLink =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/auth?mode=register&ref=${profile.referral_code}`
      : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link to="/" className="text-lg font-black tracking-tight text-foreground">
          Panda<span className="text-primary">Pay</span>
        </Link>
        <div className="flex items-center gap-2">
          {overview.data?.isAdmin ? (
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin">
                <ShieldCheck className="mr-1.5 size-4" /> Admin
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 pb-16">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/60 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4 text-primary" /> Saldo de jogo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-foreground">{formatBRL(wallet?.player_balance)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4 text-accent" /> Comissões de afiliado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black text-foreground">{formatBRL(wallet?.affiliate_balance)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {overview.data?.referralCount ?? 0} indicações cadastradas
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <DepositDialog
            minDeposit={Number(financial?.min_deposit ?? 10)}
            onCredited={() => overview.refetch()}
          />
          <WithdrawDialog
            minPlayer={Number(financial?.min_withdrawal_player ?? 50)}
            minAffiliate={Number(financial?.min_withdrawal_affiliate ?? 50)}
            playerBalance={Number(wallet?.player_balance ?? 0)}
            affiliateBalance={Number(wallet?.affiliate_balance ?? 0)}
            onDone={() => overview.refetch()}
          />
          <Button asChild variant="default" className="shadow-[var(--shadow-glow)]">
            <Link to="/jogar">
              <Gamepad2 className="mr-2 size-4" /> Jogar Panda Jump
            </Link>
          </Button>
        </div>

        <Card className="border-border/60 bg-card/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seu link de indicação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="flex-1 truncate rounded-md bg-muted/50 px-3 py-2 text-xs">
              {referralLink || "—"}
            </code>
            <Button
              size="sm"
              variant="secondary"
              disabled={!referralLink}
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
                toast.success("Link copiado!");
              }}
            >
              <Copy className="mr-1.5 size-4" /> Copiar
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="extrato">
          <TabsList>
            <TabsTrigger value="extrato">Extrato</TabsTrigger>
            <TabsTrigger value="partidas">Partidas</TabsTrigger>
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          </TabsList>

          <TabsContent value="extrato">
            <ListCard
              empty="Nenhuma movimentação ainda."
              rows={(overview.data?.transactions ?? []).map((tx) => ({
                id: String(tx.id),
                title: tx.description ?? tx.type,
                subtitle: new Date(tx.created_at).toLocaleString("pt-BR"),
                value: formatBRL(Number(tx.amount)),
                positive: Number(tx.amount) >= 0,
              }))}
            />
          </TabsContent>

          <TabsContent value="partidas">
            <ListCard
              empty="Você ainda não jogou nenhuma partida."
              rows={(overview.data?.sessions ?? []).map((session) => ({
                id: String(session.id),
                title: `Aposta ${formatBRL(Number(session.bet_amount))} · ${session.coins_collected ?? 0} moedas`,
                subtitle: `${session.status} · ${new Date(session.created_at).toLocaleString("pt-BR")}`,
                value: formatBRL(Number(session.payout_amount ?? 0)),
                positive: Number(session.payout_amount ?? 0) > 0,
              }))}
            />
          </TabsContent>

          <TabsContent value="comissoes">
            <ListCard
              empty="Nenhuma comissão recebida ainda."
              rows={(overview.data?.commissions ?? []).map((commission) => ({
                id: String(commission.id),
                title: `Comissão (${commission.source_type})`,
                subtitle: new Date(commission.created_at).toLocaleString("pt-BR"),
                value: formatBRL(Number(commission.amount)),
                positive: true,
                badge: commission.status,
              }))}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

interface Row {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  positive: boolean;
  badge?: string;
}

function ListCard({ rows, empty }: { rows: Row[]; empty: string }) {
  return (
    <Card className="mt-4 border-border/60 bg-card/70">
      <CardContent className="divide-y divide-border/60 p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{empty}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                {row.badge ? <Badge variant="secondary">{row.badge}</Badge> : null}
                <span className={row.positive ? "text-sm font-semibold text-primary" : "text-sm font-semibold text-muted-foreground"}>
                  {row.value}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
