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
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_public: boolean
          level: Database["public"]["Enums"]["announcement_level"]
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          level?: Database["public"]["Enums"]["announcement_level"]
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          level?: Database["public"]["Enums"]["announcement_level"]
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      cemeteries: {
        Row: {
          address: string | null
          clan_id: string
          created_at: string
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          clan_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          clan_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cemeteries_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
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
          self_person_id: string | null
          self_person_verified: boolean
          user_id: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role: string
          self_person_id?: string | null
          self_person_verified?: boolean
          user_id: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          self_person_id?: string | null
          self_person_verified?: boolean
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
            foreignKeyName: "clan_members_self_person_id_fkey"
            columns: ["self_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_self_person_id_fkey"
            columns: ["self_person_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
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
      clan_post_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: number
          new_status: Database["public"]["Enums"]["clan_post_status"] | null
          note: string | null
          old_status: Database["public"]["Enums"]["clan_post_status"] | null
          post_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: number
          new_status?: Database["public"]["Enums"]["clan_post_status"] | null
          note?: string | null
          old_status?: Database["public"]["Enums"]["clan_post_status"] | null
          post_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: number
          new_status?: Database["public"]["Enums"]["clan_post_status"] | null
          note?: string | null
          old_status?: Database["public"]["Enums"]["clan_post_status"] | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_post_audit_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "clan_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_post_comments: {
        Row: {
          author_id: string
          body: string
          clan_id: string
          created_at: string
          id: string
          post_id: string
          status: Database["public"]["Enums"]["clan_comment_status"]
        }
        Insert: {
          author_id: string
          body: string
          clan_id: string
          created_at?: string
          id?: string
          post_id: string
          status?: Database["public"]["Enums"]["clan_comment_status"]
        }
        Update: {
          author_id?: string
          body?: string
          clan_id?: string
          created_at?: string
          id?: string
          post_id?: string
          status?: Database["public"]["Enums"]["clan_comment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clan_post_comments_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "clan_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_posts: {
        Row: {
          author_id: string
          body: string
          clan_id: string
          created_at: string
          event_date: string | null
          event_id: string | null
          id: string
          person_id: string | null
          pinned: boolean
          status: Database["public"]["Enums"]["clan_post_status"]
          title: string | null
          type: Database["public"]["Enums"]["clan_post_type"]
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          clan_id: string
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          id?: string
          person_id?: string | null
          pinned?: boolean
          status?: Database["public"]["Enums"]["clan_post_status"]
          title?: string | null
          type?: Database["public"]["Enums"]["clan_post_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          clan_id?: string
          created_at?: string
          event_date?: string | null
          event_id?: string | null
          id?: string
          person_id?: string | null
          pinned?: boolean
          status?: Database["public"]["Enums"]["clan_post_status"]
          title?: string | null
          type?: Database["public"]["Enums"]["clan_post_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_posts_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_posts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_posts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          created_at: string
          data_version: number
          description: string | null
          display_death_details: boolean
          display_living_full_dob: boolean
          generation_offset: number
          hide_living_for_nonmembers: boolean
          hide_photos_in_share: boolean
          id: string
          max_persons: number
          max_users: number
          name: string
          name_unaccent: string | null
          owner_id: string | null
          person_count: number
          visibility: string
        }
        Insert: {
          created_at?: string
          data_version?: number
          description?: string | null
          display_death_details?: boolean
          display_living_full_dob?: boolean
          generation_offset?: number
          hide_living_for_nonmembers?: boolean
          hide_photos_in_share?: boolean
          id?: string
          max_persons?: number
          max_users?: number
          name: string
          name_unaccent?: string | null
          owner_id?: string | null
          person_count?: number
          visibility?: string
        }
        Update: {
          created_at?: string
          data_version?: number
          description?: string | null
          display_death_details?: boolean
          display_living_full_dob?: boolean
          generation_offset?: number
          hide_living_for_nonmembers?: boolean
          hide_photos_in_share?: boolean
          id?: string
          max_persons?: number
          max_users?: number
          name?: string
          name_unaccent?: string | null
          owner_id?: string | null
          person_count?: number
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
      contributions: {
        Row: {
          clan_id: string
          contribution_type: string
          created_at: string
          id: string
          person_id: string | null
          proposed_data: Json
          review_note: string | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: string
          submitter_contact: string | null
          submitter_ip: unknown
          submitter_name: string | null
          submitter_note: string | null
          submitter_relation: string | null
          submitter_user_id: string | null
        }
        Insert: {
          clan_id: string
          contribution_type: string
          created_at?: string
          id?: string
          person_id?: string | null
          proposed_data: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: string
          submitter_contact?: string | null
          submitter_ip?: unknown
          submitter_name?: string | null
          submitter_note?: string | null
          submitter_relation?: string | null
          submitter_user_id?: string | null
        }
        Update: {
          clan_id?: string
          contribution_type?: string
          created_at?: string
          id?: string
          person_id?: string | null
          proposed_data?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: string
          submitter_contact?: string | null
          submitter_ip?: unknown
          submitter_name?: string | null
          submitter_note?: string | null
          submitter_relation?: string | null
          submitter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_submitter_user_id_fkey"
            columns: ["submitter_user_id"]
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
          resting_place_id: string | null
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
          resting_place_id?: string | null
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
          resting_place_id?: string | null
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
          {
            foreignKeyName: "events_resting_place_id_fkey"
            columns: ["resting_place_id"]
            isOneToOne: false
            referencedRelation: "resting_places"
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
          spouse_order: number | null
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
          spouse_order?: number | null
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
          spouse_order?: number | null
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
      feedback: {
        Row: {
          admin_note: string | null
          app_version: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          clan_id: string | null
          contact: string | null
          created_at: string
          id: string
          message: string
          page_path: string | null
          page_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          app_version?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          clan_id?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          message: string
          page_path?: string | null
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          app_version?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          clan_id?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          message?: string
          page_path?: string | null
          page_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      giapha_import_chunks: {
        Row: {
          job_id: string
          people: Json
          seq: number
        }
        Insert: {
          job_id: string
          people: Json
          seq: number
        }
        Update: {
          job_id?: string
          people?: Json
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "giapha_import_chunks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "giapha_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      giapha_import_jobs: {
        Row: {
          all_ids: Json
          clan_id: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          result: Json | null
          scraped: number
          source_id: string
          source_url: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          all_ids?: Json
          clan_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          result?: Json | null
          scraped?: number
          source_id: string
          source_url?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          all_ids?: Json
          clan_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          result?: Json | null
          scraped?: number
          source_id?: string
          source_url?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "giapha_import_jobs_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giapha_import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      heritage_items: {
        Row: {
          address: string | null
          body: string | null
          built_year: number | null
          category: Database["public"]["Enums"]["heritage_category"]
          clan_id: string
          cover_media_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          sort: number
          status: Database["public"]["Enums"]["heritage_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          body?: string | null
          built_year?: number | null
          category: Database["public"]["Enums"]["heritage_category"]
          clan_id: string
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          sort?: number
          status?: Database["public"]["Enums"]["heritage_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          body?: string | null
          built_year?: number | null
          category?: Database["public"]["Enums"]["heritage_category"]
          clan_id?: string
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          sort?: number
          status?: Database["public"]["Enums"]["heritage_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "heritage_items_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heritage_items_cover_fk"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "heritage_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heritage_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      heritage_media: {
        Row: {
          bytes: number | null
          caption: string | null
          clan_id: string
          created_at: string
          duration_sec: number | null
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["heritage_media_kind"]
          path: string
          sort: number
        }
        Insert: {
          bytes?: number | null
          caption?: string | null
          clan_id: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["heritage_media_kind"]
          path: string
          sort?: number
        }
        Update: {
          bytes?: number | null
          caption?: string | null
          clan_id?: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["heritage_media_kind"]
          path?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "heritage_media_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heritage_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "heritage_items"
            referencedColumns: ["id"]
          },
        ]
      }
      heritage_people: {
        Row: {
          clan_id: string
          created_at: string
          id: string
          item_id: string
          person_id: string
          role_note: string | null
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          item_id: string
          person_id: string
          role_note?: string | null
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          item_id?: string
          person_id?: string
          role_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heritage_people_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heritage_people_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "heritage_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heritage_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heritage_people_person_id_fkey"
            columns: ["person_id"]
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
      notifications: {
        Row: {
          action_token: string
          actions: string[]
          consumed_action: string | null
          consumed_at: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          target_id: string | null
          user_id: string
        }
        Insert: {
          action_token: string
          actions?: string[]
          consumed_action?: string | null
          consumed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          target_id?: string | null
          user_id: string
        }
        Update: {
          action_token?: string
          actions?: string[]
          consumed_action?: string | null
          consumed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          target_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      person_links: {
        Row: {
          clan_a_id: string
          clan_b_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          id: string
          invite_token: string | null
          link_type: string
          note: string | null
          person_a_id: string
          person_b_id: string | null
          person_b_name_hint: string | null
          revoked_at: string | null
          status: string
        }
        Insert: {
          clan_a_id: string
          clan_b_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          invite_token?: string | null
          link_type?: string
          note?: string | null
          person_a_id: string
          person_b_id?: string | null
          person_b_name_hint?: string | null
          revoked_at?: string | null
          status?: string
        }
        Update: {
          clan_a_id?: string
          clan_b_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          invite_token?: string | null
          link_type?: string
          note?: string | null
          person_a_id?: string
          person_b_id?: string | null
          person_b_name_hint?: string | null
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_links_person_a_id_clan_a_id_fkey"
            columns: ["person_a_id", "clan_a_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "clan_id"]
          },
          {
            foreignKeyName: "person_links_person_a_id_clan_a_id_fkey"
            columns: ["person_a_id", "clan_a_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id", "clan_id"]
          },
          {
            foreignKeyName: "person_links_person_b_id_clan_b_id_fkey"
            columns: ["person_b_id", "clan_b_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "clan_id"]
          },
          {
            foreignKeyName: "person_links_person_b_id_clan_b_id_fkey"
            columns: ["person_b_id", "clan_b_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id", "clan_id"]
          },
        ]
      }
      persons: {
        Row: {
          bio: string | null
          birth_date: string | null
          birth_date_precision: string | null
          birth_family_id: string | null
          birth_lunar_day: number | null
          birth_lunar_is_leap: boolean
          birth_lunar_month: number | null
          birth_lunar_year: number | null
          birth_order: number | null
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
          death_date_precision: string | null
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
          lifespan_years: number | null
          nickname: string | null
          photo_path: string | null
          posthumous_name: string | null
          search_text: string | null
          todo_excluded: boolean
          updated_at: string
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          birth_date_precision?: string | null
          birth_family_id?: string | null
          birth_lunar_day?: number | null
          birth_lunar_is_leap?: boolean
          birth_lunar_month?: number | null
          birth_lunar_year?: number | null
          birth_order?: number | null
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
          death_date_precision?: string | null
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
          lifespan_years?: number | null
          nickname?: string | null
          photo_path?: string | null
          posthumous_name?: string | null
          search_text?: string | null
          todo_excluded?: boolean
          updated_at?: string
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          birth_date_precision?: string | null
          birth_family_id?: string | null
          birth_lunar_day?: number | null
          birth_lunar_is_leap?: boolean
          birth_lunar_month?: number | null
          birth_lunar_year?: number | null
          birth_order?: number | null
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
          death_date_precision?: string | null
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
          lifespan_years?: number | null
          nickname?: string | null
          photo_path?: string | null
          posthumous_name?: string | null
          search_text?: string | null
          todo_excluded?: boolean
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
            foreignKeyName: "persons_birth_family_fk"
            columns: ["birth_family_id"]
            isOneToOne: false
            referencedRelation: "families_public_safe"
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
          notify_monthly_lunar: boolean
          notify_via_push: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          max_clans?: number
          notify_monthly_lunar?: boolean
          notify_via_push?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          max_clans?: number
          notify_monthly_lunar?: boolean
          notify_via_push?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      resting_place_occupants: {
        Row: {
          clan_id: string
          created_at: string
          id: string
          note: string | null
          person_id: string
          resting_place_id: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          note?: string | null
          person_id: string
          resting_place_id: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          note?: string | null
          person_id?: string
          resting_place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resting_place_occupants_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resting_place_occupants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resting_place_occupants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resting_place_occupants_resting_place_id_fkey"
            columns: ["resting_place_id"]
            isOneToOne: false
            referencedRelation: "resting_places"
            referencedColumns: ["id"]
          },
        ]
      }
      resting_place_photos: {
        Row: {
          caption: string | null
          clan_id: string
          created_at: string
          id: string
          path: string
          resting_place_id: string
          sort: number
        }
        Insert: {
          caption?: string | null
          clan_id: string
          created_at?: string
          id?: string
          path: string
          resting_place_id: string
          sort?: number
        }
        Update: {
          caption?: string | null
          clan_id?: string
          created_at?: string
          id?: string
          path?: string
          resting_place_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "resting_place_photos_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resting_place_photos_resting_place_id_fkey"
            columns: ["resting_place_id"]
            isOneToOne: false
            referencedRelation: "resting_places"
            referencedColumns: ["id"]
          },
        ]
      }
      resting_place_relocations: {
        Row: {
          clan_id: string
          created_at: string
          from_label: string | null
          id: string
          moved_on: string | null
          note: string | null
          resting_place_id: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          from_label?: string | null
          id?: string
          moved_on?: string | null
          note?: string | null
          resting_place_id: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          from_label?: string | null
          id?: string
          moved_on?: string | null
          note?: string | null
          resting_place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resting_place_relocations_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resting_place_relocations_resting_place_id_fkey"
            columns: ["resting_place_id"]
            isOneToOne: false
            referencedRelation: "resting_places"
            referencedColumns: ["id"]
          },
        ]
      }
      resting_places: {
        Row: {
          address: string | null
          built_year: number | null
          cemetery_id: string | null
          clan_id: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["resting_place_kind"]
          latitude: number | null
          location_detail: string | null
          location_name: string | null
          longitude: number | null
          material: string | null
          name: string | null
          notes: string | null
          orientation: string | null
          status: Database["public"]["Enums"]["resting_place_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          built_year?: number | null
          cemetery_id?: string | null
          clan_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["resting_place_kind"]
          latitude?: number | null
          location_detail?: string | null
          location_name?: string | null
          longitude?: number | null
          material?: string | null
          name?: string | null
          notes?: string | null
          orientation?: string | null
          status?: Database["public"]["Enums"]["resting_place_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          built_year?: number | null
          cemetery_id?: string | null
          clan_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["resting_place_kind"]
          latitude?: number | null
          location_detail?: string | null
          location_name?: string | null
          longitude?: number | null
          material?: string | null
          name?: string | null
          notes?: string | null
          orientation?: string | null
          status?: Database["public"]["Enums"]["resting_place_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resting_places_cemetery_id_fkey"
            columns: ["cemetery_id"]
            isOneToOne: false
            referencedRelation: "cemeteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resting_places_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          clan_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_revoked: boolean
          root_heritage_item_id: string | null
          root_person_id: string | null
          root_resting_place_id: string | null
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
          root_heritage_item_id?: string | null
          root_person_id?: string | null
          root_resting_place_id?: string | null
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
          root_heritage_item_id?: string | null
          root_person_id?: string | null
          root_resting_place_id?: string | null
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
            foreignKeyName: "share_links_root_heritage_item_id_fkey"
            columns: ["root_heritage_item_id"]
            isOneToOne: false
            referencedRelation: "heritage_items"
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
          {
            foreignKeyName: "share_links_root_resting_place_id_fkey"
            columns: ["root_resting_place_id"]
            isOneToOne: false
            referencedRelation: "resting_places"
            referencedColumns: ["id"]
          },
        ]
      }
      share_view_rate: {
        Row: {
          id: number
          ip: string
          request_count: number
          window_start: string
        }
        Insert: {
          id?: number
          ip: string
          request_count?: number
          window_start: string
        }
        Update: {
          id?: number
          ip?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      families_public_safe: {
        Row: {
          clan_id: string | null
          created_at: string | null
          husband_id: string | null
          id: string | null
          spouse_order: number | null
          union_type: string | null
          wife_id: string | null
        }
        Insert: {
          clan_id?: string | null
          created_at?: string | null
          husband_id?: string | null
          id?: string | null
          spouse_order?: number | null
          union_type?: string | null
          wife_id?: string | null
        }
        Update: {
          clan_id?: string | null
          created_at?: string | null
          husband_id?: string | null
          id?: string | null
          spouse_order?: number | null
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
      persons_public_safe: {
        Row: {
          bio: string | null
          birth_date: string | null
          birth_date_precision: string | null
          birth_family_id: string | null
          birth_lunar_day: number | null
          birth_lunar_month: number | null
          birth_lunar_year: number | null
          birth_order: number | null
          birth_place: string | null
          branch_id: string | null
          burial_place: string | null
          clan_id: string | null
          courtesy_name: string | null
          death_anniv_lunar_day: number | null
          death_anniv_lunar_is_leap: boolean | null
          death_anniv_lunar_month: number | null
          death_date: string | null
          death_date_precision: string | null
          death_lunar_day: number | null
          death_lunar_month: number | null
          death_lunar_year: number | null
          full_name: string | null
          full_name_unaccent: string | null
          gender: string | null
          generation: number | null
          id: string | null
          is_living: boolean | null
          is_root: boolean | null
          lifespan_years: number | null
          nickname: string | null
          photo_path: string | null
          posthumous_name: string | null
        }
        Insert: {
          bio?: never
          birth_date?: never
          birth_date_precision?: never
          birth_family_id?: string | null
          birth_lunar_day?: never
          birth_lunar_month?: never
          birth_lunar_year?: never
          birth_order?: number | null
          birth_place?: never
          branch_id?: string | null
          burial_place?: never
          clan_id?: string | null
          courtesy_name?: never
          death_anniv_lunar_day?: never
          death_anniv_lunar_is_leap?: boolean | null
          death_anniv_lunar_month?: never
          death_date?: never
          death_date_precision?: never
          death_lunar_day?: never
          death_lunar_month?: never
          death_lunar_year?: never
          full_name?: string | null
          full_name_unaccent?: string | null
          gender?: string | null
          generation?: number | null
          id?: string | null
          is_living?: boolean | null
          is_root?: boolean | null
          lifespan_years?: never
          nickname?: never
          photo_path?: never
          posthumous_name?: never
        }
        Update: {
          bio?: never
          birth_date?: never
          birth_date_precision?: never
          birth_family_id?: string | null
          birth_lunar_day?: never
          birth_lunar_month?: never
          birth_lunar_year?: never
          birth_order?: number | null
          birth_place?: never
          branch_id?: string | null
          burial_place?: never
          clan_id?: string | null
          courtesy_name?: never
          death_anniv_lunar_day?: never
          death_anniv_lunar_is_leap?: boolean | null
          death_anniv_lunar_month?: never
          death_date?: never
          death_date_precision?: never
          death_lunar_day?: never
          death_lunar_month?: never
          death_lunar_year?: never
          full_name?: string | null
          full_name_unaccent?: string | null
          gender?: string | null
          generation?: number | null
          id?: string | null
          is_living?: boolean | null
          is_root?: boolean | null
          lifespan_years?: never
          nickname?: never
          photo_path?: never
          posthumous_name?: never
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
            foreignKeyName: "persons_birth_family_fk"
            columns: ["birth_family_id"]
            isOneToOne: false
            referencedRelation: "families_public_safe"
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
    }
    Functions: {
      _inlaw_person_card: {
        Args: {
          hide_living: boolean
          p: Database["public"]["Tables"]["persons"]["Row"]
        }
        Returns: Json
      }
      _person_ancestors: {
        Args: { p_root: string }
        Returns: {
          id: string
        }[]
      }
      _person_descendants: {
        Args: { p_root: string }
        Returns: {
          id: string
        }[]
      }
      admin_import_giapha: {
        Args: { p_clan_id: string; p_families: Json; p_persons: Json }
        Returns: Json
      }
      admin_wipe_clan_directory: { Args: { p_clan_id: string }; Returns: Json }
      announcements_mark_all_read: { Args: never; Returns: number }
      announcements_unread_count: { Args: never; Returns: number }
      apply_contribution: { Args: { p_id: string }; Returns: undefined }
      assign_existing_parent: {
        Args: { p_parent_id: string; p_person_id: string }
        Returns: string
      }
      assign_existing_spouse: {
        Args: { p_person_id: string; p_spouse_id: string }
        Returns: string
      }
      assign_person_to_family: {
        Args: { p_family_id: string; p_person_id: string }
        Returns: undefined
      }
      bulk_import_persons: {
        Args: { payload: Json; target_clan: string }
        Returns: Json
      }
      can_edit_clan: { Args: { target_clan: string }; Returns: boolean }
      clan_post_moderate: {
        Args: { p_action: string; p_note?: string; p_post_id: string }
        Returns: undefined
      }
      clan_role: { Args: { target_clan: string }; Returns: string }
      clear_failed_notification: { Args: { p_id: string }; Returns: undefined }
      confirm_link_by_token: {
        Args: { p_clan_b: string; p_person_b: string; p_token: string }
        Returns: string
      }
      consume_notification_action: {
        Args: {
          p_action: string
          p_action_token: string
          p_notification_id: string
        }
        Returns: boolean
      }
      count_clan_completion_gaps: {
        Args: { p_clan_id: string }
        Returns: number
      }
      count_clan_todo: { Args: { p_clan_id: string }; Returns: number }
      count_my_blocking_clans: { Args: never; Returns: number }
      delete_my_account: { Args: never; Returns: undefined }
      delete_my_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      get_clan_members_info: {
        Args: { target_clan: string }
        Returns: {
          created_at: string
          display_name: string
          invited_by: string
          role: string
          self_person_full_name: string
          self_person_id: string
          self_person_verified: boolean
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
      get_clan_todo_items: {
        Args: {
          p_category: string
          p_clan_id: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          birth_year: number
          death_year: number
          full_name: string
          gender: string
          generation: number
          is_living: boolean
          missing: string[]
          person_id: string
          photo_path: string
        }[]
      }
      get_clan_todo_summary: {
        Args: { p_clan_id: string }
        Returns: {
          category: string
          count: number
        }[]
      }
      get_inlaw_peer_relatives: {
        Args: { p_link_id: string; p_viewing_clan_id?: string }
        Returns: Json
      }
      get_inlaw_proposal_preview: { Args: { p_link_id: string }; Returns: Json }
      get_link_peek: { Args: { p_link_id: string }; Returns: Json }
      get_notification_by_token: {
        Args: { p_action_token: string; p_notification_id: string }
        Returns: Json
      }
      get_platform_db_stats: { Args: never; Returns: Json }
      get_profile_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
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
      merge_persons: {
        Args: { p_loser: string; p_winner: string }
        Returns: Json
      }
      prune_audit_log: { Args: { retention_days?: number }; Returns: number }
      prune_notification_log: {
        Args: { retention_days?: number }
        Returns: number
      }
      prune_notifications: {
        Args: { retention_days?: number }
        Returns: number
      }
      prune_share_view_rate: { Args: never; Returns: undefined }
      recompute_generation_for_clan: {
        Args: { target_clan: string }
        Returns: undefined
      }
      reject_contribution: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: undefined
      }
      resolve_link_token: { Args: { p_token: string }; Returns: Json }
      restore_audit_entry: { Args: { audit_id: string }; Returns: undefined }
      set_my_self_person: {
        Args: { p_clan_id: string; p_person_id: string }
        Returns: undefined
      }
      set_person_todo_excluded: {
        Args: { p_excluded: boolean; p_person_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_my_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
    }
    Enums: {
      announcement_level: "info" | "update" | "warning" | "critical"
      clan_comment_status: "published" | "hidden"
      clan_post_status: "published" | "pending" | "hidden"
      clan_post_type: "news" | "event" | "birth" | "death" | "notice"
      feedback_category: "bug" | "idea" | "question" | "other"
      feedback_status: "new" | "seen" | "resolved" | "spam"
      heritage_category: "place" | "custom" | "story" | "artifact"
      heritage_media_kind: "photo" | "audio"
      heritage_status: "active" | "draft" | "archived"
      resting_place_kind:
        | "grave"
        | "ashes_temple"
        | "columbarium"
        | "scattered"
        | "other"
      resting_place_status: "existing" | "relocated" | "lost"
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
    Enums: {
      announcement_level: ["info", "update", "warning", "critical"],
      clan_comment_status: ["published", "hidden"],
      clan_post_status: ["published", "pending", "hidden"],
      clan_post_type: ["news", "event", "birth", "death", "notice"],
      feedback_category: ["bug", "idea", "question", "other"],
      feedback_status: ["new", "seen", "resolved", "spam"],
      heritage_category: ["place", "custom", "story", "artifact"],
      heritage_media_kind: ["photo", "audio"],
      heritage_status: ["active", "draft", "archived"],
      resting_place_kind: [
        "grave",
        "ashes_temple",
        "columbarium",
        "scattered",
        "other",
      ],
      resting_place_status: ["existing", "relocated", "lost"],
    },
  },
} as const
