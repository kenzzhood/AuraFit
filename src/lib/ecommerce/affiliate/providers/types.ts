export type AffiliateLinkInput = {
  destination: string;
  source: string;
  trackingId: string;
};

export interface AffiliateProvider {
  readonly name: string;
  isConfigured(): boolean;
  buildUrl(input: AffiliateLinkInput): string;
}
