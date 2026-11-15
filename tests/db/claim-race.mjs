#!/usr/bin/env node
/**
 * claim_order_atomic race test (TEST_PLAN.md §3.3).
 *
 * Two riders claim the same READY_FOR_PICKUP order concurrently. Exactly one
 * must win; the other must receive ORDER_ALREADY_CLAIMED. The test also proves
 * a rider cannot hold two active orders.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55433/mrfss_final \
 *     node tests/db/claim-race.mjs
 */

import { Client } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:55433/mrfss_final";

const RIDER_ONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const RIDER_TWO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const ORDER_ONE = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const ORDER_TWO = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2";

function fail(message) {
  throw new Error(`FAIL: ${message}`);
}

async function main() {
  const admin = new Client({ connectionString });
  await admin.connect();

  const a = new Client({ connectionString });
  const b = new Client({ connectionString });
  await a.connect();
  await b.connect();

  try {
    await admin.query(`
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
    `);

    await admin.query(
      `INSERT INTO auth.users (id, email) VALUES
         ($1, 'race-rider-1@test.local'),
         ($2, 'race-rider-2@test.local')
       ON CONFLICT (id) DO NOTHING`,
      [RIDER_ONE, RIDER_TWO],
    );

    await admin.query(
      `INSERT INTO public.profiles (id, full_name, phone_number, role, is_active)
       VALUES
         ($1, 'Race Rider One', '+256700900301', 'RIDER', true),
         ($2, 'Race Rider Two', '+256700900302', 'RIDER', true)
       ON CONFLICT (id) DO UPDATE
         SET role = 'RIDER', is_active = true`,
      [RIDER_ONE, RIDER_TWO],
    );

    await admin.query(`DELETE FROM public.orders WHERE id IN ($1, $2)`, [
      ORDER_ONE,
      ORDER_TWO,
    ]);

    await admin.query(
      `INSERT INTO public.orders
         (id, order_number, customer_name, customer_phone,
          customer_phone_normalized, delivery_address_text, delivery_area,
          delivery_latitude, delivery_longitude, road_distance_m,
          items_subtotal, payment_method, order_status, handover_pin)
       VALUES
         ($1, 990001, 'Race Customer One', '+256700900401',
          '+256700900401', 'Race Address One', 'Nakasero',
          0.315000, 32.582000, 1562, 10000, 'CASH_ON_DELIVERY',
          'READY_FOR_PICKUP', '1234'),
         ($2, 990002, 'Race Customer Two', '+256700900402',
          '+256700900402', 'Race Address Two', 'Ntinda',
          0.356000, 32.611000, 8093, 12000, 'CASH_ON_DELIVERY',
          'READY_FOR_PICKUP', '5678')`,
      [ORDER_ONE, ORDER_TWO],
    );

    await a.query(`SET request.jwt.claim.sub = '${RIDER_ONE}'`);
    await a.query("SET ROLE authenticated");
    await b.query(`SET request.jwt.claim.sub = '${RIDER_TWO}'`);
    await b.query("SET ROLE authenticated");

    await a.query("BEGIN");
    const first = await a.query(
      "SELECT public.claim_order_atomic($1::uuid) AS result",
      [ORDER_ONE],
    );
    if (!first.rows[0]?.result) {
      fail("first rider did not receive the claimed order");
    }

    await b.query("BEGIN");
    const secondPromise = b
      .query("SELECT public.claim_order_atomic($1::uuid) AS result", [ORDER_ONE])
      .then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error }),
      );

    // Give rider two time to block on rider one's row lock.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await a.query("COMMIT");

    const second = await secondPromise;
    if (second.ok) {
      fail("both riders claimed the same order");
    }
    if (
      !String(second.error?.message ?? "").includes("ORDER_ALREADY_CLAIMED")
    ) {
      fail(`unexpected second-claim error: ${second.error?.message}`);
    }
    await b.query("ROLLBACK").catch(() => undefined);

    let activeOrderError = false;
    try {
      await a.query("SELECT public.claim_order_atomic($1::uuid)", [ORDER_TWO]);
    } catch (error) {
      activeOrderError = String(error?.message ?? "").includes(
        "RIDER_HAS_ACTIVE_ORDER",
      );
    }
    if (!activeOrderError) {
      fail("a rider with an active order was allowed to claim another");
    }

    console.log("claim_order_atomic race test passed.");
  } finally {
    await admin.query(`DELETE FROM public.orders WHERE id IN ($1, $2)`, [
      ORDER_ONE,
      ORDER_TWO,
    ]);
    await admin.query(`DELETE FROM public.profiles WHERE id IN ($1, $2)`, [
      RIDER_ONE,
      RIDER_TWO,
    ]);
    await admin.query(`DELETE FROM auth.users WHERE id IN ($1, $2)`, [
      RIDER_ONE,
      RIDER_TWO,
    ]);
    await a.end();
    await b.end();
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
