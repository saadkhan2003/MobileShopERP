import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, onKeyDown, ...props }, forwardedRef) => {
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    const setRef = React.useCallback(
      (element: HTMLInputElement | null) => {
        internalRef.current = element;
        if (typeof forwardedRef === "function") {
          forwardedRef(element);
        } else if (forwardedRef) {
          (
            forwardedRef as React.MutableRefObject<HTMLInputElement | null>
          ).current = element;
        }
      },
      [forwardedRef],
    );

    const handleChange = React.useCallback<
      React.ChangeEventHandler<HTMLInputElement>
    >(
      (event) => {
        const element = event.currentTarget;
        onChange?.(event);
        if (type === "date" && element.value) {
          // Let the native calendar finish its selection before dismissing it.
          window.setTimeout(() => element.blur(), 0);
        }
      },
      [onChange, type],
    );

    const handleKeyDown = React.useCallback<
      React.KeyboardEventHandler<HTMLInputElement>
    >(
      (event) => {
        onKeyDown?.(event);

        if (event.defaultPrevented) {
          return;
        }

        if (type === "date" && event.key === "Escape") {
          internalRef.current?.blur();
        }
      },
      [onKeyDown, type],
    );

    return (
      <InputPrimitive
        ref={setRef}
        type={type}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
