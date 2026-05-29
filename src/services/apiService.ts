
import { User, Customer, FollowUpNote, DashboardStats, Product, AuditLogEntry, ExecutivePerformance } from '../types';

const API_BASE_URL = '/api';

const apiRequest = async (endpoint: string, method: string = 'GET', body: any = null) => {
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'API Error');
    return data;
};

export const login = (email: string, password: string): Promise<User> => apiRequest('/login', 'POST', { email, password });
export const register = (name: string, email: string, password: string): Promise<User> => apiRequest('/register', 'POST', { name, email, password });
export const getUsers = (): Promise<User[]> => apiRequest('/users');
export const updateUser = (userId: string, updates: Partial<User>): Promise<User> => apiRequest(`/users/${userId}`, 'PATCH', updates);
export const updateUserStatus = (userId: string, status: User['status']): Promise<User> => apiRequest(`/users/${userId}`, 'PATCH', { status });

export const getCustomers = (
    search: string = '',
    page: number = 1,
    limit: number = 10,
    sortField: string = 'lastPurchaseDate',
    sortOrder: 'asc' | 'desc' = 'desc'
): Promise<{data: Customer[], total: number, page: number, totalPages: number}> => {
    const params = new URLSearchParams({
        search,
        page: String(page),
        limit: String(limit),
        sortField,
        sortOrder
    });
    return apiRequest(`/customers?${params.toString()}`);
};

export const updateCustomer = (customerId: string | number, updates: Partial<Customer>): Promise<Customer> =>
    apiRequest(`/customers/${customerId}`, 'PUT', updates);

export const deleteCustomer = (customerId: string | number): Promise<{ message: string }> =>
    apiRequest(`/customers/${customerId}`, 'DELETE');

export const bulkDeleteCustomers = (ids: string[]): Promise<{ message: string }> =>
    apiRequest('/customers/bulk-delete', 'POST', { ids });

export const bulkUpdateCustomersDate = (ids: string[], date: string): Promise<{ message: string }> =>
    apiRequest('/customers/bulk-update-date', 'POST', { ids, date });

export const clearDatabase = (password: string, adminEmail: string): Promise<{ message: string }> =>
    apiRequest('/customers/clear-database', 'POST', { password, adminEmail });

export const getFollowUpCustomers = (
    search: string = '',
    page: number = 1,
    limit: number = 10,
    tab: string = 'pending',
    sortField: string = 'lastPurchaseDate',
    sortOrder: 'asc' | 'desc' = 'desc',
    outreachStart?: number,
    outreachEnd?: number
): Promise<{
    data: Customer[],
    total: number,
    page: number,
    totalPages: number,
    counts: { pending: number, ordered: number, callLater: number, noAnswer: number, notInterested: number, all: number }
}> => {
    const params = new URLSearchParams({
        search,
        page: String(page),
        limit: String(limit),
        tab,
        sortField,
        sortOrder
    });
    if (outreachStart !== undefined) params.append('outreachStart', String(outreachStart));
    if (outreachEnd !== undefined) params.append('outreachEnd', String(outreachEnd));

    return apiRequest(`/customers/followup?${params.toString()}`);
};

export const getStats = (agent?: string, activityDate?: string): Promise<DashboardStats> => {
    const params = new URLSearchParams();
    if (agent) params.append('agent', agent);
    if (activityDate) params.append('activityDate', activityDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/stats${query}`);
};

export const getExecutivePerformance = (startDate?: string, endDate?: string): Promise<ExecutivePerformance[]> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/admin/executive-performance${query}`);
};

