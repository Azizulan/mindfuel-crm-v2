import { ApiCredentials, OrderPayload, OrderSuccessResponse, TrackingStatusResponse, ApiErrorResponse, Order, OrdersResponse } from "../types";

const BASE_URL = 'https://portal.packzy.com/api/v1';
const CREDENTIALS_KEY = 'packzyApiCredentials';

// --- Credentials Management ---

export const saveApiCredentials = (credentials: ApiCredentials) => {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
};

export const getApiCredentials = (): ApiCredentials | null => {
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    return stored ? JSON.parse(stored) : null;
};

// --- API Helper ---

const getHeaders = () => {
    const creds = getApiCredentials();
    if (!creds || !creds.apiKey || !creds.secretKey) {
        throw new Error("API credentials are not set. Please configure them in Settings.");
    }
    return {
        'Api-Key': creds.apiKey,
        'Secret-Key': creds.secretKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
};

const handleApiResponse = async (response: Response) => {
    const data = await response.json();
    if (!response.ok) {
        const errorData = data as ApiErrorResponse;
        let errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        if (errorData.errors) {
           errorMessage += ' ' + Object.values(errorData.errors).flat().join(' ');
        }
        throw new Error(errorMessage);
    }
    return data;
};

// --- API Functions ---

export const createOrder = async (payload: OrderPayload): Promise<OrderSuccessResponse> => {
    const response = await fetch(`${BASE_URL}/create_order`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
    });
    return handleApiResponse(response);
};

export const getTrackingStatus = async (idType: 'consignment_id' | 'invoice' | 'tracking_code', idValue: string): Promise<TrackingStatusResponse> => {
    let endpoint = '';
    switch (idType) {
        case 'consignment_id':
            endpoint = `/status_by_cid/${idValue}`;
            break;
        case 'invoice':
            endpoint = `/status_by_invoice/${idValue}`;
            break;
        case 'tracking_code':
            endpoint = `/status_by_trackingcode/${idValue}`;
            break;
        default:
            throw new Error('Invalid tracking ID type.');
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: getHeaders(),
    });

    return handleApiResponse(response);
};


export const getOrders = async (): Promise<OrdersResponse> => {
    const response = await fetch(`${BASE_URL}/get_orders`, {
        method: 'GET',
        headers: getHeaders(),
    });
    return handleApiResponse(response);
};