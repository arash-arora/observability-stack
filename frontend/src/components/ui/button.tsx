import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    const baseClass =
      "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
    const sizes = {
      default: "h-9 px-4 py-2 text-sm",
      sm: "h-8 rounded-md px-3 text-xs",
      icon: "h-9 w-9",
    };
    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      outline:
        "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
    };
    return (
      <button
        ref={ref}
        className={`${baseClass} ${
          sizes[size] || sizes.default
        } ${variants[variant]} ${className || ""}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