export interface AgentCoachingStat {
    agent: string;
    totalCalls: number;
    happy: number; positive: number; neutral: number;
    callBackLater: number; noAnswer: number; notInterested: number; angry: number;
    contacted: number; orders: number; revenue: number;
    contactRate: number; positiveRate: number; negativeRate: number;
    conversionRate: number; revenuePerCall: number;
    flags: string[];
}
export const getAgentCoaching = (startDate?: string, endDate?: string): Promise<{
    agents: AgentCoachingStat[];
    teamAverages: { conversionRate: number; positiveRate: number; negativeRate: number; revenuePerCall: number };
}> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/admin/agent-coaching${query}`);
};

export const getAuditLog = (search: string = '', page: number = 1, limit: number = 20): Promise<{data: AuditLogEntry[], total: number, page: number, totalPages: number}> => {
    const params = new URLSearchParams({ search, page: String(page), limit: String(limit) });
    return apiRequest(`/audit-log?${params.toString()}`);
};

export const addFollowUpNote = (customerId: string | number, note: FollowUpNote): Promise<Customer> =>
    apiRequest(`/customers/${customerId}/followup`, 'POST', note);

export const markReminderAsDone = (customerId: string | number, noteId: string): Promise<Customer> =>
    apiRequest(`/customers/${customerId}/followup/${noteId}/complete`, 'PATCH');

export const updatePurchaseDate = (customerId: string | number, purchaseId: string, date: string): Promise<Customer> =>
    apiRequest(`/customers/${customerId}/purchase/${purchaseId}/date`, 'PATCH', { date });

export const getProducts = (): Promise<Product[]> => apiRequest('/products');
export const addProduct = (product: Omit<Product, 'id'>): Promise<Product> => apiRequest('/products', 'POST', product);
export const deleteProduct = (id: string | number): Promise<{ message: string }> => apiRequest(`/products/${id}`, 'DELETE');

export const getLocalOrders = (): Promise<any[]> => apiRequest('/orders/local');
export const saveLocalOrder = (order: any): Promise<any> => apiRequest('/orders/local', 'POST', order);
export const deleteLocalOrder = (id: string): Promise<{ message: string }> => apiRequest(`/orders/local/${id}`, 'DELETE');
export const markLocalOrderAsSent = (id: string): Promise<any> => apiRequest(`/orders/local/${id}/sent`, 'PATCH');
export const getLatestOrderByPhone = (phone: string): Promise<any> => apiRequest(`/orders/latest/${phone}`);

export const uploadCustomers = async (data: Customer[], onProgress: (current: number, total: number) => void): Promise<{ message: string }> => {
    const batchSize = 100;
    const total = Math.ceil(data.length / batchSize);
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        await apiRequest('/upload-customers', 'POST', batch);
        onProgress(Math.floor(i / batchSize) + 1, total);
    }
    return { message: 'Upload and synchronization complete.' };
};

export const getOutreachTarget = (): Promise<{ value: number }> => apiRequest('/settings/outreach-target');
export const setOutreachTarget = (value: number): Promise<any> => apiRequest('/settings/outreach-target', 'POST', { value });
export const getOutreachRange = (): Promise<{ start: number, end: number }> => apiRequest('/settings/outreach-range');
export const setOutreachRange = (start: number, end: number): Promise<any> => apiRequest('/settings/outreach-range', 'POST', { start, end });
export const getRepeatOnlyMode = (): Promise<{ value: boolean }> => apiRequest('/settings/repeat-only');
export const setRepeatOnlyMode = (value: boolean): Promise<any> => apiRequest('/settings/repeat-only', 'POST', { value });

export const getValueOnlyMode = (): Promise<{ value: boolean }> => apiRequest('/settings/value-only');
export const setValueOnlyMode = (value: boolean): Promise<any> => apiRequest('/settings/value-only', 'POST', { value });
export const getMinOrderValue = (): Promise<{ value: number }> => apiRequest('/settings/min-order-value');
export const setMinOrderValue = (value: number): Promise<any> => apiRequest('/settings/min-order-value', 'POST', { value });

export const getGmtOffset = (): Promise<{ value: number }> => apiRequest('/settings/gmt-offset');
export const setGmtOffset = (value: number): Promise<any> => apiRequest('/settings/gmt-offset', 'POST', { value });

export const getCallQueue = (agentId: string, size: number = 50): Promise<any> => {
    const params = new URLSearchParams({ agentId, size: String(size) });
    return apiRequest(`/queue/today?${params.toString()}`);
};

export interface WinBackCustomer {
    id: string; name: string; phone: string;
    rfmSegment: string; rfmAction: string;
    totalSpending: number; purchaseCount: number;
    daysSinceLastOrder: number | null; predictedReorderDays: number | null; daysOverCycle: number | null;
    lastSentiment: string | null; lastContactDays: number | null;
    recommendedProduct: string | null; recommendedProductReason: string | null;
    bestCallSummary: string; valueAtRisk: number; lastProduct: string | null;
}
export const getWinBackQueue = (size: number = 50): Promise<{
    customers: WinBackCustomer[]; count: number; cantLoseCount: number; totalValueAtRisk: number; generatedAt: string;
}> => apiRequest(`/queue/winback?size=${size}`);

export const getSuppressedCustomers = (page: number = 1, limit: number = 20): Promise<any> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return apiRequest(`/admin/suppressed?${params.toString()}`);
};

export const liftSuppression = (customerId: string): Promise<any> =>
    apiRequest(`/customers/${customerId}/suppression`, 'DELETE');

export const getDashboardToday = (): Promise<any> => apiRequest('/dashboard/today');
export const getDashboardMonth = (): Promise<any> => apiRequest('/dashboard/month');
export const getDashboardAllTime = (): Promise<any> => apiRequest('/dashboard/alltime');

// Tier 7.28: credentials are read server-side; the client no longer passes keys.
export const syncSteadfast = (
    startDate?: string,
    endDate?: string,
): Promise<{
    message: string;
    synced: number;
    newCustomers: number;
    alreadySynced: number;
    paymentsProcessed: number;
    errors: string[];
}> => apiRequest('/sync/steadfast', 'POST', { startDate, endDate });

// ─── RFM segment focus + admin maintenance (Tier 1.6 / 1.4 / 3.12) ──────────

export const getSegmentDistribution = (): Promise<Record<string, number>> =>
    apiRequest('/stats/segment-distribution');

export const getQueueFocusSegments = (): Promise<{ value: string[] }> =>
    apiRequest('/settings/queue-focus-segments');

export const setQueueFocusSegments = (value: string[]): Promise<{ value: string[] }> =>
    apiRequest('/settings/queue-focus-segments', 'POST', { value });

export const recomputeCustomerStats = (): Promise<{
    message: string;
    processed: number;
    withCycle: number;
    withCallTime: number;
    withRec: number;
    associationCount: number;
    segmentDistribution: Record<string, number>;
    topAssociations: Array<{ source: string; target: string; pairCount: number; confidence: number; lift: number }>;
    conversionModel?: { overallRate: number; avgOrderValue: number; ratesBySegment: Record<string, number>; sampleCalls: number };
}> => apiRequest('/admin/recompute-reorder', 'POST');

export const normalizePhones = (): Promise<{
    message: string;
    processed: number;
    updated: number;
    invalid: number;
    duplicateGroupCount: number;
    duplicates: any[];
}> => apiRequest('/admin/normalize-phones', 'POST');
