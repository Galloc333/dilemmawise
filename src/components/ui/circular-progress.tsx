import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number; // 0-10
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  animated?: boolean;
}

export function CircularProgress({
  value,
  max = 10,
  size = 48,
  strokeWidth = 4,
  className,
  showValue = true,
  animated = true,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = (value / max) * 100;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on value
  const getColor = () => {
    if (value <= 2) return "stroke-muted-foreground/30";
    if (value <= 4) return "stroke-muted-foreground/50";
    if (value <= 6) return "stroke-foreground/70";
    if (value <= 8) return "stroke-primary";
    return "stroke-primary";
  };

  const getTextColor = () => {
    if (value <= 2) return "text-muted-foreground";
    if (value <= 4) return "text-muted-foreground";
    if (value <= 6) return "text-foreground";
    if (value <= 8) return "text-primary";
    return "text-primary font-bold";
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-muted/20"
        />
        
        {/* Progress circle */}
        {animated ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            className={cn("transition-colors duration-300", getColor())}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            className={cn("transition-colors duration-300", getColor())}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        )}
      </svg>
      
      {showValue && (
        <span
          className={cn(
            "absolute text-sm font-bold transition-colors duration-300",
            getTextColor()
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}
