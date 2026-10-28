"use client";

import { Command as CommandPrimitive } from "cmdk";
import { cn } from "cn";
import { Check, ChevronDown, SearchIcon } from "lucide-react";
import { Slot } from "radix-ui";
import {
  composeEventHandlers,
  useComposedRefs,
  useLayoutEffect,
} from "radix-ui/internal";
import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FacetedSelectedValue<Multiple extends boolean> = Multiple extends true
  ? string[]
  : string;

interface FacetedOption {
  label: string;
  value: string;
}

const NO_ITEMS: FacetedOption[] = [];

interface FacetedStoreState {
  items: FacetedOption[];
  multiple: boolean;
  value: string | string[] | undefined;
}

interface FacetedController {
  isValueControlled: boolean;
  onValueChange?: (value: string | string[] | undefined) => void;
  setOpen: (open: boolean) => void;
}

interface FacetedStore {
  clear: () => void;
  controller: FacetedController;
  getState: () => FacetedStoreState;
  notify: () => void;
  selectItem: (value: string) => void;
  setOpen: (open: boolean) => void;
  subscribe: (callback: () => void) => () => void;
  sync: (changes: Partial<FacetedStoreState>) => void;
}

function getIsValueSelected(
  value: string | string[] | undefined,
  multiple: boolean,
  itemValue: string
) {
  if (multiple) return Array.isArray(value) && value.includes(itemValue);
  return value === itemValue;
}

const labelsCache = new WeakMap<FacetedOption[], Map<string, string>>();

function getLabels(items: FacetedOption[]) {
  let labels = labelsCache.get(items);
  if (!labels) {
    labels = new Map(items.map((item) => [item.value, item.label]));
    labelsCache.set(items, labels);
  }
  return labels;
}

function getSelectedValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function getSelectedItems(
  values: string[],
  items: FacetedOption[]
): FacetedOption[] {
  const labels = getLabels(items);

  return values.map((value) => ({
    label: labels.get(value) ?? value,
    value,
  }));
}

function getIsFacetedSelectedValue<Multiple extends boolean>(
  value: string | string[] | undefined,
  multiple: Multiple
): value is FacetedSelectedValue<Multiple> | undefined {
  if (value === undefined) return true;
  return multiple ? Array.isArray(value) : typeof value === "string";
}

function createFacetedStore(state: FacetedStoreState): FacetedStore {
  const listeners = new Set<() => void>();

  function commitValue(nextValue: string | string[] | undefined) {
    store.controller.onValueChange?.(nextValue);
    if (
      !store.controller.isValueControlled &&
      !Object.is(state.value, nextValue)
    ) {
      state.value = nextValue;
      store.notify();
    }
  }

  const store: FacetedStore = {
    clear: () => {
      commitValue(state.multiple ? [] : undefined);
    },
    controller: {
      isValueControlled: false,
      setOpen: () => {},
    },
    getState: () => state,
    notify: () => {
      for (const callback of listeners) {
        callback();
      }
    },
    selectItem: (selectedValue) => {
      if (state.multiple) {
        const selected = Array.isArray(state.value) ? state.value : [];
        commitValue(
          selected.includes(selectedValue)
            ? selected.filter((item) => item !== selectedValue)
            : [...selected, selectedValue]
        );
        return;
      }

      commitValue(state.value === selectedValue ? undefined : selectedValue);
      store.setOpen(false);
    },
    setOpen: (open) => store.controller.setOpen(open),
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    sync: (changes) => {
      let hasChanged = false;
      for (const key of Object.keys(changes) as (keyof FacetedStoreState)[]) {
        if (Object.is(state[key], changes[key])) continue;
        Object.assign(state, { [key]: changes[key] });
        hasChanged = true;
      }
      if (hasChanged) store.notify();
    },
  };

  return store;
}

