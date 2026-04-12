import { useState } from "react";
import { Star } from "lucide-react";

interface RatingStarsProps {
  value: number | null | undefined;
  onChange?: (score: number | null) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

export function RatingStars({
  value,
  onChange,
  readonly = false,
  size = "md",
}: RatingStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const current = value ?? 0;
  const display = hovered ?? current;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  if (readonly) {
    // Fractional fill: render each star with a clip if partially filled
    return (
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.min(1, Math.max(0, current - (star - 1)));
          return (
            <div key={star} className={`relative ${iconSize}`}>
              {/* Empty star background */}
              <Star className={`absolute inset-0 ${iconSize} fill-none text-gray-300`} />
              {/* Filled star clipped to fractional width */}
              {fill > 0 && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star className={`${iconSize} fill-amber-400 text-amber-400`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => {
            if (onChange) {
              const newValue = star === current ? null : star;
              setHovered(newValue);
              onChange(newValue);
            }
          }}
          onMouseEnter={() => setHovered(star)}
          className="transition-colors"
          aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
        >
          <Star
            className={`${iconSize} ${
              star <= display
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

interface RatingBadgeProps {
  average: number | null | undefined;
  count: number;
}

export function RatingBadge({ average, count }: RatingBadgeProps) {
  if (!average || count === 0) return null;

  return (
    <span className="flex items-center gap-0.5">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span>{average.toFixed(1)}</span>
    </span>
  );
}
