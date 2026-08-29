import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type GameSettings = Database["public"]["Tables"]["game_settings"]["Row"];
export type CharacterSettings = Database["public"]["Tables"]["character_settings"]["Row"];
export type FinancialSettings = Database["public"]["Tables"]["financial_settings"]["Row"];
export type Banner = Database["public"]["Tables"]["banners"]["Row"];

/** Configurações públicas (RLS permite leitura anônima). Consultado no client. */
export async function fetchPublicSettings() {
  const [game, character, financial] = await Promise.all([
    supabase.from("game_settings").select("*").limit(1).maybeSingle(),
    supabase.from("character_settings").select("*").limit(1).maybeSingle(),
    supabase.from("financial_settings").select("*").limit(1).maybeSingle(),
  ]);
  return {
    game: game.data as GameSettings | null,
    character: character.data as CharacterSettings | null,
    financial: financial.data as FinancialSettings | null,
  };
}

export async function fetchBanners(placement?: Banner["placement"]) {
  let query = supabase.from("banners").select("*").eq("is_active", true).order("sort_order");
  if (placement) query = query.eq("placement", placement);
  const { data } = await query;
  return (data ?? []) as Banner[];
}
