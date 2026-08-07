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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      inverters: {
        Row: {
          brand: string
          created_at: string | null
          id: number
          max_dc_voltage: number
          max_input_current: number
          model: string
          mppt_count: number
          mppt_max: number
          mppt_min: number
          nominal_output_voltage: number
          output_phases: number | null
          power: number
        }
        Insert: {
          brand: string
          created_at?: string | null
          id?: number
          max_dc_voltage: number
          max_input_current: number
          model: string
          mppt_count: number
          mppt_max: number
          mppt_min: number
          nominal_output_voltage: number
          output_phases?: number | null
          power: number
        }
        Update: {
          brand?: string
          created_at?: string | null
          id?: number
          max_dc_voltage?: number
          max_input_current?: number
          model?: string
          mppt_count?: number
          mppt_max?: number
          mppt_min?: number
          nominal_output_voltage?: number
          output_phases?: number | null
          power?: number
        }
        Relationships: []
      }
      modules: {
        Row: {
          brand: string
          created_at: string | null
          id: number
          imp: number
          isc: number
          model: string
          power: number
          vmp: number
          voc: number
        }
        Insert: {
          brand: string
          created_at?: string | null
          id?: never
          imp: number
          isc: number
          model: string
          power: number
          vmp: number
          voc: number
        }
        Update: {
          brand?: string
          created_at?: string | null
          id?: never
          imp?: number
          isc?: number
          model?: string
          power?: number
          vmp?: number
          voc?: number
        }
        Relationships: []
      }
      project_equipment: {
        Row: {
          created_at: string | null
          id: string
          inverter_id: number | null
          module_id: number | null
          project_id: string | null
          quantity_inverters: number | null
          quantity_modules_per_inverter: number
          string_configuration: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inverter_id?: number | null
          module_id?: number | null
          project_id?: string | null
          quantity_inverters?: number | null
          quantity_modules_per_inverter: number
          string_configuration?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inverter_id?: number | null
          module_id?: number | null
          project_id?: string | null
          quantity_inverters?: number | null
          quantity_modules_per_inverter?: number
          string_configuration?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_equipment_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_equipment_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_equipment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: Json | null
          client_document: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          connection_type: string | null
          created_at: string | null
          id: string
          inverter_id: number | null
          module_id: number | null
          technical_details: Json | null
          user_id: string
          utility: string | null
          voltage_level: string | null
        }
        Insert: {
          address?: Json | null
          client_document?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          connection_type?: string | null
          created_at?: string | null
          id?: string
          inverter_id?: number | null
          module_id?: number | null
          technical_details?: Json | null
          user_id?: string
          utility?: string | null
          voltage_level?: string | null
        }
        Update: {
          address?: Json | null
          client_document?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          connection_type?: string | null
          created_at?: string | null
          id?: string
          inverter_id?: number | null
          module_id?: number | null
          technical_details?: Json | null
          user_id?: string
          utility?: string | null
          voltage_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
