import Link from "next/link";
import { cn } from "../_lib/utils";

interface ButtonProps extends React.HTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?:
    | "default"
    | "white"
    | "dark"
    | "primary"
    | "ghost"
    | "outline"
    | "github"
    | "githubLight"
    | "githubDynamic";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button = ({
  href,
  variant = "default",
  size = "md",
  children,
  className,
  ...props
}: ButtonProps) => {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const variants = {
    default: "",
    white: "bg-white text-black hover:bg-gray-100",
    dark: "bg-[#101113] text-white hover:bg-black",
    primary: "bg-[#e85a4f] text-white hover:bg-[#d44f45] hover:-translate-y-px shadow-[0_4px_20px_rgba(232,90,79,0.35)] hover:shadow-[0_8px_30px_rgba(232,90,79,0.45)]",
    ghost: "bg-transparent hover:bg-white/10 text-white",
    outline: "border border-white/20 text-white/80 hover:bg-white/[0.06] hover:text-white hover:border-white/30",
    github: "bg-[#24292e] text-white hover:bg-black",
    githubLight: "bg-white text-[#24292e] hover:bg-gray-100",
    githubDynamic:
      "bg-[#24292e] text-white hover:bg-black dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
  };
  const sizes = {
    sm: "text-[0.82rem] px-4 py-2",
    md: "text-[0.88rem] px-5 py-2.5",
    lg: "text-[0.92rem] px-7 py-3",
  };

  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
};
