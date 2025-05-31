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
    "inline-flex items-center justify-center rounded-2xl font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const variants = {
    default: "",
    white: "bg-white text-black hover:bg-gray-100",
    dark: "bg-[#101113] text-white hover:bg-black",
    primary: "bg-[#d9230f] text-white hover:bg-[#bd1e0c]",
    ghost: "bg-transparent hover:bg-white/10 text-white",
    outline: "border border-white/30 text-white hover:bg-white/10",
    github: "bg-[#24292e] text-white hover:bg-black",
    githubLight: "bg-white text-[#24292e] hover:bg-gray-100",
    githubDynamic:
      "bg-[#24292e] text-white hover:bg-black dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
  };
  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-base px-4 py-2",
    lg: "text-lg px-6 py-3",
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
