import type { ReactNode } from "react";

export function NavItem({
  active,
  onClick,
  children,
  title
}: {
  active: boolean;
  onClick(): void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      className={`flex h-[30px] w-full items-center gap-2 px-2 text-left ${active ? "bg-ink text-canvas" : "hover:bg-wash"}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
