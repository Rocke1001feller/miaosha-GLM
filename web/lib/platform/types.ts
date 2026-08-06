/**
 * Platform-agnostic seckill contracts.
 *
 * Only the types actually consumed by the live code (bigmodel adapter,
 * bm-capture content script, popup entry grid) are kept here.
 */

// =============================================================================
// SECTION 1: Identity & Platform Entries
// =============================================================================

export type PlatformId = 'bigmodel' | 'volcengine' | string;

export interface PlatformEntryInfo {
  id: PlatformId;
  displayName: string;
  hostPatterns: string[];
  entryUrl: string;
  /** Render as the big hero card in the popup grid; others render compact sub-rows. */
  hero?: boolean;
}

// =============================================================================
// SECTION 2: Domain Models
// =============================================================================

export type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

/** Normalized, platform-agnostic product description. */
export interface Product {
  id: string;
  name: string;
  billingPeriod: BillingPeriod;
  /** Monthly-equivalent price for sorting/display. */
  price: number;
  /** Amount payable in this purchase. */
  currentAmount: number;
  /** Renewal/second-year amount if known. */
  renewAmount: number;
  originalPrice?: number;
  soldOut: boolean;
  tag?: string;
  description?: string;
  /** Platform-specific payload; consumers must treat it as opaque. */
  raw: unknown;
}

export interface ProductCatalog {
  platform: PlatformId;
  updatedAt: number;
  groups: Record<BillingPeriod, Product[]>;
}

export interface PlatformAuth {
  platform: PlatformId;
  capturedAt: number;
  /** Request headers required to call platform APIs. */
  headers: Record<string, string>;
  /** Platform-specific extras (cookies, csrf, customerId, etc.). */
  metadata?: Record<string, unknown>;
}

export interface Ticket {
  ticket: string;
  randstr?: string;
  provider: string;
  createdAt: number;
}

export interface OrderContext {
  platform: PlatformId;
  productId: string;
  ticket?: Ticket;
  payType?: string;
}

export interface PaymentSession {
  platform: PlatformId;
  productId: string;
  amount: number;
  currency: string;
  /** Platform-specific payment handle. */
  bizId?: string;
  payUrl?: string;
  orderId?: string;
  qrCode?: string;
  raw: unknown;
}

export interface AuthSignals {
  ok: boolean;
  source: 'live-page' | 'cache' | 'none';
  ageMs?: number;
  tokenSuffix?: string;
  userDisplay?: string;
}

// =============================================================================
// SECTION 3: Workflow Contracts
// =============================================================================

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

/** Platform-specific authentication capture. */
export interface IAuthProbe {
  isAuthenticated(auth?: PlatformAuth | null): Promise<boolean>;
  capture(): Promise<PlatformAuth | null>;
  getSignals(auth: PlatformAuth | null): AuthSignals;
}

/**
 * The order pipeline is a black box from the core's perspective.
 * Bigmodel does preview in one call; Volcengine does preorder → order → pay.
 * The caller only sees the resulting PaymentSession.
 */
export interface IOrderPipeline {
  run(ctx: OrderContext, auth: PlatformAuth): Promise<OperationResult<PaymentSession>>;
}
