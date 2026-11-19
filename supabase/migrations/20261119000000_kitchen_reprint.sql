-- ============================================================================
-- Phase 8 - Kitchen docket reprint audit
-- ============================================================================
-- Browser-print dockets are rendered by the application, but every print (and
-- every reprint) must leave an audited record naming the staff member. The
-- application calls this after it has authorised KITCHEN/ADMIN and resolved an
-- active ticket; the function re-checks the staff role so a forged direct call
-- cannot write an audit entry.

CREATE OR REPLACE FUNCTION public.audit_kitchen_reprint(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_number INTEGER;
BEGIN
  IF NOT public.is_kitchen() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT order_number INTO v_number
  FROM public.orders
  WHERE id = p_order_id;

  IF v_number IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, after_state
  ) VALUES (
    auth.uid(), 'KITCHEN_REPRINT_DOCKET', 'orders', p_order_id::text,
    'KITCHEN_REPRINT', jsonb_build_object('orderNumber', v_number)
  );

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'orderNumber', v_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_kitchen_reprint(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_kitchen_reprint(UUID) TO authenticated;
