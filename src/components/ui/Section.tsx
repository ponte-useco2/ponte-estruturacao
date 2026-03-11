import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    containerClass?: string;
    isDark?: boolean;
}

export function Section({ children, className, containerClass, isDark, ...props }: SectionProps) {
    return (
        <section
            className={cn("py-20 md:py-32", isDark ? "bg-slate-50" : "bg-white", className)}
            {...props}
        >
            <div className={cn("container mx-auto px-6 md:px-12 max-w-6xl", containerClass)}>
                {children}
            </div>
        </section>
    );
}
