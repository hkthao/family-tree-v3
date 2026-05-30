export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          changed_at: string
          changed_by: string | null
          clan_id: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          clan_id: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          clan_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          ancestral_house: string | null
          clan_id: string
          created_at: string
          deleted_at: string | null
          head_person_id: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          ancestral_house?: string | null
          clan_id: string
          created_at?: string
          deleted_at?: string | null
          head_person_id?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          ancestral_house?: string | null
          clan_id?: string
          created_at?: string
          deleted_at?: string | null
          head_person_id?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_head_person_fk"
            columns: ["head_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_head_person_fk"
            columns: ["head_person_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_members: {
        Row: {
          clan_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          created_at: string
          data_version: number
          description: string | null
          hide_living_for_nonmembers: boolean
          id: string
          max_persons: number
          max_users: number
          name: string
          owner_id: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          data_version?: number
          description?: string | null
          hide_living_for_nonmembers?: boolean
          id?: string
          max_persons?: number
          max_users?: number
          name: string
          owner_id?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          data_version?: number
          description?: string | null
          hide_living_for_nonmembers?: boolean
          id?: string
          max_persons?: number
          max_users?: number
          name?: string
          owner_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "clans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_subscriptions: {
        Row: {
          channels: string[]
          clan_id: string
          created_at: string
          event_types: string[]
          id: string
          is_enabled: boolean
          lead_days: number[]
          scope: string
          target_id: string | null
          user_id: string
        }
        Insert: {
          channels?: string[]
          clan_id: string
          created_at?: string
          event_types?: string[]
          id?: string
          is_enabled?: boolean
          lead_days?: number[]
          scope: string
          target_id?: string | null
          user_id: string
        }
        Update: {
          channels?: string[]
          clan_id?: string
          created_at?: string
          event_types?: string[]
          id?: string
          is_enabled?: boolean
          lead_days?: number[]
          scope?: string
          target_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_subscriptions_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          clan_id: string
          created_at: string
          date_solar: string | null
          event_type: string
          id: string
          is_yearly: boolean
          lunar_day: number | null
          lunar_is_leap: boolean
          lunar_month: number | null
          lunar_year: number | null
          notes: string | null
          related_person_id: string | null
          title: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          date_solar?: string | null
          event_type?: string
          id?: string
          is_yearly?: boolean
          lunar_day?: number | null
          lunar_is_leap?: boolean
          lunar_month?: number | null
          lunar_year?: number | null
          notes?: string | null
          related_person_id?: string | null
          title: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          date_solar?: string | null
          event_type?: string
          id?: string
          is_yearly?: boolean
          lunar_day?: number | null
          lunar_is_leap?: boolean
          lunar_month?: number | null
          lunar_year?: number | null
          notes?: string | null
          related_person_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          clan_id: string
          created_at: string
          deleted_at: string | null
          husband_id: string | null
          id: string
          notes: string | null
          union_type: string | null
          wife_id: string | null
        }
        Insert: {
          clan_id: string
          created_at?: string
          deleted_at?: string | null
          husband_id?: string | null
          id?: string
          notes?: string | null
          union_type?: string | null
          wife_id?: string | null
        }
        Update: {
          clan_id?: string
          created_at?: string
          deleted_at?: string | null
          husband_id?: string | null
          id?: string
          notes?: string | null
          union_type?: string | null
          wife_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "families_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_husband_fk"
            columns: ["husband_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_husband_fk"
            columns: ["husband_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_wife_fk"
            columns: ["wife_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_wife_fk"
            columns: ["wife_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          clan_id: string
          event_key: string
          id: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          clan_id: string
          event_key: string
          id?: string
          sent_at?: string
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          clan_id?: string
          event_key?: string
          id?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          bio: string | null
          birth_date: string | null
          birth_family_id: string | null
          birth_lunar_day: number | null
          birth_lunar_is_leap: boolean
          birth_lunar_month: number | null
          birth_lunar_year: number | null
          birth_place: string | null
          branch_id: string | null
          burial_place: string | null
          clan_id: string
          courtesy_name: string | null
          created_at: string
          death_anniv_lunar_day: number | null
          death_anniv_lunar_is_leap: boolean
          death_anniv_lunar_month: number | null
          death_date: string | null
          death_lunar_day: number | null
          death_lunar_is_leap: boolean
          death_lunar_month: number | null
          death_lunar_year: number | null
          deleted_at: string | null
          full_name: string
          full_name_unaccent: string | null
          gender: string
          generation: number | null
          id: string
          is_living: boolean
          is_root: boolean
          nickname: string | null
          photo_path: string | null
          posthumous_name: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          birth_family_id?: string | null
          birth_lunar_day?: number | null
          birth_lunar_is_leap?: boolean
          birth_lunar_month?: number | null
          birth_lunar_year?: number | null
          birth_place?: string | null
          branch_id?: string | null
          burial_place?: string | null
          clan_id: string
          courtesy_name?: string | null
          created_at?: string
          death_anniv_lunar_day?: number | null
          death_anniv_lunar_is_leap?: boolean
          death_anniv_lunar_month?: number | null
          death_date?: string | null
          death_lunar_day?: number | null
          death_lunar_is_leap?: boolean
          death_lunar_month?: number | null
          death_lunar_year?: number | null
          deleted_at?: string | null
          full_name: string
          full_name_unaccent?: string | null
          gender: string
          generation?: number | null
          id?: string
          is_living?: boolean
          is_root?: boolean
          nickname?: string | null
          photo_path?: string | null
          posthumous_name?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          birth_family_id?: string | null
          birth_lunar_day?: number | null
          birth_lunar_is_leap?: boolean
          birth_lunar_month?: number | null
          birth_lunar_year?: number | null
          birth_place?: string | null
          branch_id?: string | null
          burial_place?: string | null
          clan_id?: string
          courtesy_name?: string | null
          created_at?: string
          death_anniv_lunar_day?: number | null
          death_anniv_lunar_is_leap?: boolean
          death_anniv_lunar_month?: number | null
          death_date?: string | null
          death_lunar_day?: number | null
          death_lunar_is_leap?: boolean
          death_lunar_month?: number | null
          death_lunar_year?: number | null
          deleted_at?: string | null
          full_name?: string
          full_name_unaccent?: string | null
          gender?: string
          generation?: number | null
          id?: string
          is_living?: boolean
          is_root?: boolean
          nickname?: string | null
          photo_path?: string | null
          posthumous_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_birth_family_fk"
            columns: ["birth_family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persons_branch_fk"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persons_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_platform_admin: boolean
          is_suspended: boolean
          max_clans: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          max_clans?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          max_clans?: number
        }
        Relationships: []
      }
      share_links: {
        Row: {
          clan_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_revoked: boolean
          root_person_id: string | null
          scope: string
          token: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean
          root_person_id?: string | null
          scope?: string
          token: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean
          root_person_id?: string | null
          scope?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_root_person_id_fkey"
            columns: ["root_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_root_person_id_fkey"
            columns: ["root_person_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      persons_public_safe: {
        Row: {
          bio: string | null
          birth_date: string | null
          birth_place: string | null
          branch_id: string | null
          burial_place: string | null
          clan_id: string | null
          courtesy_name: string | null
          death_date: string | null
          full_name: string | null
          gender: string | null
          generation: number | null
          id: string | null
          is_living: boolean | null
          is_root: boolean | null
          nickname: string | null
          photo_path: string | null
          posthumous_name: string | null
        }
        Insert: {
          bio?: never
          birth_date?: never
          birth_place?: never
          branch_id?: string | null
          burial_place?: never
          clan_id?: string | null
          courtesy_name?: never
          death_date?: never
          full_name?: string | null
          gender?: string | null
          generation?: number | null
          id?: string | null
          is_living?: boolean | null
          is_root?: boolean | null
          nickname?: never
          photo_path?: never
          posthumous_name?: never
        }
        Update: {
          bio?: never
          birth_date?: never
          birth_place?: never
          branch_id?: string | null
          burial_place?: never
          clan_id?: string | null
          courtesy_name?: never
          death_date?: never
          full_name?: string | null
          gender?: string | null
          generation?: number | null
          id?: string | null
          is_living?: boolean | null
          is_root?: boolean | null
          nickname?: never
          photo_path?: never
          posthumous_name?: never
        }
        Relationships: [
          {
            foreignKeyName: "persons_branch_fk"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persons_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_edit_clan: { Args: { target_clan: string }; Returns: boolean }
      clan_role: { Args: { target_clan: string }; Returns: string }
      count_my_blocking_clans: { Args: never; Returns: number }
      delete_my_account: { Args: never; Returns: undefined }
      f_unaccent: { Args: { "": string }; Returns: string }
      get_clan_members_info: {
        Args: { target_clan: string }
        Returns: {
          created_at: string
          display_name: string
          invited_by: string
          role: string
          user_id: string
        }[]
      }
      get_clan_stats: {
        Args: { target_clan: string }
        Returns: {
          branches: number
          deceased: number
          females: number
          living: number
          males: number
          max_generation: number
          total_persons: number
        }[]
      }
      invite_member_by_email: {
        Args: { member_role: string; target_clan: string; target_email: string }
        Returns: Json
      }
      is_caller_suspended: { Args: never; Returns: boolean }
      is_clan_admin: { Args: { target_clan: string }; Returns: boolean }
      is_clan_member: { Args: { target_clan: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      recompute_generation_for_clan: {
        Args: { target_clan: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

