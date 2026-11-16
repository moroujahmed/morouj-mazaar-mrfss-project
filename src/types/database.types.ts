
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after_state": Json | null,"before_state": Json | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"ip_hash": string | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after_state"?: Json | null,"before_state"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"ip_hash"?: string | null,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after_state"?: Json | null,"before_state"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"ip_hash"?: string | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "busy_buffer_minutes": number,"closing_time": string,"cod_max_radius_km": number,"currency": string,"free_delivery_radius_km": number,"id": number,"is_kitchen_busy": boolean,"is_kitchen_paused": boolean,"is_store_open": boolean,"max_cart_lines": number,"max_cart_value": number,"max_delivery_radius_km": number,"max_item_quantity": number,"minimum_order_value": number,"minimum_order_value_dine_in": number,"opening_time": string,"packaging_fee_default": number,"packaging_fee_dine_in": number,"pin_geofence_m": number,"pin_lock_minutes": number,"pin_max_attempts": number,"rate_per_excess_km": number,"restaurant_lat": number,"restaurant_lng": number,"restaurant_name": string,"staff_session_hours": number,"support_whatsapp": string,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "busy_buffer_minutes"?: number,"closing_time"?: string,"cod_max_radius_km"?: number,"currency"?: string,"free_delivery_radius_km"?: number,"id"?: number,"is_kitchen_busy"?: boolean,"is_kitchen_paused"?: boolean,"is_store_open"?: boolean,"max_cart_lines"?: number,"max_cart_value"?: number,"max_delivery_radius_km"?: number,"max_item_quantity"?: number,"minimum_order_value"?: number,"minimum_order_value_dine_in"?: number,"opening_time"?: string,"packaging_fee_default"?: number,"packaging_fee_dine_in"?: number,"pin_geofence_m"?: number,"pin_lock_minutes"?: number,"pin_max_attempts"?: number,"rate_per_excess_km"?: number,"restaurant_lat"?: number,"restaurant_lng"?: number,"restaurant_name"?: string,"staff_session_hours"?: number,"support_whatsapp"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "busy_buffer_minutes"?: number,"closing_time"?: string,"cod_max_radius_km"?: number,"currency"?: string,"free_delivery_radius_km"?: number,"id"?: number,"is_kitchen_busy"?: boolean,"is_kitchen_paused"?: boolean,"is_store_open"?: boolean,"max_cart_lines"?: number,"max_cart_value"?: number,"max_delivery_radius_km"?: number,"max_item_quantity"?: number,"minimum_order_value"?: number,"minimum_order_value_dine_in"?: number,"opening_time"?: string,"packaging_fee_default"?: number,"packaging_fee_dine_in"?: number,"pin_geofence_m"?: number,"pin_lock_minutes"?: number,"pin_max_attempts"?: number,"rate_per_excess_km"?: number,"restaurant_lat"?: number,"restaurant_lng"?: number,"restaurant_name"?: string,"staff_session_hours"?: number,"support_whatsapp"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blacklisted_phones": {
                  Row: {
                    "created_at": string,"created_by": string | null,"phone": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"phone": string,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"phone"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blacklisted_phones_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_settlements": {
                  Row: {
                    "business_date": string,"counted_cash": number,"created_at": string,"expected_cash": number,"id": string,"notes": string | null,"rider_id": string,"settled_at": string | null,"settled_by": string | null,"status": Database["public"]['Enums']["settlement_status"],"variance": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_date"?: string,"counted_cash": number,"created_at"?: string,"expected_cash": number,"id"?: string,"notes"?: string | null,"rider_id": string,"settled_at"?: string | null,"settled_by"?: string | null,"status"?: Database["public"]['Enums']["settlement_status"],"variance"?: never
                  }
                  Update: {
                    "business_date"?: string,"counted_cash"?: number,"created_at"?: string,"expected_cash"?: number,"id"?: string,"notes"?: string | null,"rider_id"?: string,"settled_at"?: string | null,"settled_by"?: string | null,"status"?: Database["public"]['Enums']["settlement_status"],"variance"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_settlements_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_settlements_settled_by_fkey"
      columns: ["settled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"display_order": number,"id": string,"is_active": boolean,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_order"?: number,"id"?: string,"is_active"?: boolean,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_order"?: number,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"checkout_idempotency": {
                  Row: {
                    "created_at": string,"expires_at": string,"idempotency_key": string,"order_id": string | null,"request_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"idempotency_key": string,"order_id"?: string | null,"request_hash": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"idempotency_key"?: string,"order_id"?: string | null,"request_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkout_idempotency_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"combo_step_options": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"option_item_id": string,"price_delta": number,"sort_order": number,"step_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"option_item_id": string,"price_delta"?: number,"sort_order"?: number,"step_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"option_item_id"?: string,"price_delta"?: number,"sort_order"?: number,"step_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "combo_step_options_option_item_id_fkey"
      columns: ["option_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "combo_step_options_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "combo_steps"
      referencedColumns: ["id"]
    }
                  ]
                },"combo_steps": {
                  Row: {
                    "combo_item_id": string,"created_at": string,"id": string,"is_required": boolean,"max_selections": number,"min_selections": number,"name": string,"step_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "combo_item_id": string,"created_at"?: string,"id"?: string,"is_required"?: boolean,"max_selections"?: number,"min_selections"?: number,"name": string,"step_order"?: number
                  }
                  Update: {
                    "combo_item_id"?: string,"created_at"?: string,"id"?: string,"is_required"?: boolean,"max_selections"?: number,"min_selections"?: number,"name"?: string,"step_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "combo_steps_combo_item_id_fkey"
      columns: ["combo_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_attempts": {
                  Row: {
                    "created_at": string,"id": number,"latitude": number | null,"longitude": number | null,"order_id": string,"outcome": Database["public"]['Enums']["delivery_outcome"],"reason": string | null,"rider_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"latitude"?: number | null,"longitude"?: number | null,"order_id": string,"outcome": Database["public"]['Enums']["delivery_outcome"],"reason"?: string | null,"rider_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"latitude"?: number | null,"longitude"?: number | null,"order_id"?: string,"outcome"?: Database["public"]['Enums']["delivery_outcome"],"reason"?: string | null,"rider_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_attempts_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_attempts_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"item_modifiers": {
                  Row: {
                    "created_at": string,"group_id": string,"id": string,"is_active": boolean,"modifier_type": Database["public"]['Enums']["modifier_type"],"name": string,"price_delta": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"group_id": string,"id"?: string,"is_active"?: boolean,"modifier_type"?: Database["public"]['Enums']["modifier_type"],"name": string,"price_delta"?: number,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"id"?: string,"is_active"?: boolean,"modifier_type"?: Database["public"]['Enums']["modifier_type"],"name"?: string,"price_delta"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_modifiers_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "modifier_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_item_images": {
                  Row: {
                    "alt_text": string,"created_at": string,"id": string,"menu_item_id": string,"sort_order": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text": string,"created_at"?: string,"id"?: string,"menu_item_id": string,"sort_order"?: number,"storage_path": string
                  }
                  Update: {
                    "alt_text"?: string,"created_at"?: string,"id"?: string,"menu_item_id"?: string,"sort_order"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_item_images_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_item_modifier_groups": {
                  Row: {
                    "group_id": string,"menu_item_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"menu_item_id": string,"sort_order"?: number
                  }
                  Update: {
                    "group_id"?: string,"menu_item_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_item_modifier_groups_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "modifier_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "menu_item_modifier_groups_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "base_price": number,"category_id": string,"created_at": string,"description": string | null,"id": string,"image_url": string | null,"is_active": boolean,"is_available": boolean,"is_combo": boolean,"name": string,"prep_time_minutes": number,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_price": number,"category_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"is_available"?: boolean,"is_combo"?: boolean,"name": string,"prep_time_minutes"?: number,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "base_price"?: number,"category_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"is_available"?: boolean,"is_combo"?: boolean,"name"?: string,"prep_time_minutes"?: number,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"modifier_groups": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"is_required": boolean,"max_selections": number,"min_selections": number,"name": string,"selection_type": Database["public"]['Enums']["modifier_selection_type"],"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"is_required"?: boolean,"max_selections"?: number,"min_selections"?: number,"name": string,"selection_type"?: Database["public"]['Enums']["modifier_selection_type"],"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"is_required"?: boolean,"max_selections"?: number,"min_selections"?: number,"name"?: string,"selection_type"?: Database["public"]['Enums']["modifier_selection_type"],"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"id": string,"last_error": string | null,"next_attempt_at": string,"order_id": string | null,"payload": NonNullable<Json>,"recipient": string,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"],"template": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"id"?: string,"last_error"?: string | null,"next_attempt_at"?: string,"order_id"?: string | null,"payload"?: NonNullable<Json>,"recipient": string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"template": string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"id"?: string,"last_error"?: string | null,"next_attempt_at"?: string,"order_id"?: string | null,"payload"?: NonNullable<Json>,"recipient"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"template"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_item_modifiers": {
                  Row: {
                    "created_at": string,"id": string,"modifier_id": string | null,"modifier_type_snapshot": Database["public"]['Enums']["modifier_type"],"name_snapshot": string,"order_item_id": string,"price_delta_snapshot": number,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"modifier_id"?: string | null,"modifier_type_snapshot"?: Database["public"]['Enums']["modifier_type"],"name_snapshot": string,"order_item_id": string,"price_delta_snapshot"?: number,"quantity"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"modifier_id"?: string | null,"modifier_type_snapshot"?: Database["public"]['Enums']["modifier_type"],"name_snapshot"?: string,"order_item_id"?: string,"price_delta_snapshot"?: number,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_item_modifiers_modifier_id_fkey"
      columns: ["modifier_id"]
isOneToOne: false
      referencedRelation: "item_modifiers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_item_modifiers_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "created_at": string,"id": string,"item_name_snapshot": string,"line_total": number | null,"menu_item_id": string | null,"order_id": string,"quantity": number,"unit_price_snapshot": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_name_snapshot": string,"line_total"?: never,"menu_item_id"?: string | null,"order_id": string,"quantity": number,"unit_price_snapshot": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_name_snapshot"?: string,"line_total"?: never,"menu_item_id"?: string | null,"order_id"?: string,"quantity"?: number,"unit_price_snapshot"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "actor_id": string | null,"actor_role": Database["public"]['Enums']["user_role"] | null,"created_at": string,"from_status": Database["public"]['Enums']["order_status"] | null,"id": number,"metadata": NonNullable<Json>,"order_id": string,"reason": string | null,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"order_id": string,"reason"?: string | null,"to_status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["order_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"order_id"?: string,"reason"?: string | null,"to_status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "acknowledged_at": string | null,"admin_edited_at": string | null,"admin_edited_by": string | null,"cancellation_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"claimed_at": string | null,"cod_change_due": number | null,"cod_change_requested_for": number | null,"cod_collected_at": string | null,"created_at": string,"customer_feedback_notes": string | null,"customer_name": string,"customer_notes": string | null,"customer_phone": string,"customer_phone_normalized": string,"customer_rating": Database["public"]['Enums']["feedback_rating"] | null,"delivered_at": string | null,"delivery_address_text": string | null,"delivery_area": string | null,"delivery_fee": number,"delivery_latitude": number | null,"delivery_longitude": number | null,"dispatched_at": string | null,"estimated_travel_minutes": number | null,"eta_at": string | null,"failed_pin_attempts": number,"handover_pin": string,"id": string,"items_subtotal": number,"kitchen_busy_buffer_applied": number,"modifiers_total": number,"order_number": number,"order_status": Database["public"]['Enums']["order_status"],"order_token": string,"order_type": Database["public"]['Enums']["order_type"],"packaging_fee": number,"payment_method": Database["public"]['Enums']["payment_method"],"payment_reference": string | null,"payment_status": Database["public"]['Enums']["payment_status"],"payment_transaction_id": string | null,"pin_locked_until": string | null,"ready_at": string | null,"rider_id": string | null,"road_distance_m": number | null,"security_flag": string | null,"settled_at": string | null,"settlement_id": string | null,"source": Database["public"]['Enums']["order_source"],"table_id": string | null,"table_number": string | null,"total_amount": number | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"admin_edited_at"?: string | null,"admin_edited_by"?: string | null,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"claimed_at"?: string | null,"cod_change_due"?: never,"cod_change_requested_for"?: number | null,"cod_collected_at"?: string | null,"created_at"?: string,"customer_feedback_notes"?: string | null,"customer_name": string,"customer_notes"?: string | null,"customer_phone": string,"customer_phone_normalized": string,"customer_rating"?: Database["public"]['Enums']["feedback_rating"] | null,"delivered_at"?: string | null,"delivery_address_text"?: string | null,"delivery_area"?: string | null,"delivery_fee"?: number,"delivery_latitude"?: number | null,"delivery_longitude"?: number | null,"dispatched_at"?: string | null,"estimated_travel_minutes"?: number | null,"eta_at"?: string | null,"failed_pin_attempts"?: number,"handover_pin": string,"id"?: string,"items_subtotal": number,"kitchen_busy_buffer_applied"?: number,"modifiers_total"?: number,"order_number"?: number,"order_status"?: Database["public"]['Enums']["order_status"],"order_token"?: string,"order_type"?: Database["public"]['Enums']["order_type"],"packaging_fee"?: number,"payment_method": Database["public"]['Enums']["payment_method"],"payment_reference"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"payment_transaction_id"?: string | null,"pin_locked_until"?: string | null,"ready_at"?: string | null,"rider_id"?: string | null,"road_distance_m"?: number | null,"security_flag"?: string | null,"settled_at"?: string | null,"settlement_id"?: string | null,"source"?: Database["public"]['Enums']["order_source"],"table_id"?: string | null,"table_number"?: string | null,"total_amount"?: never,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"admin_edited_at"?: string | null,"admin_edited_by"?: string | null,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"claimed_at"?: string | null,"cod_change_due"?: never,"cod_change_requested_for"?: number | null,"cod_collected_at"?: string | null,"created_at"?: string,"customer_feedback_notes"?: string | null,"customer_name"?: string,"customer_notes"?: string | null,"customer_phone"?: string,"customer_phone_normalized"?: string,"customer_rating"?: Database["public"]['Enums']["feedback_rating"] | null,"delivered_at"?: string | null,"delivery_address_text"?: string | null,"delivery_area"?: string | null,"delivery_fee"?: number,"delivery_latitude"?: number | null,"delivery_longitude"?: number | null,"dispatched_at"?: string | null,"estimated_travel_minutes"?: number | null,"eta_at"?: string | null,"failed_pin_attempts"?: number,"handover_pin"?: string,"id"?: string,"items_subtotal"?: number,"kitchen_busy_buffer_applied"?: number,"modifiers_total"?: number,"order_number"?: number,"order_status"?: Database["public"]['Enums']["order_status"],"order_token"?: string,"order_type"?: Database["public"]['Enums']["order_type"],"packaging_fee"?: number,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_reference"?: string | null,"payment_status"?: Database["public"]['Enums']["payment_status"],"payment_transaction_id"?: string | null,"pin_locked_until"?: string | null,"ready_at"?: string | null,"rider_id"?: string | null,"road_distance_m"?: number | null,"security_flag"?: string | null,"settled_at"?: string | null,"settlement_id"?: string | null,"source"?: Database["public"]['Enums']["order_source"],"table_id"?: string | null,"table_number"?: string | null,"total_amount"?: never,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_admin_edited_by_fkey"
      columns: ["admin_edited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_payment_transaction_id_fkey"
      columns: ["payment_transaction_id"]
isOneToOne: false
      referencedRelation: "payment_transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_settlement_id_fkey"
      columns: ["settlement_id"]
isOneToOne: false
      referencedRelation: "cash_settlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_table_id_fkey"
      columns: ["table_id"]
isOneToOne: false
      referencedRelation: "tables"
      referencedColumns: ["id"]
    }
                  ]
                },"otp_verifications": {
                  Row: {
                    "attempts": number,"code_hash": string,"consumed_at": string | null,"created_at": string,"expires_at": string,"id": string,"ip_hash": string | null,"max_attempts": number,"phone": string,"purpose": Database["public"]['Enums']["otp_purpose"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"code_hash": string,"consumed_at"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"ip_hash"?: string | null,"max_attempts"?: number,"phone": string,"purpose"?: Database["public"]['Enums']["otp_purpose"]
                  }
                  Update: {
                    "attempts"?: number,"code_hash"?: string,"consumed_at"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"ip_hash"?: string | null,"max_attempts"?: number,"phone"?: string,"purpose"?: Database["public"]['Enums']["otp_purpose"]
                  }
                  Relationships: [
                    
                  ]
                },"payment_transactions": {
                  Row: {
                    "amount": number,"attempt_number": number,"created_at": string,"currency": string,"id": string,"initiated_at": string,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"provider": string,"provider_transaction_id": string | null,"raw_payload": NonNullable<Json>,"status": Database["public"]['Enums']["payment_tx_status"],"tx_ref": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"attempt_number"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"initiated_at"?: string,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"provider": string,"provider_transaction_id"?: string | null,"raw_payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["payment_tx_status"],"tx_ref": string,"verified_at"?: string | null
                  }
                  Update: {
                    "amount"?: number,"attempt_number"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"initiated_at"?: string,"method"?: Database["public"]['Enums']["payment_method"],"order_id"?: string,"provider"?: string,"provider_transaction_id"?: string | null,"raw_payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["payment_tx_status"],"tx_ref"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_transactions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"pin_verification_attempts": {
                  Row: {
                    "created_at": string,"id": number,"ip_hash": string | null,"order_id": string,"rider_id": string | null,"success": boolean,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"ip_hash"?: string | null,"order_id": string,"rider_id"?: string | null,"success": boolean,"user_agent"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"ip_hash"?: string | null,"order_id"?: string,"rider_id"?: string | null,"success"?: boolean,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pin_verification_attempts_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pin_verification_attempts_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"failed_login_attempts": number,"full_name": string,"id": string,"is_active": boolean,"last_login_at": string | null,"locked_until": string | null,"motorcycle_plate": string | null,"must_change_pin": boolean,"phone_number": string,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"failed_login_attempts"?: number,"full_name": string,"id": string,"is_active"?: boolean,"last_login_at"?: string | null,"locked_until"?: string | null,"motorcycle_plate"?: string | null,"must_change_pin"?: boolean,"phone_number": string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"failed_login_attempts"?: number,"full_name"?: string,"id"?: string,"is_active"?: boolean,"last_login_at"?: string | null,"locked_until"?: string | null,"motorcycle_plate"?: string | null,"must_change_pin"?: boolean,"phone_number"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"approval_notes": string | null,"approved_at": string | null,"approved_by": string | null,"completed_at": string | null,"created_at": string,"id": string,"initiated_by": string | null,"order_id": string,"payment_transaction_id": string | null,"provider_refund_id": string | null,"reason": string,"status": Database["public"]['Enums']["refund_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"approval_notes"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"initiated_by"?: string | null,"order_id": string,"payment_transaction_id"?: string | null,"provider_refund_id"?: string | null,"reason": string,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Update: {
                    "amount"?: number,"approval_notes"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"initiated_by"?: string | null,"order_id"?: string,"payment_transaction_id"?: string | null,"provider_refund_id"?: string | null,"reason"?: string,"status"?: Database["public"]['Enums']["refund_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_initiated_by_fkey"
      columns: ["initiated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_payment_transaction_id_fkey"
      columns: ["payment_transaction_id"]
isOneToOne: false
      referencedRelation: "payment_transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"rider_shifts": {
                  Row: {
                    "counted_cash": number | null,"created_at": string,"ended_at": string | null,"expected_cash": number | null,"id": string,"notes": string | null,"opening_float": number,"rider_id": string,"settled_at": string | null,"settled_by": string | null,"started_at": string,"status": Database["public"]['Enums']["shift_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "counted_cash"?: number | null,"created_at"?: string,"ended_at"?: string | null,"expected_cash"?: number | null,"id"?: string,"notes"?: string | null,"opening_float"?: number,"rider_id": string,"settled_at"?: string | null,"settled_by"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["shift_status"]
                  }
                  Update: {
                    "counted_cash"?: number | null,"created_at"?: string,"ended_at"?: string | null,"expected_cash"?: number | null,"id"?: string,"notes"?: string | null,"opening_float"?: number,"rider_id"?: string,"settled_at"?: string | null,"settled_by"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["shift_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "rider_shifts_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rider_shifts_settled_by_fkey"
      columns: ["settled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rider_telemetry": {
                  Row: {
                    "accuracy_m": number | null,"heading": number | null,"latitude": number,"longitude": number,"order_id": string | null,"recorded_at": string,"rider_id": string,"speed_mps": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"latitude": number,"longitude": number,"order_id"?: string | null,"recorded_at"?: string,"rider_id": string,"speed_mps"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"latitude"?: number,"longitude"?: number,"order_id"?: string | null,"recorded_at"?: string,"rider_id"?: string,"speed_mps"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rider_telemetry_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rider_telemetry_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"settings_history": {
                  Row: {
                    "after_state": NonNullable<Json>,"before_state": NonNullable<Json>,"changed_by": string | null,"created_at": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "after_state": NonNullable<Json>,"before_state": NonNullable<Json>,"changed_by"?: string | null,"created_at"?: string,"id"?: never
                  }
                  Update: {
                    "after_state"?: NonNullable<Json>,"before_state"?: NonNullable<Json>,"changed_by"?: string | null,"created_at"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tables": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"label": string | null,"qr_token": string,"table_number": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"label"?: string | null,"qr_token"?: string,"table_number": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"label"?: string | null,"qr_token"?: string,"table_number"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"webhook_events": {
                  Row: {
                    "created_at": string,"error": string | null,"event_type": string | null,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"provider_event_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"event_type"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider": string,"provider_event_id": string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"event_type"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"provider_event_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "public_settings_view": {
                  Row: {
                    "busy_buffer_minutes": number,"closing_time": string,"cod_max_radius_km": number,"currency": string,"free_delivery_radius_km": number,"id": number,"is_kitchen_busy": boolean,"is_kitchen_paused": boolean,"is_store_open": boolean,"max_cart_lines": number,"max_cart_value": number,"max_delivery_radius_km": number,"max_item_quantity": number,"minimum_order_value": number,"minimum_order_value_dine_in": number,"opening_time": string,"packaging_fee_default": number,"packaging_fee_dine_in": number,"rate_per_excess_km": number,"restaurant_lat": number,"restaurant_lng": number,"restaurant_name": string,"support_whatsapp": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                           "busy_buffer_minutes"?: number | null,"closing_time"?: string | null,"cod_max_radius_km"?: number | null,"currency"?: string | null,"free_delivery_radius_km"?: number | null,"id"?: number | null,"is_kitchen_busy"?: boolean | null,"is_kitchen_paused"?: boolean | null,"is_store_open"?: boolean | null,"max_cart_lines"?: number | null,"max_cart_value"?: number | null,"max_delivery_radius_km"?: number | null,"max_item_quantity"?: number | null,"minimum_order_value"?: number | null,"minimum_order_value_dine_in"?: number | null,"opening_time"?: string | null,"packaging_fee_default"?: number | null,"packaging_fee_dine_in"?: number | null,"rate_per_excess_km"?: number | null,"restaurant_lat"?: number | null,"restaurant_lng"?: number | null,"restaurant_name"?: string | null,"support_whatsapp"?: string | null,"timezone"?: string | null
                         }
                        Update: {
                           "busy_buffer_minutes"?: number | null,"closing_time"?: string | null,"cod_max_radius_km"?: number | null,"currency"?: string | null,"free_delivery_radius_km"?: number | null,"id"?: number | null,"is_kitchen_busy"?: boolean | null,"is_kitchen_paused"?: boolean | null,"is_store_open"?: boolean | null,"max_cart_lines"?: number | null,"max_cart_value"?: number | null,"max_delivery_radius_km"?: number | null,"max_item_quantity"?: number | null,"minimum_order_value"?: number | null,"minimum_order_value_dine_in"?: number | null,"opening_time"?: string | null,"packaging_fee_default"?: number | null,"packaging_fee_dine_in"?: number | null,"rate_per_excess_km"?: number | null,"restaurant_lat"?: number | null,"restaurant_lng"?: number | null,"restaurant_name"?: string | null,"support_whatsapp"?: string | null,"timezone"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_order":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"admin_approve_refund":
{ Args: { "p_decision": string,"p_notes"?: string,"p_refund_id": string }; Returns: Json
                           },
"admin_cancel_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: Json
                           },
"admin_complete_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: Json
                           },
"admin_get_audit_feed":
{ Args: { "p_entity_type"?: string,"p_limit"?: number,"p_offset"?: number }; Returns: Json
                           },
"admin_get_order":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"admin_list_orders":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_status"?: string }; Returns: Json
                           },
"admin_reassign_order":
{ Args: { "p_order_id": string,"p_reason": string,"p_rider_id": string }; Returns: Json
                           },
"admin_redeliver_order":
{ Args: { "p_order_id": string,"p_reason": string,"p_rider_id"?: string }; Returns: Json
                           },
"admin_reset_handover_pin":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: Json
                           },
"admin_update_order_contact":
{ Args: { "p_customer_name"?: string,"p_customer_notes"?: string,"p_customer_phone"?: string,"p_delivery_address_text"?: string,"p_delivery_area"?: string,"p_delivery_fee"?: number,"p_delivery_latitude"?: number,"p_delivery_longitude"?: number,"p_order_id": string,"p_reason"?: string,"p_road_distance_m"?: number }; Returns: Json
                           },
"admin_update_settings":
{ Args: { "p_payload": Json,"p_reason": string }; Returns: Json
                           },
"admin_update_staff":
{ Args: { "p_is_active": boolean,"p_motorcycle_plate"?: string,"p_profile_id": string,"p_reason"?: string,"p_role": Database["public"]['Enums']["user_role"] }; Returns: Json
                           },
"admin_upsert_category":
{ Args: { "p_payload": Json,"p_reason": string }; Returns: Json
                           },
"admin_upsert_combo":
{ Args: { "p_payload": Json,"p_reason": string }; Returns: Json
                           },
"admin_upsert_menu_item":
{ Args: { "p_payload": Json,"p_reason": string }; Returns: Json
                           },
"admin_upsert_modifier_group":
{ Args: { "p_payload": Json,"p_reason": string }; Returns: Json
                           },
"admin_upsert_table":
{ Args: { "p_payload": Json,"p_reason": string }; Returns: Json
                           },
"bump_order":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"claim_order_atomic":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"close_open_rider_shifts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"create_order":
{ Args: { "p_payload": Json }; Returns: Json
                           },
"current_actor_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"end_rider_shift":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"expire_pending_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finalize_payment_attempt":
{ Args: { "p_error"?: string,"p_provider_transaction_id"?: string,"p_raw_payload"?: Json,"p_success": boolean,"p_tx_ref": string }; Returns: Json
                           },
"fips_mode":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"get_admin_analytics":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"get_admin_ledger":
{ Args: { "p_business_date"?: string }; Returns: Json
                           },
"get_kitchen_orders":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_order_by_token":
{ Args: { "p_token": string }; Returns: Json
                           },
"get_order_telemetry":
{ Args: { "p_token": string }; Returns: Json
                           },
"get_public_settings":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_rider_active_order":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_rider_cash_summary":
{ Args: { "p_rider_id"?: string }; Returns: Json
                           },
"get_rider_pool":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"has_delivered_order":
{ Args: { "p_phone": string }; Returns: boolean
                           },
"haversine_m":
{ Args: { "p_lat1": number,"p_lat2": number,"p_lng1": number,"p_lng2": number }; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_kitchen":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_rider":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"normalize_ug_phone":
{ Args: { "p_phone": string }; Returns: string
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"reconcile_rider_cash":
{ Args: { "p_business_date"?: string,"p_counted_cash": number,"p_notes"?: string,"p_rider_id": string }; Returns: Json
                           },
"release_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: Json
                           },
"report_delivery_failed":
{ Args: { "p_lat"?: number,"p_lng"?: number,"p_order_id": string,"p_outcome": Database["public"]['Enums']["delivery_outcome"],"p_reason": string }; Returns: Json
                           },
"resolve_payment_tx_ref":
{ Args: { "p_tx_ref": string }; Returns: Json
                           },
"set_kitchen_busy":
{ Args: { "p_buffer_minutes"?: number,"p_busy": boolean }; Returns: Json
                           },
"set_kitchen_paused":
{ Args: { "p_paused": boolean }; Returns: Json
                           },
"set_menu_item_availability":
{ Args: { "p_available": boolean,"p_item_id": string }; Returns: Json
                           },
"start_delivery":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"start_payment_attempt":
{ Args: { "p_method": Database["public"]['Enums']["payment_method"],"p_order_token": string,"p_provider"?: string }; Returns: Json
                           },
"start_rider_shift":
{ Args: { "p_opening_float"?: number }; Returns: Json
                           },
"store_cod_otp":
{ Args: { "p_code": string,"p_expires_at": string,"p_ip_hash"?: string,"p_max_attempts"?: number,"p_phone": string }; Returns: Json
                           },
"submit_feedback":
{ Args: { "p_notes"?: string,"p_rating": Database["public"]['Enums']["feedback_rating"],"p_token": string }; Returns: Json
                           },
"update_rider_telemetry":
{ Args: { "p_accuracy_m"?: number,"p_heading"?: number,"p_lat": number,"p_lng": number,"p_order_id": string,"p_speed_mps"?: number }; Returns: Json
                           },
"validate_table_token":
{ Args: { "p_token": string }; Returns: Json
                           },
"verify_cod_otp":
{ Args: { "p_code": string,"p_phone": string }; Returns: Json
                           },
"verify_delivery_pin":
{ Args: { "p_ip_hash"?: string,"p_lat"?: number,"p_lng"?: number,"p_order_id": string,"p_pin": string,"p_user_agent"?: string }; Returns: Json
                           }
          }
          Enums: {
            "delivery_outcome": "DELIVERED"|"CUSTOMER_UNREACHABLE"|"WRONG_ADDRESS"|"REFUSED"|"OTHER"|"RETURNED","feedback_rating": "GREAT"|"OKAY"|"BAD","modifier_selection_type": "SINGLE"|"MULTI","modifier_type": "OMISSION"|"COOKING_STYLE"|"PAID_ADDON","notification_channel": "SMS"|"WHATSAPP"|"PUSH","notification_status": "PENDING"|"SENT"|"FAILED"|"CANCELLED","order_source": "WEB"|"TABLE_QR"|"ADMIN","order_status": "PENDING_PAYMENT"|"CONFIRMED_UNPAID"|"PREPARING"|"READY_FOR_PICKUP"|"CLAIMED"|"OUT_FOR_DELIVERY"|"DELIVERED"|"DELIVERY_FAILED"|"CANCELLED","order_type": "DELIVERY"|"DINE_IN","otp_purpose": "COD_VERIFICATION"|"STAFF_LOGIN","payment_method": "MTN_MOMO"|"AIRTEL_MONEY"|"CASH_ON_DELIVERY"|"BANK_CARD","payment_status": "PENDING"|"PAID"|"FAILED"|"REFUNDED","payment_tx_status": "INITIATED"|"PENDING"|"SUCCESSFUL"|"FAILED"|"ABANDONED","refund_status": "REQUESTED"|"PROCESSING"|"COMPLETED"|"FAILED","settlement_status": "OPEN"|"SETTLED"|"PARTIAL"|"DISPUTED","shift_status": "OPEN"|"CLOSED"|"SETTLED","user_role": "CUSTOMER"|"KITCHEN"|"RIDER"|"ADMIN"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "delivery_outcome": ["DELIVERED", "CUSTOMER_UNREACHABLE", "WRONG_ADDRESS", "REFUSED", "OTHER", "RETURNED"],"feedback_rating": ["GREAT", "OKAY", "BAD"],"modifier_selection_type": ["SINGLE", "MULTI"],"modifier_type": ["OMISSION", "COOKING_STYLE", "PAID_ADDON"],"notification_channel": ["SMS", "WHATSAPP", "PUSH"],"notification_status": ["PENDING", "SENT", "FAILED", "CANCELLED"],"order_source": ["WEB", "TABLE_QR", "ADMIN"],"order_status": ["PENDING_PAYMENT", "CONFIRMED_UNPAID", "PREPARING", "READY_FOR_PICKUP", "CLAIMED", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "CANCELLED"],"order_type": ["DELIVERY", "DINE_IN"],"otp_purpose": ["COD_VERIFICATION", "STAFF_LOGIN"],"payment_method": ["MTN_MOMO", "AIRTEL_MONEY", "CASH_ON_DELIVERY", "BANK_CARD"],"payment_status": ["PENDING", "PAID", "FAILED", "REFUNDED"],"payment_tx_status": ["INITIATED", "PENDING", "SUCCESSFUL", "FAILED", "ABANDONED"],"refund_status": ["REQUESTED", "PROCESSING", "COMPLETED", "FAILED"],"settlement_status": ["OPEN", "SETTLED", "PARTIAL", "DISPUTED"],"shift_status": ["OPEN", "CLOSED", "SETTLED"],"user_role": ["CUSTOMER", "KITCHEN", "RIDER", "ADMIN"]
          }
        }
} as const
