interface SegmentedToggleProps<Value extends string> {
  label: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange(value: Value): void;
}

/** Same pressed-button pattern as the header's tool toggle. */
export function SegmentedToggle<Value extends string>(
  props: SegmentedToggleProps<Value>
) {
  return (
    <fieldset className="m-0 inline-flex min-w-0 gap-0.5 rounded-panel border border-hairline bg-wash p-0.5">
      <legend className="sr-only">{props.label}</legend>
      {props.options.map((option) => (
        <button
          aria-pressed={props.value === option.value}
          className={`inline-flex h-6 items-center rounded-control px-2.5 text-label font-semibold ${props.value === option.value ? "bg-surface text-ink shadow-raised" : "text-ink-muted hover:text-ink"}`}
          key={option.value}
          onClick={() => props.onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
