import type { ComponentProps } from "react";

export function Logo(props: ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 640 665"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M0 0H410A210 210 0 0 1 432 419L640 665H453L120 278H385A64 64 0 0 0 385 150H0Z" />
      <path d="M0 330L285 665H100L0 543Z" />
    </svg>
  );
}
