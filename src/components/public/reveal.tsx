import type { ElementType, ReactNode } from "react";
import { useInView } from "@/components/public/use-in-view";
import { cn } from "@/lib/utils";

/** Reveals its children with a rise-and-fade when scrolled into view. */
export function Reveal({
  children,
  delay,
  className,
  as: Tag = "div" as ElementType,
}: {
  children: ReactNode;
  delay?: 1 | 2 | 3;
  className?: string;
  as?: ElementType;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={cn("reveal", delay ? `reveal-d${delay}` : undefined, inView && "is-in", className)}
    >
      {children}
    </Tag>
  );
}
