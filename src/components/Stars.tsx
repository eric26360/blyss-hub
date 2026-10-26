// Five-star display, or picker when onChange is given.
export function Stars({
  value,
  onChange,
  label,
}: {
  value: number | null | undefined;
  onChange?: (v: number) => void;
  label?: string;
}) {
  const v = value ?? 0;
  return (
    <span className="inline-flex" aria-label={label ?? `${v} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label ?? "Rating"}: ${n} star${n > 1 ? "s" : ""}`}
            className={`text-xl leading-none px-0.5 ${n <= v ? "text-amber-400" : "text-stone-300 hover:text-amber-200"}`}
          >
            ★
          </button>
        ) : (
          <span key={n} className={`${n <= Math.round(v) ? "text-amber-400" : "text-stone-300"}`}>
            ★
          </span>
        ),
      )}
    </span>
  );
}
