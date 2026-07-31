export type DiscoveryActionState = {
  ok: boolean;
  message: string;
  reference?: string;
  data?: Record<string, unknown>;
};

export const initialDiscoveryActionState: DiscoveryActionState = {
  ok: false,
  message: "",
};