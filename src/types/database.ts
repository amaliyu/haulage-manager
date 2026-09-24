// Generated from the live haulage-manager Supabase project (iqbhqddilwpeobbiscba).
// Regenerate after every schema change:
//   npx supabase gen types typescript --project-id iqbhqddilwpeobbiscba --schema public > src/types/database.ts

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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          created_by: string | null
          id: string
          new_values: Json | null
          occurred_at: string
          old_values: Json | null
          record_id: string | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_settlements: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          deductions: number
          driver_id: string
          gross_amount: number
          id: string
          net_amount: number
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          trips_count: number
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deductions?: number
          driver_id: string
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          trips_count?: number
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deductions?: number
          driver_id?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          trips_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_settlements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_settlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sites: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          customer_id: string
          directions: string | null
          geofence_radius_m: number
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          area: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          directions?: string | null
          geofence_radius_m?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          directions?: string | null
          geofence_radius_m?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          alt_phone: string | null
          created_at: string
          created_by: string | null
          credit_days: number
          credit_load_cap: number
          customer_type: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_terms: string
          phone: string
          updated_at: string | null
        }
        Insert: {
          alt_phone?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number
          credit_load_cap?: number
          customer_type?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_terms?: string
          phone: string
          updated_at?: string | null
        }
        Update: {
          alt_phone?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number
          credit_load_cap?: number
          customer_type?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_terms?: string
          phone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_issues: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          issued_at: string
          issued_by: string | null
          litres: number
          note: string | null
          price_per_litre: number
          total_cost: number
          trip_id: string | null
          truck_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          litres: number
          note?: string | null
          price_per_litre: number
          total_cost: number
          trip_id?: string | null
          truck_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          litres?: number
          note?: string | null
          price_per_litre?: number
          total_cost?: number
          trip_id?: string | null
          truck_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_issues_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_issues_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_issues_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_issues_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_prices: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          price_per_litre: number
          set_by: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          price_per_litre: number
          set_by?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          price_per_litre?: number
          set_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_prices_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          assigned_truck_id: string | null
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          licence_number: string | null
          phone: string
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_truck_id?: string | null
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          licence_number?: string | null
          phone: string
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_truck_id?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          licence_number?: string | null
          phone?: string
          profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_assigned_truck_id_fkey"
            columns: ["assigned_truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          description: string
          entry_type: string
          id: string
          occurred_at: string
          payment_id: string | null
          reverses_entry_id: string | null
          trip_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          description: string
          entry_type: string
          id?: string
          occurred_at?: string
          payment_id?: string | null
          reverses_entry_id?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string
          entry_type?: string
          id?: string
          occurred_at?: string
          payment_id?: string | null
          reverses_entry_id?: string | null
          trip_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      material_sources: {
        Row: {
          area: string | null
          created_at: string
          created_by: string | null
          default_material_cost: number
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          material: string
          name: string
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          created_by?: string | null
          default_material_cost?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          material: string
          name: string
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          created_by?: string | null
          default_material_cost?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          material?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          material: string
          notes: string | null
          order_number: string
          payment_terms: string
          price_per_trip: number
          route_id: string
          route_price_id: string | null
          site_id: string
          status: string
          trips_ordered: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          material: string
          notes?: string | null
          order_number?: string
          payment_terms: string
          price_per_trip: number
          route_id: string
          route_price_id?: string | null
          site_id: string
          status?: string
          trips_ordered: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          material?: string
          notes?: string | null
          order_number?: string
          payment_terms?: string
          price_per_trip?: number
          route_id?: string
          route_price_id?: string | null
          site_id?: string
          status?: string
          trips_ordered?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_route_price_id_fkey"
            columns: ["route_price_id"]
            isOneToOne: false
            referencedRelation: "route_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_reference: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: string
          note: string | null
          received_at: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method: string
          note?: string | null
          received_at: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: string
          note?: string | null
          received_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_prices: {
        Row: {
          created_at: string
          created_by: string | null
          crew_cost: number
          customer_price: number
          diesel_price_per_litre: number
          effective_from: string
          effective_to: string | null
          id: string
          material_cost: number
          note: string | null
          route_id: string
          set_by: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crew_cost?: number
          customer_price: number
          diesel_price_per_litre: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          material_cost: number
          note?: string | null
          route_id: string
          set_by?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crew_cost?: number
          customer_price?: number
          diesel_price_per_litre?: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          material_cost?: number
          note?: string | null
          route_id?: string
          set_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_prices_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_prices_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          created_by: string | null
          destination_area: string
          diesel_allowance_litres: number
          distance_km: number | null
          id: string
          is_active: boolean
          name: string
          source_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_area: string
          diesel_allowance_litres: number
          distance_km?: number | null
          id?: string
          is_active?: boolean
          name: string
          source_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_area?: string
          diesel_allowance_litres?: number
          distance_km?: number | null
          id?: string
          is_active?: boolean
          name?: string
          source_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "material_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          actor_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          occurred_at: string
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          occurred_at?: string
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          occurred_at?: string
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_photos: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          photo_type: string
          storage_path: string
          taken_at: string | null
          trip_id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_type: string
          storage_path: string
          taken_at?: string | null
          trip_id: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_type?: string
          storage_path?: string
          taken_at?: string | null
          trip_id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_photos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          assigned_at: string | null
          cancel_reason: string | null
          created_at: string
          created_by: string | null
          crew_cost: number
          delivered_at: string | null
          diesel_cost: number
          diesel_litres_issued: number | null
          driver_id: string | null
          id: string
          loaded_at: string | null
          loader_receipt_no: string | null
          material_cost: number
          order_id: string
          price: number
          repayment_allocation: number
          settled_at: string | null
          source_id: string | null
          status: string
          trip_number: string
          truck_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          crew_cost?: number
          delivered_at?: string | null
          diesel_cost?: number
          diesel_litres_issued?: number | null
          driver_id?: string | null
          id?: string
          loaded_at?: string | null
          loader_receipt_no?: string | null
          material_cost?: number
          order_id: string
          price: number
          repayment_allocation?: number
          settled_at?: string | null
          source_id?: string | null
          status?: string
          trip_number?: string
          truck_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          cancel_reason?: string | null
          created_at?: string
          created_by?: string | null
          crew_cost?: number
          delivered_at?: string | null
          diesel_cost?: number
          diesel_litres_issued?: number | null
          driver_id?: string | null
          id?: string
          loaded_at?: string | null
          loader_receipt_no?: string | null
          material_cost?: number
          order_id?: string
          price?: number
          repayment_allocation?: number
          settled_at?: string | null
          source_id?: string | null
          status?: string
          trip_number?: string
          truck_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "material_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          capacity_tons: number | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          make: string | null
          model: string | null
          owner_name: string | null
          owner_type: string
          plate_number: string
          reference_load_photo_url: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          capacity_tons?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          owner_name?: string | null
          owner_type: string
          plate_number: string
          reference_load_photo_url?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          capacity_tons?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          make?: string | null
          model?: string | null
          owner_name?: string | null
          owner_type?: string
          plate_number?: string
          reference_load_photo_url?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trucks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_route_price: {
        Args: {
          p_crew_cost: number
          p_customer_price: number
          p_diesel_price_per_litre: number
          p_material_cost: number
          p_note?: string
          p_route_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          crew_cost: number
          customer_price: number
          diesel_price_per_litre: number
          effective_from: string
          effective_to: string | null
          id: string
          material_cost: number
          note: string | null
          route_id: string
          set_by: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "route_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_driver_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      is_assigned_driver: { Args: { p_trip_id: string }; Returns: boolean }
      next_doc_number: {
        Args: { p_prefix: string; p_width: number }
        Returns: string
      }
      next_order_number: { Args: never; Returns: string }
      next_trip_number: { Args: never; Returns: string }
      only_columns_changed: {
        Args: { p_allowed: string[]; p_new: Json; p_old: Json }
        Returns: boolean
      }
      set_diesel_price: {
        Args: { p_price_per_litre: number }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          price_per_litre: number
          set_by: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "diesel_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      try_uuid: { Args: { p: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
