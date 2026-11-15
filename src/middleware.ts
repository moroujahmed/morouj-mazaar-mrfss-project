import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

type StaffRole = Exclude<
  Database["public"]["Enums"]["user_role"],
  "CUSTOMER"
>;

type Portal = {
  base: string;
  login: string;
  roles: readonly StaffRole[];
};

const PORTALS: readonly Portal[] = [
  { base: "/admin", login: "/admin/login", roles: ["ADMIN"] },
  { base: "/kitchen", login: "/kitchen/login", roles: ["KITCHEN", "ADMIN"] },
  { base: "/rider", login: "/rider/login", roles: ["RIDER"] },
];

function homeForRole(role: StaffRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "KITCHEN":
      return "/kitchen";
    case "RIDER":
      return "/rider";
  }
}

async function readStaffRole(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StaffRole | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!data || !data.is_active || data.role === "CUSTOMER") return null;
  return data.role;
}

function loginRedirect(
  request: NextRequest,
  portal: Portal,
  pathname: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = portal.login;
  url.search = "";
  if (pathname !== portal.base) {
    url.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const portal = PORTALS.find(
    (candidate) =>
      pathname === candidate.base ||
      pathname.startsWith(`${candidate.base}/`),
  );

  if (!portal) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail closed when the project is not configured; only the login page stays
  // reachable so the operator sees a clear configuration error there.
  if (!supabaseUrl || !supabaseAnonKey) {
    return pathname === portal.login
      ? NextResponse.next()
      : loginRedirect(request, portal, pathname);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname === portal.login) {
    if (!user) return response;
    const role = await readStaffRole(supabase, user.id);
    if (role && portal.roles.includes(role)) {
      return NextResponse.redirect(new URL(portal.base, request.url));
    }
    return response;
  }

  if (!user) return loginRedirect(request, portal, pathname);

  const role = await readStaffRole(supabase, user.id);
  if (!role) {
    await supabase.auth.signOut();
    return loginRedirect(request, portal, pathname);
  }

  if (!portal.roles.includes(role)) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/kitchen/:path*", "/rider/:path*"],
};