function useFacetedStoreSelector<T>(
  store: FacetedStore,
  selector: (state: FacetedStoreState) => T
): T {
  const getSnapshot = () => selector(store.getState());
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

const FacetedStoreContext = React.createContext<FacetedStore | null>(null);

function useFacetedStore(name: string) {
  const store = React.useContext(FacetedStoreContext);
  if (!store) {
    throw new Error(`\`${name}\` must be used within \`Faceted\`.`);
  }
  return store;
}

interface FacetedProps<Multiple extends boolean = false>
  extends React.ComponentProps<typeof Popover> {
  defaultValue?: FacetedSelectedValue<Multiple>;
  items?: FacetedOption[];
  multiple?: Multiple;
  onValueChange?: (value: FacetedSelectedValue<Multiple> | undefined) => void;
  value?: FacetedSelectedValue<Multiple>;
}

function Faceted<Multiple extends boolean = false>({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  value,
  defaultValue,
  onValueChange,
  items = NO_ITEMS,
  multiple = false as Multiple,
  ...props
}: FacetedProps<Multiple>) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;

  const [store] = React.useState(() =>
    createFacetedStore({ items, multiple, value: value ?? defaultValue })
  );

  useLayoutEffect(() => {
    store.controller = {
      isValueControlled: value !== undefined,
      onValueChange(nextValue) {
        if (!getIsFacetedSelectedValue(nextValue, multiple)) return;
        onValueChange?.(nextValue);
      },
      setOpen(nextOpen) {
        onOpenChange?.(nextOpen);
        if (openProp === undefined) setInternalOpen(nextOpen);
      },
    };
  });

  const wasValueControlledRef = React.useRef(value !== undefined);

  useLayoutEffect(() => {
    const isValueControlled = value !== undefined;
    store.sync(
      isValueControlled || wasValueControlledRef.current
        ? { items, multiple, value }
        : { items, multiple }
    );
    wasValueControlledRef.current = isValueControlled;
  }, [store, value, items, multiple]);

  return (
    <FacetedStoreContext.Provider value={store}>
      <Popover
        data-slot="faceted"
        onOpenChange={store.setOpen}
        open={open}
        {...props}
      />
    </FacetedStoreContext.Provider>
  );
}

function FacetedTrigger({
  className,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return (
    <PopoverTrigger
      className={cn(
        "justify-between text-left has-[>[data-slot=faceted-value]]:transition-[color,background-color,border-color,box-shadow] has-[>[data-slot=faceted-value]>[data-slot=faceted-badge-list]]:pl-1",
        className
      )}
      data-slot="faceted-trigger"
      {...props}
    />
  );
}

interface FacetedValueProps {
  children?: React.ReactNode | ((selected: FacetedOption[]) => React.ReactNode);
  placeholder?: React.ReactNode;
}

function FacetedValue({
  placeholder = "Select options...",
  children,
}: FacetedValueProps) {
  const store = useFacetedStore("FacetedValue");
  const value = useFacetedStoreSelector(store, (state) => state.value);
  const items = useFacetedStoreSelector(store, (state) => state.items);
  const multiple = useFacetedStoreSelector(store, (state) => state.multiple);
  const values = getSelectedValues(value);

  if (typeof children === "function") {
    return children(getSelectedItems(values, items));
  }
  if (children != null) return children;

  const selected =
    multiple && values.length > 2 ? [] : getSelectedItems(values, items);
  const [item] = selected;

  return (
    <span
      className={cn(
        "flex w-full min-w-0 items-center gap-1",
        values.length === 0 && "text-muted-foreground"
      )}
      data-slot="faceted-value"
    >
      {multiple && values.length > 0 ? (
        <FacetedBadgeList>
          {values.length > 2 ? (
            <FacetedBadge>{values.length} selected</FacetedBadge>
          ) : (
            selected.map((selectedItem) => (
              <FacetedBadge key={selectedItem.value}>
                <span className="truncate">{selectedItem.label}</span>
              </FacetedBadge>
            ))
          )}
        </FacetedBadgeList>
      ) : (
        <span className="truncate">{item ? item.label : placeholder}</span>
      )}
      <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </span>
  );
}

function FacetedBadgeList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-max max-w-full flex-wrap items-center gap-1",
        className
      )}
      data-slot="faceted-badge-list"
      {...props}
    />
  );
}

interface FacetedBadgeProps extends React.ComponentProps<"span"> {
  asChild?: boolean;
}

function FacetedBadge({
  className,
  asChild = false,
  ...props
}: FacetedBadgeProps) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit max-w-full min-w-0 items-center justify-center gap-1 rounded-sm bg-input/60 px-1.5 text-xs font-medium whitespace-nowrap text-foreground [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
        className
      )}
      data-slot="faceted-badge"
      {...props}
    />
  );
}

interface FacetedContentProps
  extends React.ComponentProps<typeof PopoverContent>,
    Pick<
      React.ComponentProps<typeof Command>,
      "shouldFilter" | "filter" | "loop"
    > {}

function FacetedContent({
  className,
  children,
  shouldFilter,
  filter,
  loop,
  ...props
}: FacetedContentProps) {
  return (
    <PopoverContent
      align="start"
      className={cn(
        "w-50 origin-(--radix-popover-content-transform-origin) p-0",
        className
      )}
      data-slot="faceted-content"
      {...props}
    >
      <Command
        className="p-0.5"
        filter={filter}
        loop={loop}
        shouldFilter={shouldFilter}
      >
        {children}
      </Command>
    </PopoverContent>
  );
}

interface FacetedInputProps
  extends React.ComponentProps<typeof CommandPrimitive.Input> {
  variant?: "default" | "line";
}

