import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Coins } from "lucide-react";
import { toast } from "sonner";

import { PandaJump } from "@/components/PandaJump";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { cashOutGameSession, loseGameSession, startGameSession, type GameConfig } from "@/lib/game.functions";
import { getPlayerOverview } from "@/lib/player.functions";
import { formatBRL } from "@/lib/money";

export const Route = createFileRoute("/jogar")({
  head: () => ({
    meta: [
      { title: "Panda Jump | Jogar e ganhar" },
      {
        name: "description",
        content: "Aposte, pule entre as plataformas, colete moedas e retire seu prêmio quando quiser.",
      },
      { property: "og:title", content: "Panda Jump | Jogar e ganhar" },
      { property: "og:description", content: "Jogo de habilidade Panda Jump com prêmios em dinheiro real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const start = useServerFn(startGameSession);
  const cashOut = useServerFn(cashOutGameSession);
  const lose = useServerFn(loseGameSession);
  const overviewFn = useServerFn(getPlayerOverview);

  const [bet, setBet] = useState("5");
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [coins, setCoins] = useState(0);
  const [busy, setBusy] = useState(false);
  const coinsRef = useRef(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const overview = useQuery({
    queryKey: ["player-overview", user?.id],
    queryFn: () => overviewFn(),
    enabled: Boolean(user),
  });

  const balance = Number(overview.data?.wallet?.player_balance ?? 0);
  const prize = config ? Math.min(coins * config.coinValue, config.maxPayout) : 0;

  const handleCoins = useCallback((value: number) => {
    coinsRef.current = value;
    setCoins(value);
  }, []);

  const handleLose = useCallback(
    async (value: number) => {
      const sessionId = config?.sessionId;
      setConfig(null);
      setCoins(0);
      coinsRef.current = 0;
      if (!sessionId) return;
      try {
        await lose({ data: { sessionId, coinsCollected: value } });
      } catch {
        /* ignora */
      }
      toast.error("Você caiu! A aposta foi perdida.");
      overview.refetch();
    },
    [config, lose, overview],
  );

  async function handleStart(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await start({ data: { betAmount: Number(bet) } });
      coinsRef.current = 0;
      setCoins(0);
      setConfig(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a partida.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCashOut() {
    if (!config) return;
    setBusy(true);
    try {
      const result = await cashOut({ data: { sessionId: config.sessionId, coinsCollected: coinsRef.current } });
      toast.success(`Você retirou ${formatBRL(result.payout)}!`);
      setConfig(null);
      setCoins(0);
      coinsRef.current = 0;
      overview.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao retirar o prêmio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-1.5 size-4" /> Voltar
          </Link>
        </Button>
        <span className="text-sm font-semibold text-foreground">Saldo: {formatBRL(balance)}</span>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16">
        {config ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 p-4">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="size-4 text-accent" /> {coins} moedas
              </span>
              <span className="text-lg font-black text-primary">{formatBRL(prize)}</span>
              <Button onClick={handleCashOut} disabled={busy || prize <= 0}>
                Retirar prêmio
              </Button>
            </div>
            <PandaJump config={config} onCoins={handleCoins} onLose={handleLose} />
            <p className="text-center text-xs text-muted-foreground">
              Use as setas do teclado ou arraste o dedo na tela para mover o {config.character.name}.
            </p>
          </div>
        ) : (
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle>Nova partida</CardTitle>
              <CardDescription>
                Escolha o valor da aposta. Cada moeda coletada vale dinheiro — retire antes de cair.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleStart}>
                <div className="space-y-1.5">
                  <Label htmlFor="bet">Valor da aposta (R$)</Label>
                  <Input
                    id="bet"
                    type="number"
                    min="1"
                    step="0.01"
                    value={bet}
                    onChange={(event) => setBet(event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 5, 10, 25, 50].map((value) => (
                    <Button key={value} type="button" size="sm" variant="secondary" onClick={() => setBet(String(value))}>
                      {formatBRL(value)}
                    </Button>
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Iniciando..." : "Começar a jogar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
