import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  trend?: number; // percentage change
  description?: string;
  color?: "blue" | "green" | "red" | "purple" | "yellow" | "orange";
  size?: "sm" | "md" | "lg";
}

const colorClasses = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "text-blue-600 bg-blue-100",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: "text-green-600 bg-green-100",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-600 bg-red-100",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    icon: "text-purple-600 bg-purple-100",
  },
  yellow: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: "text-yellow-600 bg-yellow-100",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    icon: "text-orange-600 bg-orange-100",
  },
};

const sizeClasses = {
  sm: {
    padding: "p-3",
    titleSize: "text-xs",
    valueSize: "text-xl",
    iconSize: "h-5 w-5",
  },
  md: {
    padding: "p-4",
    titleSize: "text-sm",
    valueSize: "text-2xl",
    iconSize: "h-6 w-6",
  },
  lg: {
    padding: "p-6",
    titleSize: "text-base",
    valueSize: "text-3xl",
    iconSize: "h-8 w-8",
  },
};

export function KPICard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  description,
  color = "blue",
  size = "md",
}: KPICardProps) {
  const colors = colorClasses[color];
  const sizes = sizeClasses[size];

  return (
    <div
      className={`${colors.bg} ${colors.border} border rounded-lg ${sizes.padding} flex flex-col h-full`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className={`${sizes.titleSize} font-semibold text-neutral-700 flex-1`}>
          {title}
        </h3>
        {Icon && (
          <div className={`${colors.icon} p-2 rounded-lg ml-2`}>
            <Icon className={`${sizes.iconSize}`} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className={`${sizes.valueSize} font-bold ${colors.text}`}>
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-neutral-600">{unit}</span>
        )}
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1 mb-3">
          {trend > 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : trend < 0 ? (
            <TrendingDown className="h-4 w-4 text-red-600" />
          ) : null}
          <span
            className={`text-xs font-medium ${
              trend > 0 ? "text-green-700" : trend < 0 ? "text-red-700" : "text-neutral-600"
            }`}
          >
            {trend > 0 ? "+" : ""}
            {trend}% from last period
          </span>
        </div>
      )}

      {description && (
        <p className="text-xs text-neutral-600 mt-auto">{description}</p>
      )}
    </div>
  );
}
