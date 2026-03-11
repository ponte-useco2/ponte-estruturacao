import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost" | "link";
    size?: "default" | "sm" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    {
                        "bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:-translate-y-0.5": variant === "default",
                        "border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-50": variant === "outline",
                        "hover:bg-slate-100 hover:text-slate-900": variant === "ghost",
                        "text-slate-900 underline-offset-4 hover:underline": variant === "link",
                        "h-12 px-6 text-base": size === "default",
                        "h-9 px-4 text-sm": size === "sm",
                        "h-14 px-8 text-lg": size === "lg",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
