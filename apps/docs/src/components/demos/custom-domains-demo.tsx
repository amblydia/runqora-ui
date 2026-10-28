"use client";

import { useState } from "react";
import { createDemoDomains } from "@/components/demos/demo-domains";
import { CustomDomains } from "@/components/domains/custom-domains";

export function CustomDomainsDemo() {
  // One set of domains per page view, so the source keeps the same identity.
  const [source] = useState(createDemoDomains);
  return <CustomDomains source={source} />;
}
