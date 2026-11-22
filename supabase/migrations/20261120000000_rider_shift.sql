-- ============================================================================
-- Phase 9 - Rider portal shift summary
-- ============================================================================
-- The rider portal needs to know whether a shift is already open after a
-- reload. `rider_shifts` is intentionally RPC-only (no table policy), so this
-- security-definer function returns the caller's open shift and nothing else.

CREATE OR REPLACE FUNCTION public.get_rider_shift()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shift public.rider_shifts%ROWTYPE;
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_shift
  FROM public.rider_shifts
  WHERE rider_id = auth.uid()
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'isOpen', false,
      'shiftId', NULL,
      'startedAt', NULL,
      'openingFloat', 0,
      'expectedCash', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'isOpen', true,
    'shiftId', v_shift.id,
    'startedAt', v_shift.started_at,
    'openingFloat', v_shift.opening_float,
    'expectedCash', v_shift.expected_cash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_rider_shift() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rider_shift() TO authenticated;
