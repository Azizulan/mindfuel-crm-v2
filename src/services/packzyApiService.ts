import { OrderPayload, OrderSuccessResponse, TrackingStatusResponse, OrdersResponse } from "../types";

// Tier 7.28 — all Steadfast/Packzy traffic now goes through our own server
// proxies (/api/courier/*). The browser NEVER holds the API keys; they live
// encrypted server-side and are injected by the proxy routes. This file used
// to call portal.packzy.com directly with keys from localStorage — that is
// gone.

const API_BASE = '/api';

async function proxyRequest(endpoint: string, method: string = 'GET', body: any = null) {
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Request failed (HTTP ${response.status})`);
  return data;
}

// --- Credentials (server-side, status only) ---

export interface CredentialStatus {
  configured: boolean;
  apiKeyPreview: string;
  secretKeyPreview: string;
}

export const getCredentialStatus = (): Promise<CredentialStatus> =>
  proxyRequest('/settings/steadfast-credentials');

export const saveApiCredentials = (creds: { apiKey: string; secretKey: string }): Promise<{ configured: boolean }> =>
  proxyRequest('/settings/steadfast-credentials', 'POST', creds);

// --- API functions (proxied) ---

export const createOrder = (payload: OrderPayload): Promise<OrderSuccessResponse> =>
  proxyRequest('/courier/create-order', 'POST', payload);

export const getTrackingStatus = (
  idType: 'consignment_id' | 'invoice' | 'tracking_code',
  idValue: string
): Promise<TrackingStatusResponse> =>
  proxyRequest('/courier/track', 'POST', { idType, idValue });

export const getOrders = (): Promise<OrdersResponse> =>
  proxyRequest('/courier/orders');
