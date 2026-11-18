-- ============================================================================
-- MRFSS - Phase 7 customer tracker payload
-- ============================================================================
-- Additive migration. It extends `get_order_by_token` with the data the tracker
-- needs without exposing any new table:
--   * an ordered status timeline built from `order_status_history`;
--   * destination coordinates, only while the order is `OUT_FOR_DELIVERY`, so
--     the tracker map can draw the pin the customer already chose;
--   * the existing rider telemetry block remains scoped to `OUT_FOR_DELIVERY`.
--
-- The token is the bearer capability. The payload never includes the customer
-- phone, notes, payment references, or any other order's data. `handover_pin`
-- stays limited to active delivery orders and is never broadcast.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'orderToken', o.order_token,
    'orderNumber', o.order_number,
    'orderType', o.order_type,
    'source', o.source,
    'status', o.order_status,
    'paymentStatus', o.payment_status,
    'paymentMethod', o.payment_method,
    'customerName', o.customer_name,
    'tableNumber', o.table_number,
    'deliveryArea', o.delivery_area,
    'itemsSubtotal', o.items_subtotal,
    'modifiersTotal', o.modifiers_total,
    'deliveryFee', o.delivery_fee,
    'packagingFee', o.packaging_fee,
    'totalAmount', o.total_amount,
    'codChangeRequestedFor', o.cod_change_requested_for,
    'codChangeDue', o.cod_change_due,
    -- Dine-in orders never use a handover PIN; terminal orders no longer need it.
    'handoverPin', CASE
      WHEN o.order_type = 'DELIVERY'
       AND o.order_status NOT IN ('DELIVERED', 'DELIVERY_FAILED', 'CANCELLED')
      THEN o.handover_pin
      ELSE NULL
    END,
    'etaAt', o.eta_at,
    'acknowledgedAt', o.acknowledged_at,
    'roadDistanceM', o.road_distance_m,
    'estimatedTravelMinutes', o.estimated_travel_minutes,
    'createdAt', o.created_at,
    'readyAt', o.ready_at,
    'deliveredAt', o.delivered_at,
    'cancelledAt', o.cancelled_at,
    'cancellationReason', o.cancellation_reason,
    -- The map is only shown while the rider is en route. Outside that window
    -- the destination pin is neither needed nor returned.
    'destinationLatitude', CASE
      WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN o.delivery_latitude
    END,
    'destinationLongitude', CASE
      WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN o.delivery_longitude
    END,
    'canRate', (o.order_status = 'DELIVERED' AND o.customer_rating IS NULL),
    'feedback', CASE
      WHEN o.customer_rating IS NULL THEN NULL
      ELSE jsonb_build_object(
        'rating', o.customer_rating,
        'notes', o.customer_feedback_notes
      )
    END,
    'timeline', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'status', h.to_status,
          'at', h.created_at,
          'reason', h.reason
        )
        ORDER BY h.created_at, h.id
      )
      FROM public.order_status_history h
      WHERE h.order_id = o.id
    ), '[]'::jsonb),
    'refund', (
      SELECT jsonb_build_object(
        'status', r.status,
        'amount', r.amount,
        'reason', r.reason,
        'requestedAt', r.created_at,
        'completedAt', r.completed_at
      )
      FROM public.refunds r
      WHERE r.order_id = o.id
      ORDER BY r.created_at DESC
      LIMIT 1
    ),
    'deliveryFailure', (
      SELECT jsonb_build_object(
        'outcome', d.outcome,
        'reason', d.reason,
        'createdAt', d.created_at
      )
      FROM public.delivery_attempts d
      WHERE d.order_id = o.id
      ORDER BY d.created_at DESC
      LIMIT 1
    ),
    'rider', CASE
      WHEN o.order_status IN ('CLAIMED', 'OUT_FOR_DELIVERY') THEN jsonb_build_object(
        'name', p.full_name,
        'phone', p.phone_number,
        'latitude', CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN t.latitude END,
        'longitude', CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN t.longitude END,
        'updatedAt', CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN t.updated_at END
      )
      ELSE NULL
    END,
    'items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', oi.item_name_snapshot,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price_snapshot,
          'lineTotal', oi.line_total,
          'modifiers', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', m.name_snapshot,
                'priceDelta', m.price_delta_snapshot
              )
              ORDER BY m.id
            )
            FROM public.order_item_modifiers m
            WHERE m.order_item_id = oi.id
          ), '[]'::jsonb)
        )
        ORDER BY oi.created_at, oi.id
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.rider_id
  LEFT JOIN public.rider_telemetry t ON t.rider_id = o.rider_id AND t.order_id = o.id
  WHERE o.order_token = p_token;

  RETURN v_result;
END;
$$;

-- CREATE OR REPLACE keeps the existing anon/authenticated grants. Re-asserting
-- them keeps a fresh database deterministic.
GRANT EXECUTE ON FUNCTION public.get_order_by_token(UUID)
  TO anon, authenticated;

COMMIT;
