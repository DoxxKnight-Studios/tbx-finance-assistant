import { useEffect, useState } from "react";
import { checkApiHealth } from "@/lib/api";

export type ApiHealthState = "checking" | "online" | "offline";

const POLL_INTERVAL_MS = 30_000;

export function useApiHealth(): ApiHealthState {
  const [state, setState] = useState<ApiHealthState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const healthy = await checkApiHealth();
      if (!cancelled) setState(healthy ? "online" : "offline");
    }

    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return state;
}
