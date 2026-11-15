import Image from "next/image";
import { Utensils } from "lucide-react";

import { cn } from "@/lib/utils";

/** Mirrors the placeholder path produced by the storefront menu builder. */
export const PLACEHOLDER_DISH_IMAGE = "/images/placeholder-dish.svg";

/**
 * Dish imagery with a branded fallback. The placeholder is a local SVG, which
 * the Next image optimiser refuses by default, so it is rendered as an icon
 * well instead of an <img> request.
 */
export function DishImage({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const image = src?.trim();

  if (!image || image === PLACEHOLDER_DISH_IMAGE) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex h-full w-full items-center justify-center bg-green-50",
          className,
        )}
      >
        <Utensils className="size-9 text-green-700" />
      </div>
    );
  }

  return (
    <Image
      src={image}
      alt=""
      width={640}
      height={400}
      sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
