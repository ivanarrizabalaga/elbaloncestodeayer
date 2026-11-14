export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          target_id: string | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string | null;
          expires_at: string;
          id: string;
          invited_by: string | null;
          person_id: string | null;
          role: Database["public"]["Enums"]["user_role"];
          tag_id: string | null;
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          person_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          tag_id?: string | null;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          person_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          tag_id?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      memories: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          hidden_at: string | null;
          id: string;
          photo_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          photo_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          photo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memories_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memories_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memories_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          bio: string | null;
          claimed_by: string | null;
          created_at: string;
          created_by: string | null;
          full_name: string;
          id: string;
          merged_into: string | null;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          bio?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          full_name: string;
          id?: string;
          merged_into?: string | null;
          slug: string;
        };
        Update: {
          bio?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          full_name?: string;
          id?: string;
          merged_into?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "people_claimed_by_fkey";
            columns: ["claimed_by"];
            isOneToOne: true;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "people_claimed_by_fkey";
            columns: ["claimed_by"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "people_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "people_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "people_merged_into_fkey";
            columns: ["merged_into"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      photos: {
        Row: {
          competition: string | null;
          created_at: string;
          featured: boolean;
          height: number | null;
          id: string;
          instagram_url: string | null;
          photographer: string | null;
          proposed_by: string | null;
          provenance: string | null;
          published_at: string | null;
          published_by: string | null;
          season_label: string | null;
          slug: string;
          status: Database["public"]["Enums"]["photo_status"];
          storage_key: string | null;
          story: string | null;
          team: string | null;
          venue: string | null;
          width: number | null;
          year_from: number | null;
          year_to: number | null;
        };
        ComputedFields: never;
        Insert: {
          competition?: string | null;
          created_at?: string;
          featured?: boolean;
          height?: number | null;
          id?: string;
          instagram_url?: string | null;
          photographer?: string | null;
          proposed_by?: string | null;
          provenance?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          season_label?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["photo_status"];
          storage_key?: string | null;
          story?: string | null;
          team?: string | null;
          venue?: string | null;
          width?: number | null;
          year_from?: number | null;
          year_to?: number | null;
        };
        Update: {
          competition?: string | null;
          created_at?: string;
          featured?: boolean;
          height?: number | null;
          id?: string;
          instagram_url?: string | null;
          photographer?: string | null;
          proposed_by?: string | null;
          provenance?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          season_label?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["photo_status"];
          storage_key?: string | null;
          story?: string | null;
          team?: string | null;
          venue?: string | null;
          width?: number | null;
          year_from?: number | null;
          year_to?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "photos_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          blocked_at: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          invited_by: string | null;
          role: Database["public"]["Enums"]["user_role"];
        };
        ComputedFields: never;
        Insert: {
          blocked_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          blocked_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      review_items: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["review_kind"];
          payload: NonNullable<Json>;
          person_id: string | null;
          photo_id: string | null;
          priority: boolean;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["review_status"];
          tag_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["review_kind"];
          payload?: NonNullable<Json>;
          person_id?: string | null;
          photo_id?: string | null;
          priority?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          tag_id?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["review_kind"];
          payload?: NonNullable<Json>;
          person_id?: string | null;
          photo_id?: string | null;
          priority?: boolean;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          tag_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_items_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_items_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          label_number: number;
          person_id: string | null;
          photo_id: string;
          removed_at: string | null;
          removed_by: string | null;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label_number: number;
          person_id?: string | null;
          photo_id: string;
          removed_at?: string | null;
          removed_by?: string | null;
          x: number;
          y: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label_number?: number;
          person_id?: string | null;
          photo_id?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tags_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tags_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tags_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tags_removed_by_fkey";
            columns: ["removed_by"];
            isOneToOne: false;
            referencedRelation: "profile_names";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tags_removed_by_fkey";
            columns: ["removed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      profile_names: {
        Row: {
          display_name: string | null;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          display_name?: string | null;
          id?: string | null;
        };
        Update: {
          display_name?: string | null;
          id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_published_photo: { Args: { p_photo_id: string }; Returns: boolean };
    };
    Enums: {
      photo_status:
        "proposed" | "draft" | "published" | "rejected" | "withdrawn";
      review_kind:
        | "photo_proposal"
        | "name_suggestion"
        | "removal_request"
        | "tag_dispute"
        | "duplicate_person";
      review_status: "open" | "resolved" | "dismissed";
      user_role: "user" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      photo_status: ["proposed", "draft", "published", "rejected", "withdrawn"],
      review_kind: [
        "photo_proposal",
        "name_suggestion",
        "removal_request",
        "tag_dispute",
        "duplicate_person",
      ],
      review_status: ["open", "resolved", "dismissed"],
      user_role: ["user", "admin"],
    },
  },
} as const;
