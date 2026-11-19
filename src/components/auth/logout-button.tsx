"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { staffLogoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      isLoading={pending}
      leadingIcon={<LogOut aria-hidden="true" className="size-4" />}
      onClick={() =>
        startTransition(async () => {
          await staffLogoutAction();
          router.replace(redirectTo);
          router.refresh();
        })
      }
    >
      Sign out
    </Button>
  );
}
