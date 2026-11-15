"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function DesignSystemDemos() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { showToast } = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
      <Button
        variant="dark"
        onClick={() =>
          showToast({
            title: "Order accepted",
            description: "Ticket #1042 moved to PREPARING.",
            tone: "success",
          })
        }
      >
        Show success toast
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          showToast({
            title: "Connection required",
            description: "Delivery completion is blocked until the server verifies the PIN.",
            tone: "error",
          })
        }
      >
        Show error toast
      </Button>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Confirm handover"
        description="Enter the 4-digit customer PIN. Three attempts are allowed."
        footer={
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button
              size="xl"
              fullWidth
              onClick={() => {
                setSheetOpen(false);
                showToast({
                  title: "PIN accepted",
                  description: "Order #1042 marked delivered.",
                  tone: "success",
                });
              }}
            >
              Verify PIN
            </Button>
            <Button
              variant="secondary"
              size="xl"
              fullWidth
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <TextField
          label="Handover PIN"
          hint="The customer reads this from the tracker."
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          controlClassName="font-mono text-lg tracking-[0.4em]"
        />
      </Sheet>
    </div>
  );
}
