import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const startSchema = z.object({ betAmount: z.number().positive().max(10000) });
const sessionSchema = z.object({ sessionId: z.string().uuid() });
const cashOutSchema = z.object({ sessionId: z.string().uuid(), coinsCollected: z.number().int().min(0).max(100000) });

export interface GameConfig {
  sessionId: string;
  betAmount: number;
  coinValue: number;
  coinReturn: number;
  targetAmount: number;
  maxPayout: number;
  difficulty: number;
  gameSpeed: number;
  jumpHeight: number;
  coinFrequency: number;
  springFrequency: number;
  springBoost: number;
  movingPlatformSpeedMultiplier: number;
  progressiveDistanceMultiplier: number;
  difficultyPerLevel: number;
  character: {
    name: string;
    imageUrl: string | null;
    bgMusicEnabled: boolean;
    bgMusicUrl: string | null;
    jumpSoundUrl: string | null;
    coinSoundUrl: string | null;
    springSoundUrl: string | null;
    landSoundUrl: string | null;
  };
  balanceAfterBet: number;
}

/** Inicia uma partida: valida saldo, debita a aposta e calcula os parâmetros. */
export const startGameSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data, context }): Promise<GameConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyWalletMovement } = await import("./payments.server");

    const [{ data: game }, { data: influencer }, { data: character }, { data: profile }, { data: wallet }] =
      await Promise.all([
        supabaseAdmin.from("game_settings").select("*").limit(1).maybeSingle(),
        supabaseAdmin.from("influencer_settings").select("*").limit(1).maybeSingle(),
        supabaseAdmin.from("character_settings").select("*").limit(1).maybeSingle(),
        supabaseAdmin.from("profiles").select("*").eq("user_id", context.userId).maybeSingle(),
        supabaseAdmin.from("wallets").select("*").eq("user_id", context.userId).maybeSingle(),
      ]);

    const balance = Number(wallet?.player_balance ?? 0);
    if (data.betAmount > balance) throw new Error("Saldo insuficiente para essa aposta.");

    // Encerra sessões abertas anteriores (abandono).
    await supabaseAdmin
      .from("game_sessions")
      .update({ status: "lost", ended_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("status", "active");

    const isInfluencer = Boolean(profile?.is_influencer);
    const rtp = Number(game?.rtp_global ?? 95);
    const coinReturn = Number(
      profile?.custom_coin_return ??
        (isInfluencer ? (influencer?.coin_return ?? game?.coin_return ?? 1.5) : (game?.coin_return ?? 1.5)),
    );
    const coinPercentage = isInfluencer
      ? Number(influencer?.influencer_coin_percentage ?? 100)
      : Number(game?.common_player_coin_percentage ?? 100);

    const targetAmount = Number((data.betAmount * coinReturn).toFixed(2));
    const maxPayout = targetAmount;
    // Número de moedas necessárias para atingir o alvo, ajustado pelo RTP global.
    const coinsForTarget = Math.max(10, Math.round((60 * 100) / Math.max(rtp, 1)));
    const coinValue = Number(
      Math.max(
        0.01,
        ((targetAmount / coinsForTarget) * (coinPercentage / 100)) *
          (isInfluencer ? Number(influencer?.gain_multiplier ?? 1) : 1),
      ).toFixed(4),
    );

    const baseDifficulty = Number(profile?.custom_game_difficulty ?? game?.difficulty ?? 1);
    const difficulty = isInfluencer
      ? Math.max(0.2, baseDifficulty - Number(influencer?.difficulty_reduction ?? 0))
      : baseDifficulty;
    const gameSpeed = Number(profile?.custom_game_speed ?? game?.game_speed ?? 1);
    const jumpHeight =
      Number(profile?.custom_jump_height ?? game?.jump_height ?? 1) *
      (isInfluencer ? Number(influencer?.jump_multiplier ?? 1) : 1);

    await applyWalletMovement(supabaseAdmin, {
      userId: context.userId,
      wallet: "player",
      amount: -data.betAmount,
      type: "bet",
      description: "Aposta Panda Jump",
    });

    const { data: session, error } = await supabaseAdmin
      .from("game_sessions")
      .insert({
        user_id: context.userId,
        bet_amount: data.betAmount,
        coin_value: coinValue,
        coin_return: coinReturn,
        target_amount: targetAmount,
        max_payout_amount: maxPayout,
        difficulty,
        game_speed: gameSpeed,
        jump_height: jumpHeight,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return {
      sessionId: session.id,
      betAmount: data.betAmount,
      coinValue,
      coinReturn,
      targetAmount,
      maxPayout,
      difficulty,
      gameSpeed,
      jumpHeight,
      coinFrequency: Number(game?.coin_frequency ?? 0.5),
      springFrequency: Number(game?.spring_frequency ?? 0.1),
      springBoost: Number(game?.spring_boost ?? 1.8),
      movingPlatformSpeedMultiplier: Number(game?.moving_platform_speed_multiplier ?? 1),
      progressiveDistanceMultiplier: Number(game?.progressive_distance_multiplier ?? 1),
      difficultyPerLevel: Number(game?.difficulty_per_level ?? 0.05),
      character: {
        name: character?.character_name ?? "Panda",
        imageUrl: character?.character_image_url ?? null,
        bgMusicEnabled: character?.bg_music_enabled ?? false,
        bgMusicUrl: character?.bg_music_url ?? null,
        jumpSoundUrl: character?.jump_sound_url ?? null,
        coinSoundUrl: character?.coin_sound_url ?? null,
        springSoundUrl: character?.spring_sound_url ?? null,
        landSoundUrl: character?.land_sound_url ?? null,
      },
      balanceAfterBet: Number((balance - data.betAmount).toFixed(2)),
    };
  });

/** Registra a queda do jogador: a aposta é perdida. */
export const loseGameSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cashOutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("game_sessions")
      .select("id, status")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!session || session.status !== "active") return { ok: true as const };

    await supabaseAdmin
      .from("game_sessions")
      .update({
        status: "lost",
        coins_collected: data.coinsCollected,
        payout_amount: 0,
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId)
      .eq("status", "active");
    return { ok: true as const };
  });

/** Encerra a partida e credita o prêmio acumulado (limitado ao teto). */
export const cashOutGameSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cashOutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyWalletMovement } = await import("./payments.server");

    const { data: session } = await supabaseAdmin
      .from("game_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!session) throw new Error("Partida não encontrada.");
    if (session.status !== "active") throw new Error("Esta partida já foi encerrada.");

    const payout = Number(
      Math.min(data.coinsCollected * Number(session.coin_value), Number(session.max_payout_amount)).toFixed(2),
    );

    const { data: claimed } = await supabaseAdmin
      .from("game_sessions")
      .update({
        status: payout >= Number(session.target_amount) ? "won" : "cashed_out",
        coins_collected: data.coinsCollected,
        payout_amount: payout,
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("Esta partida já foi encerrada.");

    if (payout > 0) {
      await applyWalletMovement(supabaseAdmin, {
        userId: context.userId,
        wallet: "player",
        amount: payout,
        type: "win",
        description: `Prêmio Panda Jump (${data.coinsCollected} moedas)`,
        gameSessionId: session.id,
      });
    }

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("player_balance")
      .eq("user_id", context.userId)
      .maybeSingle();

    return { payout, balance: Number(wallet?.player_balance ?? 0) };
  });

/** Devolve a última sessão ativa (caso o jogador tenha recarregado a página). */
export const getActiveSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("game_sessions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const abandonSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sessionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("game_sessions")
      .update({ status: "lost", ended_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("status", "active");
    return { ok: true as const };
  });
