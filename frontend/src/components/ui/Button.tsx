"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className = "", variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
  const baseStyles = `
      relative inline-flex items-center justify-center font-mono font-medium
      transition-all duration-200 ease-out
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-void
      disabled:opacity-50 disabled:cursor-not-allowed
      active:scale-[0.98]
    `;

  const variants = {
    primary: `
        bg-electric text-void
        hover:bg-electric-dim hover:shadow-glow-electric
        focus:ring-electric
      `,
    secondary: `
        bg-graphite text-white border border-steel
        hover:bg-steel hover:border-electric/50
        focus:ring-electric
      `,
    ghost: `
        bg-transparent text-gray-400
        hover:text-white hover:bg-graphite
        focus:ring-electric
      `,
    danger: `
        bg-danger/20 text-danger border border-danger/30
        hover:bg-danger hover:text-white
        focus:ring-danger
      `,
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
  };

  return (
    <button ref={ref} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || isLoading} {...props}>
      {isLoading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = "Button";