function FacetedInput({
  variant = "default",
  className,
  ref,
  ...props
}: FacetedInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(ref, inputRef);

  React.useEffect(() => {
    const input = inputRef.current;
    const root = input?.closest("[cmdk-root]");
    if (!input || !root) return;

    // cmdk's own aria-activedescendant lags behind the highlighted item.
    const onSync = () => {
      const id = root.querySelector("[cmdk-item][aria-selected='true']")?.id;
      if (!id) {
        input.removeAttribute("aria-activedescendant");
        return;
      }
      if (input.getAttribute("aria-activedescendant") !== id) {
        input.setAttribute("aria-activedescendant", id);
      }
    };

    onSync();
    const observer = new MutationObserver(onSync);
    observer.observe(root, {
      attributeFilter: ["aria-selected", "aria-activedescendant"],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  if (variant === "line") {
    return (
      <div
        className="-mx-0.5 -mt-0.5 mb-0.5 flex h-9 items-center gap-2 border-b px-3.5"
        data-slot="faceted-input-wrapper"
        data-variant="line"
      >
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <CommandPrimitive.Input
          className={cn(
            "h-full w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          data-slot="faceted-input"
          ref={composedRef}
          {...props}
        />
      </div>
    );
  }

  return (
    <CommandInput
      className={className}
      data-slot="faceted-input"
      ref={composedRef}
      {...props}
    />
  );
}

function FacetedList({ ...props }: React.ComponentProps<typeof CommandList>) {
  return <CommandList data-slot="faceted-list" {...props} />;
}

function FacetedEmpty({ ...props }: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty data-slot="faceted-empty" {...props} />;
}

function FacetedLoading({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Loading>) {
  return (
    <CommandPrimitive.Loading
      className={cn(
        "py-6 text-center text-sm text-muted-foreground",
        className
      )}
      data-slot="faceted-loading"
      {...props}
    />
  );
}

function FacetedGroup({ ...props }: React.ComponentProps<typeof CommandGroup>) {
  return <CommandGroup data-slot="faceted-group" {...props} />;
}

function FacetedCommandItem({
  className,
  onPointerDownCapture,
  onMouseDown,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground group/command-item",
        className
      )}
      onMouseDown={composeEventHandlers(onMouseDown, (event) => {
        // iOS Safari can emit a synthetic mousedown without a pointerdown.
        event.preventDefault();
      })}
      onPointerDownCapture={composeEventHandlers(
        onPointerDownCapture,
        (event) => {
          // A focusable item steals the input on pointerdown.
          event.preventDefault();
          if (event.pointerType === "touch") return;
          event.currentTarget
            .closest("[cmdk-root]")
            ?.querySelector<HTMLInputElement>("[cmdk-input]")
            ?.focus();
        }
      )}
      {...props}
    />
  );
}

interface FacetedItemProps
  extends React.ComponentProps<typeof CommandPrimitive.Item> {
  value: string;
}

function FacetedItem({ value, onSelect, ...props }: FacetedItemProps) {
  const store = useFacetedStore("FacetedItem");
  const isSelected = useFacetedStoreSelector(store, (state) =>
    getIsValueSelected(state.value, state.multiple, value)
  );

  return (
    <FacetedCommandItem
      aria-checked={isSelected}
      data-checked={isSelected || undefined}
      data-slot="faceted-item"
      onSelect={() => {
        if (onSelect) {
          onSelect(value);
          return;
        }
        store.selectItem(value);
      }}
      {...props}
    />
  );
}

function FacetedItemIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto grid place-items-center *:col-start-1 *:row-start-1",
        className
      )}
      data-slot="faceted-item-indicator"
      {...props}
    >
      {children != null && (
        <span className="font-mono text-xs group-data-checked/command-item:invisible">
          {children}
        </span>
      )}
      <Check className="invisible group-data-checked/command-item:visible" />
    </span>
  );
}

function FacetedClear({
  className,
  children = "Clear",
  onSelect,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  const store = useFacetedStore("FacetedClear");
  const hasSelection = useFacetedStoreSelector(
    store,
    (state) => getSelectedValues(state.value).length > 0
  );

  if (!hasSelection) return null;

  return (
    <>
      <FacetedSeparator />
      <FacetedGroup>
        <FacetedCommandItem
          className={cn("justify-center text-center", className)}
          data-slot="faceted-clear"
          onSelect={(value) => {
            onSelect?.(value);
            store.clear();
          }}
          {...props}
        >
          {children}
        </FacetedCommandItem>
      </FacetedGroup>
    </>
  );
}

function FacetedSeparator({
  ...props
}: React.ComponentProps<typeof CommandSeparator>) {
  return (
    <CommandSeparator
      aria-hidden="true"
      className="mx-0 my-0.5 w-full"
      data-slot="faceted-separator"
      {...props}
    />
  );
}

export {
  Faceted,
  FacetedBadge,
  FacetedBadgeList,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedLoading,
  FacetedSeparator,
  FacetedTrigger,
  FacetedValue,
};
