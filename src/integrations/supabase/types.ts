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
      form_field_canvas_positions: {
        Row: {
          created_at: string
          field_id: string
          order_index: number | null
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          field_id: string
          order_index?: number | null
          updated_at?: string
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          field_id?: string
          order_index?: number | null
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_field_canvas_positions_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: true
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
        ]
      }
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
          measurement_config: Json | null
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
          visual_bg_enabled: boolean
          visual_bg_font_color: string | null
          visual_bg_image_url: string | null
          visual_bg_overlay_color: string | null
          visual_bg_overlay_opacity: number | null
          visual_bg_text_stroke_color: string | null
          visual_bg_text_stroke_width: number | null
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
          measurement_config?: Json | null
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
          visual_bg_enabled?: boolean
          visual_bg_font_color?: string | null
          visual_bg_image_url?: string | null
          visual_bg_overlay_color?: string | null
          visual_bg_overlay_opacity?: number | null
          visual_bg_text_stroke_color?: string | null
          visual_bg_text_stroke_width?: number | null
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
          measurement_config?: Json | null
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
          visual_bg_enabled?: boolean
          visual_bg_font_color?: string | null
          visual_bg_image_url?: string | null
          visual_bg_overlay_color?: string | null
          visual_bg_overlay_opacity?: number | null
          visual_bg_text_stroke_color?: string | null
          visual_bg_text_stroke_width?: number | null
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
      form_group_canvas_frames: {
        Row: {
          collapsed: boolean
          created_at: string
          form_id: string
          group_id: string
          h: number
          id: string
          kind: string
          updated_at: string
          w: number
          x: number
          y: number
        }
        Insert: {
          collapsed?: boolean
          created_at?: string
          form_id: string
          group_id: string
          h?: number
          id?: string
          kind: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
        }
        Update: {
          collapsed?: boolean
          created_at?: string
          form_id?: string
          group_id?: string
          h?: number
          id?: string
          kind?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_group_canvas_frames_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_groups: {
        Row: {
          color: string | null
          condition_combinator: string
          condition_rules: Json
          created_at: string
          form_id: string
          id: string
          internal_name: string
          label: string
          parent_group_id: string | null
          position: number
          updated_at: string
          visual_bg_enabled: boolean
          visual_bg_font_color: string | null
          visual_bg_image_url: string | null
          visual_bg_overlay_color: string | null
          visual_bg_overlay_opacity: number | null
          visual_bg_text_stroke_color: string | null
          visual_bg_text_stroke_width: number | null
          width_percent: number | null
        }
        Insert: {
          color?: string | null
          condition_combinator?: string
          condition_rules?: Json
          created_at?: string
          form_id: string
          id?: string
          internal_name: string
          label: string
          parent_group_id?: string | null
          position?: number
          updated_at?: string
          visual_bg_enabled?: boolean
          visual_bg_font_color?: string | null
          visual_bg_image_url?: string | null
          visual_bg_overlay_color?: string | null
          visual_bg_overlay_opacity?: number | null
          visual_bg_text_stroke_color?: string | null
          visual_bg_text_stroke_width?: number | null
          width_percent?: number | null
        }
        Update: {
          color?: string | null
          condition_combinator?: string
          condition_rules?: Json
          created_at?: string
          form_id?: string
          id?: string
          internal_name?: string
          label?: string
          parent_group_id?: string | null
          position?: number
          updated_at?: string
          visual_bg_enabled?: boolean
          visual_bg_font_color?: string | null
          visual_bg_image_url?: string | null
          visual_bg_overlay_color?: string | null
          visual_bg_overlay_opacity?: number | null
          visual_bg_text_stroke_color?: string | null
          visual_bg_text_stroke_width?: number | null
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
          button_bg_enabled: boolean
          button_bg_font_color: string | null
          button_bg_image_url: string | null
          button_bg_overlay_color: string | null
          button_bg_overlay_opacity: number | null
          button_bg_text_stroke_color: string | null
          button_bg_text_stroke_width: number | null
          canvas_reveal_one_by_one: boolean
          created_at: string
          description: string | null
          id: string
          include_browser: boolean
          include_device_type: boolean
          include_page_url: boolean
          output_url: string | null
          owner_id: string | null
          published: boolean
          schema: Json
          slug: string
          tabs_bg_enabled: boolean
          tabs_bg_font_color: string | null
          tabs_bg_image_url: string | null
          tabs_bg_overlay_color: string | null
          tabs_bg_overlay_opacity: number | null
          tabs_bg_text_stroke_color: string | null
          tabs_bg_text_stroke_width: number | null
          test_webhook_url: string | null
          thank_you_text: string | null
          title: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          active_layout_id?: string | null
          button_bg_enabled?: boolean
          button_bg_font_color?: string | null
          button_bg_image_url?: string | null
          button_bg_overlay_color?: string | null
          button_bg_overlay_opacity?: number | null
          button_bg_text_stroke_color?: string | null
          button_bg_text_stroke_width?: number | null
          canvas_reveal_one_by_one?: boolean
          created_at?: string
          description?: string | null
          id?: string
          include_browser?: boolean
          include_device_type?: boolean
          include_page_url?: boolean
          output_url?: string | null
          owner_id?: string | null
          published?: boolean
          schema?: Json
          slug: string
          tabs_bg_enabled?: boolean
          tabs_bg_font_color?: string | null
          tabs_bg_image_url?: string | null
          tabs_bg_overlay_color?: string | null
          tabs_bg_overlay_opacity?: number | null
          tabs_bg_text_stroke_color?: string | null
          tabs_bg_text_stroke_width?: number | null
          test_webhook_url?: string | null
          thank_you_text?: string | null
          title: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          active_layout_id?: string | null
          button_bg_enabled?: boolean
          button_bg_font_color?: string | null
          button_bg_image_url?: string | null
          button_bg_overlay_color?: string | null
          button_bg_overlay_opacity?: number | null
          button_bg_text_stroke_color?: string | null
          button_bg_text_stroke_width?: number | null
          canvas_reveal_one_by_one?: boolean
          created_at?: string
          description?: string | null
          id?: string
          include_browser?: boolean
          include_device_type?: boolean
          include_page_url?: boolean
          output_url?: string | null
          owner_id?: string | null
          published?: boolean
          schema?: Json
          slug?: string
          tabs_bg_enabled?: boolean
          tabs_bg_font_color?: string | null
          tabs_bg_image_url?: string | null
          tabs_bg_overlay_color?: string | null
          tabs_bg_overlay_opacity?: number | null
          tabs_bg_text_stroke_color?: string | null
          tabs_bg_text_stroke_width?: number | null
          test_webhook_url?: string | null
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
      claim_form: { Args: { _form_id: string }; Returns: boolean }
      is_form_owner: { Args: { _form_id: string }; Returns: boolean }
      user_owns_field: { Args: { _field_id: string }; Returns: boolean }
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
        | "measurement"
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
        "measurement",
      ],
      note_position: ["above", "below", "side"],
    },
  },
} as const
