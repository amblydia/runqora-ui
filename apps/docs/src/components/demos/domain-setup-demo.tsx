"use client";

import { useState } from "react";
import {
  createDemoDomains,
  demoPendingDomain,
} from "@/components/demos/demo-domains";
import { DomainSetup } from "@/components/domains/domain-setup";

export function DomainSetupDemo() {
  const [source] = useState(createDemoDomains);
  const [domain, setDomain] = useState(demoPendingDomain);
  return (
    <DomainSetup
      className="w-full"
      domain={domain}
      onChange={setDomain}
      onCheck={(options) =>
        source.checkDomain?.(domain.id, options) ??
        Promise.resolve({ error: "Checks aren't available.", ok: false })
      }
    />
  );
}
