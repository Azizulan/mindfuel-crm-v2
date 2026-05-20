
export interface ApiCredentials {
  apiKey: string;
  secretKey: string;
}

export interface OrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note: string;
}

export interface OrderSuccessResponse {
  consignment: {
    consignment_id: string;
    tracking_code: string;
  };
}

export interface TrackingStatusResponse {
  delivery_status: string;
}

export interface ApiErrorResponse {
  message: string;
  errors?: { [key: string]: string[] };
}

export interface Order {
    consignment_id: number;
    invoice: string;
    tracking_code: string;
    recipient_name: string;
    recipient_phone: string;
    cod_amount: number;
    status: string;
    created_at: string;
}

export interface OrdersResponse {
    data: Order[];
}

export interface FollowUpNote {
  _id?: string;
  date: Date;
  feedback: 'Positive' | 'Happy' | 'Neutral' | 'Angry' | 'Not Interested' | 'Call Back Later' | 'Call Not Received';
  notes?: string;
  agent: string;
  reminderDate?: Date;
  reminderStatus?: 'pending' | 'completed';
}

export interface Purchase {
  _id?: string;
  date: Date;
  product: string;
  amount: number;
}

export interface Customer {
  id: number | string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  lastPurchaseDate: Date;
  purchases: Purchase[];
  purchaseCount: number;
  totalSpending: number;
  valueRating: 'High' | 'Medium' | 'Low';
  purchaseHistory: string; 
  followUpNotes?: FollowUpNote[];
}

export interface Product {
  id: number | string;
  name: string;
  price: number;
  stock: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Administrator' | 'Sales Executive';
  status: 'Pending' | 'Active' | 'Blocked';
  shiftStart: number;
  shiftEnd: number;
}

export interface TrendData {
    period: string;
    [key: string]: string | number;
}

export interface HourlyStats {
    hour: number;
    count: number;
}

export interface AgentActivity {
    agentName: string;
    startHour: number;
    shiftStart: number;
    shiftEnd: number;
    hourlyBreakdown: HourlyStats[];
    totalToday: number;
    isCurrentlyLow: boolean;
}

export interface MonthlyPerformance {
    month: string; // "YYYY-MM"
    orderCount: number;
    earnings: number;
}

export interface ExecutivePerformance {
    agentName: string;
    history: MonthlyPerformance[];
}

export interface DashboardStats {
  totalCustomers: number;
  repeatBuyers: number;
  followUpCount: number;
  totalOutreachCount: number;
  totalOrderCount: number;
  segmentTrend: {
      monthly: TrendData[];
      yearly: TrendData[];
  };
  valueTrend: {
      monthly: TrendData[];
      yearly: TrendData[];
  };
  valueDistribution: {
    High: number;
    Medium: number;
    Low: number;
  };
  bestSellers: Array<{ name: string, count: number }>;
  revenueData: Array<{ date: string, count: number }>;
  leaderboard: Array<{ name: string, count: number }>;
  teamActivity?: AgentActivity[];
  agentPerformance?: {
      monthlyConversions: number;
      outreachToday: number;
      outreachThisHour: number;
      isCurrentlyLow: boolean;
  };
  recentActivity?: Array<{
      customerName: string;
      customerId: string;
      feedback: string;
      agent: string;
      date: Date;
  }>;
}

export interface AuditLogEntry {
    customerName: string;
    customerId: string;
    feedback: string;
    notes: string;
    agent: string;
    date: Date;
}