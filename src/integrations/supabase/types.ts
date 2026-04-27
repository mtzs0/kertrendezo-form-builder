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
      form_field_conditions: {
        Row: {
          combinator: string
          created_at: string
          field_id: string
          id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          combinator?: string
          created_at?: string
          field_id: string
          id?: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          combinator?: string
          created_at?: string
          field_id?: string
          id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_field_conditions_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: true
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      form_field_options: {
        Row: {
          created_at: string
          data_name: string
          display_name: string
          field_id: string
          id: string
          image_url: string | null
          note_position: Database["public"]["Enums"]["note_position"] | null
          note_value: string | null
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_name: string
          display_name: string
          field_id: string
          id?: string
          image_url?: string | null
          note_position?: Database["public"]["Enums"]["note_position"] | null
          note_value?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_name?: string
          display_name?: string
          field_id?: string
          id?: string
          image_url?: string | null
          note_position?: Database["public"]["Enums"]["note_position"] | null
          note_value?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          columns: number
          created_at: string
          field_image_position: string | null
          form_id: string
          group_id: string | null
          hide_label: boolean
          id: string
          internal_name: string
          label: string
          multiple_images: boolean
          note_position: Database["public"]["Enums"]["note_position"] | null
          note_value: string | null
          option_label_position: string | null
          placeholder: string | null
          placeholder_image_url: string | null
          placeholder_note_position:
            | Database["public"]["Enums"]["note_position"]
            | null
          placeholder_note_value: string | null
          position: number
          repeater_config: Json | null
          required: boolean
          slider_custom_stops: Json | null
          slider_max: number | null
          slider_min: number | null
          slider_step: number | null
          slider_unit: string | null
          sub_group_id: string | null
          type: Database["public"]["Enums"]["field_type"]
          unique_note_per_option: boolean
          updated_at: string
          use_images: boolean
          width_percent: number | null
          with_time: boolean
        }
        Insert: {
          columns?: number
          created_at?: string
          field_image_position?: string | null
          form_id: string
          group_id?: string | null
          hide_label?: boolean
          id?: string
          internal_name: string
          label: string
          multiple_images?: boolean
          note_position?: Database["public"]["Enums"]["note_position"] | null
          note_value?: string | null
          option_label_position?: string | null
          placeholder?: string | null
          placeholder_image_url?: string | null
          placeholder_note_position?:
            | Database["public"]["Enums"]["note_position"]
            | null
          placeholder_note_value?: string | null
          position?: number
          repeater_config?: Json | null
          required?: boolean
          slider_custom_stops?: Json | null
          slider_max?: number | null
          slider_min?: number | null
          slider_step?: number | null
          slider_unit?: string | null
          sub_group_id?: string | null
          type: Database["public"]["Enums"]["field_type"]
          unique_note_per_option?: boolean
          updated_at?: string
          use_images?: boolean
          width_percent?: number | null
          with_time?: boolean
        }
        Update: {
          columns?: number
          created_at?: string
          field_image_position?: string | null
          form_id?: string
          group_id?: string | null
          hide_label?: boolean
          id?: string
          internal_name?: string
          label?: string
          multiple_images?: boolean
          note_position?: Database["public"]["Enums"]["note_position"] | null
          note_value?: string | null
          option_label_position?: string | null
          placeholder?: string | null
          placeholder_image_url?: string | null
          placeholder_note_position?:
            | Database["public"]["Enums"]["note_position"]
            | null
          placeholder_note_value?: string | null
          position?: number
          repeater_config?: Json | null
          required?: boolean
          slider_custom_stops?: Json | null
          slider_max?: number | null
          slider_min?: number | null
          slider_step?: number | null
          slider_unit?: string | null
          sub_group_id?: string | null
          type?: Database["public"]["Enums"]["field_type"]
          unique_note_per_option?: boolean
          updated_at?: string
          use_images?: boolean
          width_percent?: number | null
          with_time?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "form_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_fields_sub_group_id_fkey"
            columns: ["sub_group_id"]
            isOneToOne: false
            referencedRelation: "form_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      form_groups: {
        Row: {
          created_at: string
          form_id: string
          id: string
          internal_name: string
          label: string
          parent_group_id: string | null
          position: number
          updated_at: string
          width_percent: number | null
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          internal_name: string
          label: string
          parent_group_id?: string | null
          position?: number
          updated_at?: string
          width_percent?: number | null
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          internal_name?: string
          label?: string
          parent_group_id?: string | null
          position?: number
          updated_at?: string
          width_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_groups_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "form_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      form_layouts: {
        Row: {
          created_at: string
          form_id: string
          id: string
          name: string
          snapshot: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          name: string
          snapshot?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          name?: string
          snapshot?: Json
          updated_at?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          created_at: string
          form_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
          values: Json
          webhook_response: string | null
          webhook_status: string | null
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          values?: Json
          webhook_response?: string | null
          webhook_status?: string | null
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          values?: Json
          webhook_response?: string | null
          webhook_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active_layout_id: string | null
          created_at: string
          description: string | null
          id: string
          published: boolean
          schema: Json
          slug: string
          thank_you_text: string | null
          title: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          active_layout_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          published?: boolean
          schema?: Json
          slug: string
          thank_you_text?: string | null
          title: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          active_layout_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          published?: boolean
          schema?: Json
          slug?: string
          thank_you_text?: string | null
          title?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_active_layout_id_fkey"
            columns: ["active_layout_id"]
            isOneToOne: false
            referencedRelation: "form_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      field_type:
        | "text"
        | "textarea"
        | "slider"
        | "radio"
        | "checkbox"
        | "select"
        | "phone"
        | "date"
        | "image"
        | "label"
        | "post_code"
        | "city"
        | "street"
        | "email"
        | "repeater"
      note_position: "above" | "below" | "side"
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
      field_type: [
        "text",
        "textarea",
        "slider",
        "radio",
        "checkbox",
        "select",
        "phone",
        "date",
        "image",
        "label",
        "post_code",
        "city",
        "street",
        "email",
        "repeater",
      ],
      note_position: ["above", "below", "side"],
    },
  },
} as const
