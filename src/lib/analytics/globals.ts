export type MixpanelClient = {
  init?: (token: string, opts?: Record<string, unknown>) => void;
  track?: (event: string, props?: Record<string, unknown>) => void;
  opt_out_tracking?: () => void;
  opt_in_tracking?: () => void;
};

export type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
    clarity?: (...args: unknown[]) => void;
    mixpanel?: MixpanelClient;
  }
}

export {};
