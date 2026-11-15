import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * The schema is exported so tests can prove that missing secrets are rejected.
 * Validation is lazy (`getServerEnv`) so `next build` does not need production
 * credentials, while every server entry point still fails closed at runtime.
 */

const e164 = /^\+[1-9]\d{7,14}$/;
const optionalUrl = z.union([z.string().url(), z.literal("")]);

export const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPPORT_WHATSAPP: z
      .string()
      .regex(e164, "support WhatsApp must be E.164"),

    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    STAFF_EMAIL_DOMAIN: z
      .string()
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i)
      .default("staff.moroujmazaar.com"),

    FLW_PUBLIC_KEY: z.string().default(""),
    FLW_SECRET_KEY: z.string().default(""),
    FLW_WEBHOOK_HASH: z.string().default(""),
    FLW_BASE_URL: z.string().url().default("https://api.flutterwave.com/v3"),
    PAYMENTS_MODE: z.enum(["mock", "live"]).default("mock"),

    AFRICASTALKING_API_KEY: z.string().default(""),
    AFRICASTALKING_USERNAME: z.string().default(""),
    AFRICASTALKING_SENDER_ID: z.string().default(""),

    UPSTASH_REDIS_REST_URL: optionalUrl.default(""),
    UPSTASH_REDIS_REST_TOKEN: z.string().default(""),

    NEXT_PUBLIC_MAPTILER_KEY: z.string().default(""),
    OSRM_BASE_URL: optionalUrl.default(""),

    CRON_SECRET: z.string().default(""),
    SENTRY_DSN: optionalUrl.default(""),

    STAFF_SEED_FILE: z.string().default("scripts/staff.example.json"),
    STAFF_RESET_PASSWORDS: z.enum(["true", "false"]).default("false"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.PAYMENTS_MODE !== "live") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PAYMENTS_MODE"],
        message: "production requires PAYMENTS_MODE=live",
      });
    }

    if (value.PAYMENTS_MODE === "live") {
      for (const key of [
        "FLW_PUBLIC_KEY",
        "FLW_SECRET_KEY",
        "FLW_WEBHOOK_HASH",
      ] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `is required when PAYMENTS_MODE=live`,
          });
        }
      }
    }

    if (value.NODE_ENV === "production" && !value.OSRM_BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OSRM_BASE_URL"],
        message: "self-hosted OSRM is required in production",
      });
    }

    if (
      value.NODE_ENV === "production" &&
      (!value.UPSTASH_REDIS_REST_URL || !value.UPSTASH_REDIS_REST_TOKEN)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["UPSTASH_REDIS_REST_URL"],
        message: "durable rate limiting is required in production",
      });
    }

    if (value.NODE_ENV === "production" && !value.CRON_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CRON_SECRET"],
        message: "CRON_SECRET is required in production",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }

  cached = parsed.data;
  return cached;
}

export function resetServerEnvCache(): void {
  cached = null;
}
