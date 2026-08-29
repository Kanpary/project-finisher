export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: number
          ip_address: string | null
          metadata: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: number
          ip_address?: string | null
          metadata?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: number
          ip_address?: string | null
          metadata?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_user_id: string
          amount: number
          created_at: string
          id: number
          referred_user_id: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["commission_source"]
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          affiliate_user_id: string
          amount: number
          created_at?: string
          id?: number
          referred_user_id: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["commission_source"]
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          affiliate_user_id?: string
          amount?: number
          created_at?: string
          id?: number
          referred_user_id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["commission_source"]
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          placement: Database["public"]["Enums"]["banner_placement"]
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          placement?: Database["public"]["Enums"]["banner_placement"]
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          placement?: Database["public"]["Enums"]["banner_placement"]
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      character_settings: {
        Row: {
          bg_music_enabled: boolean
          bg_music_url: string | null
          character_image_url: string | null
          character_name: string
          coin_sound_url: string | null
          created_at: string
          id: string
          jump_sound_url: string | null
          land_sound_url: string | null
          spring_sound_url: string | null
          updated_at: string
        }
        Insert: {
          bg_music_enabled?: boolean
          bg_music_url?: string | null
          character_image_url?: string | null
          character_name?: string
          coin_sound_url?: string | null
          created_at?: string
          id?: string
          jump_sound_url?: string | null
          land_sound_url?: string | null
          spring_sound_url?: string | null
          updated_at?: string
        }
        Update: {
          bg_music_enabled?: boolean
          bg_music_url?: string | null
          character_image_url?: string | null
          character_name?: string
          coin_sound_url?: string | null
          created_at?: string
          id?: string
          jump_sound_url?: string | null
          land_sound_url?: string | null
          spring_sound_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_settings: {
        Row: {
          affiliate_skip_interval: number
          created_at: string
          default_commission_percent: number
          default_commission_percent_level2: number
          first_deposit_only: boolean
          id: string
          is_active: boolean
          min_deposit_for_commission: number
          updated_at: string
        }
        Insert: {
          affiliate_skip_interval?: number
          created_at?: string
          default_commission_percent?: number
          default_commission_percent_level2?: number
          first_deposit_only?: boolean
          id?: string
          is_active?: boolean
          min_deposit_for_commission?: number
          updated_at?: string
        }
        Update: {
          affiliate_skip_interval?: number
          created_at?: string
          default_commission_percent?: number
          default_commission_percent_level2?: number
          first_deposit_only?: boolean
          id?: string
          is_active?: boolean
          min_deposit_for_commission?: number
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_id: string | null
          amount: number
          bonus_amount: number
          created_at: string
          external_id: string | null
          gateway: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payload: Json | null
          payment_link: string | null
          pix_code: string | null
          provider: string
          qr_code: string | null
          qr_code_image_url: string | null
          rejected_at: string | null
          response: Json | null
          status: Database["public"]["Enums"]["deposit_status"]
          total_credited: number | null
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          bonus_amount?: number
          created_at?: string
          external_id?: string | null
          gateway?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payload?: Json | null
          payment_link?: string | null
          pix_code?: string | null
          provider?: string
          qr_code?: string | null
          qr_code_image_url?: string | null
          rejected_at?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["deposit_status"]
          total_credited?: number | null
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          bonus_amount?: number
          created_at?: string
          external_id?: string | null
          gateway?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payload?: Json | null
          payment_link?: string | null
          pix_code?: string | null
          provider?: string
          qr_code?: string | null
          qr_code_image_url?: string | null
          rejected_at?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["deposit_status"]
          total_credited?: number | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_settings: {
        Row: {
          created_at: string
          deposit_bonus_enabled: boolean
          deposit_bonus_min_amount: number
          deposit_bonus_percent: number
          deposit_card_1: number | null
          deposit_card_2: number | null
          deposit_card_3: number | null
          deposit_card_4: number | null
          id: string
          min_deposit: number
          min_withdrawal_affiliate: number
          min_withdrawal_player: number
          pix_enabled: boolean
          updated_at: string
          withdrawal_fee_fixed: number
          withdrawal_fee_percent: number
        }
        Insert: {
          created_at?: string
          deposit_bonus_enabled?: boolean
          deposit_bonus_min_amount?: number
          deposit_bonus_percent?: number
          deposit_card_1?: number | null
          deposit_card_2?: number | null
          deposit_card_3?: number | null
          deposit_card_4?: number | null
          id?: string
          min_deposit?: number
          min_withdrawal_affiliate?: number
          min_withdrawal_player?: number
          pix_enabled?: boolean
          updated_at?: string
          withdrawal_fee_fixed?: number
          withdrawal_fee_percent?: number
        }
        Update: {
          created_at?: string
          deposit_bonus_enabled?: boolean
          deposit_bonus_min_amount?: number
          deposit_bonus_percent?: number
          deposit_card_1?: number | null
          deposit_card_2?: number | null
          deposit_card_3?: number | null
          deposit_card_4?: number | null
          id?: string
          min_deposit?: number
          min_withdrawal_affiliate?: number
          min_withdrawal_player?: number
          pix_enabled?: boolean
          updated_at?: string
          withdrawal_fee_fixed?: number
          withdrawal_fee_percent?: number
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          bet_amount: number
          coin_return: number
          coin_value: number
          coins_collected: number
          created_at: string
          difficulty: number
          ended_at: string | null
          game_speed: number
          id: string
          jump_height: number
          max_payout_amount: number
          payout_amount: number
          status: Database["public"]["Enums"]["game_session_status"]
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bet_amount: number
          coin_return?: number
          coin_value: number
          coins_collected?: number
          created_at?: string
          difficulty?: number
          ended_at?: string | null
          game_speed?: number
          id?: string
          jump_height?: number
          max_payout_amount: number
          payout_amount?: number
          status?: Database["public"]["Enums"]["game_session_status"]
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          coin_return?: number
          coin_value?: number
          coins_collected?: number
          created_at?: string
          difficulty?: number
          ended_at?: string | null
          game_speed?: number
          id?: string
          jump_height?: number
          max_payout_amount?: number
          payout_amount?: number
          status?: Database["public"]["Enums"]["game_session_status"]
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_settings: {
        Row: {
          coin_frequency: number
          coin_return: number
          common_player_coin_percentage: number
          created_at: string
          difficulty: number
          difficulty_per_level: number
          difficulty_rtp_balance: number
          game_speed: number
          game_subtitle: string
          game_title: string
          id: string
          jump_height: number
          login_banner_url: string | null
          moving_platform_speed_multiplier: number
          progressive_distance_multiplier: number
          register_banner_url: string | null
          rtp_global: number
          spring_boost: number
          spring_frequency: number
          updated_at: string
        }
        Insert: {
          coin_frequency?: number
          coin_return?: number
          common_player_coin_percentage?: number
          created_at?: string
          difficulty?: number
          difficulty_per_level?: number
          difficulty_rtp_balance?: number
          game_speed?: number
          game_subtitle?: string
          game_title?: string
          id?: string
          jump_height?: number
          login_banner_url?: string | null
          moving_platform_speed_multiplier?: number
          progressive_distance_multiplier?: number
          register_banner_url?: string | null
          rtp_global?: number
          spring_boost?: number
          spring_frequency?: number
          updated_at?: string
        }
        Update: {
          coin_frequency?: number
          coin_return?: number
          common_player_coin_percentage?: number
          created_at?: string
          difficulty?: number
          difficulty_per_level?: number
          difficulty_rtp_balance?: number
          game_speed?: number
          game_subtitle?: string
          game_title?: string
          id?: string
          jump_height?: number
          login_banner_url?: string | null
          moving_platform_speed_multiplier?: number
          progressive_distance_multiplier?: number
          register_banner_url?: string | null
          rtp_global?: number
          spring_boost?: number
          spring_frequency?: number
          updated_at?: string
        }
        Relationships: []
      }
      influencer_settings: {
        Row: {
          coin_return: number
          created_at: string
          difficulty_reduction: number
          gain_multiplier: number
          id: string
          influencer_calculation_mode: string
          influencer_coin_percentage: number
          influencer_double_coins_v2: boolean
          influencer_fixed_coin_value_v2: number
          influencer_jump_multiplier_v2: number
          jump_multiplier: number
          updated_at: string
        }
        Insert: {
          coin_return?: number
          created_at?: string
          difficulty_reduction?: number
          gain_multiplier?: number
          id?: string
          influencer_calculation_mode?: string
          influencer_coin_percentage?: number
          influencer_double_coins_v2?: boolean
          influencer_fixed_coin_value_v2?: number
          influencer_jump_multiplier_v2?: number
          jump_multiplier?: number
          updated_at?: string
        }
        Update: {
          coin_return?: number
          created_at?: string
          difficulty_reduction?: number
          gain_multiplier?: number
          id?: string
          influencer_calculation_mode?: string
          influencer_coin_percentage?: number
          influencer_double_coins_v2?: boolean
          influencer_fixed_coin_value_v2?: number
          influencer_jump_multiplier_v2?: number
          jump_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      onixpay_config: {
        Row: {
          api_base_url: string | null
          created_at: string
          deposit_callback_url: string | null
          id: string
          is_active: boolean
          is_enabled: boolean
          updated_at: string
          withdrawal_callback_url: string | null
        }
        Insert: {
          api_base_url?: string | null
          created_at?: string
          deposit_callback_url?: string | null
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          updated_at?: string
          withdrawal_callback_url?: string | null
        }
        Update: {
          api_base_url?: string | null
          created_at?: string
          deposit_callback_url?: string | null
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          updated_at?: string
          withdrawal_callback_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          comissao_cpa: number | null
          comissao_cpa_nivel2: number | null
          cpf: string | null
          created_at: string
          custom_bonus_percent: number | null
          custom_coin_return: number | null
          custom_commission_percent: number | null
          custom_game_difficulty: number | null
          custom_game_speed: number | null
          custom_jump_height: number | null
          deleted_at: string | null
          email: string
          full_name: string
          is_influencer: boolean
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          comissao_cpa?: number | null
          comissao_cpa_nivel2?: number | null
          cpf?: string | null
          created_at?: string
          custom_bonus_percent?: number | null
          custom_coin_return?: number | null
          custom_commission_percent?: number | null
          custom_game_difficulty?: number | null
          custom_game_speed?: number | null
          custom_jump_height?: number | null
          deleted_at?: string | null
          email: string
          full_name?: string
          is_influencer?: boolean
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          comissao_cpa?: number | null
          comissao_cpa_nivel2?: number | null
          cpf?: string | null
          created_at?: string
          custom_bonus_percent?: number | null
          custom_coin_return?: number | null
          custom_commission_percent?: number | null
          custom_game_difficulty?: number | null
          custom_game_speed?: number | null
          custom_jump_height?: number | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          is_influencer?: boolean
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          game_session_id: string | null
          id: number
          reason: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          game_session_id?: string | null
          id?: number
          reason?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          game_session_id?: string | null
          id?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          affiliate_balance: number
          comissao_disponivel: number
          created_at: string
          player_balance: number
          total_affiliate_earned: number
          total_deposited: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_balance?: number
          comissao_disponivel?: number
          created_at?: string
          player_balance?: number
          total_affiliate_earned?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_balance?: number
          comissao_disponivel?: number
          created_at?: string
          player_balance?: number
          total_affiliate_earned?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string | null
          external_id: string | null
          id: number
          payload: Json | null
          processing_status: Database["public"]["Enums"]["webhook_processing_status"]
          provider: string
          signature: string | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          external_id?: string | null
          id?: number
          payload?: Json | null
          processing_status?: Database["public"]["Enums"]["webhook_processing_status"]
          provider: string
          signature?: string | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          event_type?: string | null
          external_id?: string | null
          id?: number
          payload?: Json | null
          processing_status?: Database["public"]["Enums"]["webhook_processing_status"]
          provider?: string
          signature?: string | null
          status_code?: number | null
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          external_id: string | null
          fee_amount: number
          id: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          processed_at: string | null
          rejected_at: string | null
          response: Json | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_kind"]
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          external_id?: string | null
          fee_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          rejected_at?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
          wallet_type?: Database["public"]["Enums"]["wallet_kind"]
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          external_id?: string | null
          fee_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          rejected_at?: string | null
          response?: Json | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_kind"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      banner_placement:
        | "landing"
        | "login"
        | "register"
        | "dashboard"
        | "global"
      commission_source: "deposit" | "game_loss" | "manual"
      commission_status: "pending" | "available" | "paid" | "canceled"
      deposit_status: "pending" | "paid" | "failed" | "rejected" | "canceled"
      game_session_status: "active" | "lost" | "cashed_out" | "won"
      wallet_kind: "player" | "affiliate"
      wallet_tx_type:
        | "bet"
        | "win"
        | "deposit"
        | "commission"
        | "withdrawal_player"
        | "withdrawal_affiliate"
        | "withdrawal_refund"
        | "admin_credit_player"
        | "admin_debit_player"
        | "admin_credit_affiliate"
        | "admin_debit_affiliate"
      webhook_processing_status: "received" | "processed" | "ignored" | "error"
      withdrawal_status:
        | "pending"
        | "approved"
        | "processing"
        | "rejected"
        | "paid"
        | "canceled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      banner_placement: ["landing", "login", "register", "dashboard", "global"],
      commission_source: ["deposit", "game_loss", "manual"],
      commission_status: ["pending", "available", "paid", "canceled"],
      deposit_status: ["pending", "paid", "failed", "rejected", "canceled"],
      game_session_status: ["active", "lost", "cashed_out", "won"],
      wallet_kind: ["player", "affiliate"],
      wallet_tx_type: [
        "bet",
        "win",
        "deposit",
        "commission",
        "withdrawal_player",
        "withdrawal_affiliate",
        "withdrawal_refund",
        "admin_credit_player",
        "admin_debit_player",
        "admin_credit_affiliate",
        "admin_debit_affiliate",
      ],
      webhook_processing_status: ["received", "processed", "ignored", "error"],
      withdrawal_status: [
        "pending",
        "approved",
        "processing",
        "rejected",
        "paid",
        "canceled",
      ],
    },
  },
} as const
