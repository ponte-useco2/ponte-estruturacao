"use client";

import { motion, useInView } from "framer-motion";
import { useRef, ReactNode } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface FadeInProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
    duration?: number;
}

export function FadeIn({
    children,
    className,
    delay = 0,
    direction = "up",
    duration = 0.5,
}: FadeInProps) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

    const directions = {
        up: { y: 30, x: 0 },
        down: { y: -30, x: 0 },
        left: { x: 30, y: 0 },
        right: { x: -30, y: 0 },
        none: { x: 0, y: 0 },
    };

    return (
        <motion.div
            ref={ref}
            initial={{
                opacity: 0,
                ...directions[direction],
            }}
            animate={{
                opacity: isInView ? 1 : 0,
                x: isInView ? 0 : directions[direction].x,
                y: isInView ? 0 : directions[direction].y,
            }}
            transition={{
                duration: duration,
                delay: delay,
                ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
            }}
            className={cn(className)}
        >
            {children}
        </motion.div>
    );
}
