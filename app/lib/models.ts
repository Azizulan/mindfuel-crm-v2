import mongoose, { type Document, type Model } from 'mongoose';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const FollowUpNoteSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  feedback: { type: String, required: true },
  notes: { type: String },
  agent: { type: String, required: true },
  reminderDate: { type: Date },
  reminderStatus: { type: String, default: 'pending', enum: ['pending', 'completed'] },
});

const PurchaseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  product: { type: String, required: true },
  amount: { type: Number, required: true },
  steadfastId: { type: String },
});

const CustomerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  email: { type: String, index: true },
  phone: { type: String, required: true, index: true },
  address: { type: String },
  lastPurchaseDate: { type: Date, index: true },
  purchases: [PurchaseSchema],
  purchaseCount: { type: Number, default: 0 },
  totalSpending: { type: Number, default: 0 },
  valueRating: { type: String, index: true },
  purchaseHistory: { type: String },
  followUpNotes: [FollowUpNoteSchema],
  suppressedUntil: { type: Date, default: null, index: true },
  suppressionReason: { type: String, default: null },

  // ─── Per-customer reorder cycle (Tier 1.1) ─────────────────────────────────
  // Computed from the median gap between this customer's purchases.
  predictedReorderDays: { type: Number, default: null },
  nextOutreachDate:     { type: Date,   default: null, index: true },
  reorderConfidence:    { type: String, default: 'none', enum: ['none', 'low', 'medium', 'high'] },
});

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
});

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Sales Executive', enum: ['Administrator', 'Sales Executive'] },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Active', 'Blocked'] },
    shiftStart: { type: Number, default: 10 },
    shiftEnd: { type: Number, default: 21 },
  },
  { timestamps: true }
);

const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
});

const LocalOrderSchema = new mongoose.Schema(
  {
    invoice: { type: String, required: true, unique: true },
    recipient_name: { type: String, required: true },
    recipient_phone: { type: String, required: true },
    recipient_address: { type: String, required: true },
    cod_amount: { type: Number, required: true },
    note: { type: String },
    status: { type: String, default: 'pending_approval', enum: ['pending_approval', 'sent_to_courier'] },
    items: [{ name: String, price: Number, quantity: Number }],
    agent: { type: String, required: true },
  },
  { timestamps: true }
);

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'Administrator' | 'Sales Executive';
  status: 'Pending' | 'Active' | 'Blocked';
  shiftStart: number;
  shiftEnd: number;
}

export interface ICustomer extends Document {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  lastPurchaseDate: Date;
  purchases: mongoose.Types.DocumentArray<any>;
  purchaseCount: number;
  totalSpending: number;
  valueRating: string;
  purchaseHistory: string;
  followUpNotes: mongoose.Types.DocumentArray<any>;
  suppressedUntil: Date | null;
  suppressionReason: string | null;
  predictedReorderDays: number | null;
  nextOutreachDate: Date | null;
  reorderConfidence: 'none' | 'low' | 'medium' | 'high';
}

// ─── Model exports (safe re-registration for Next.js hot-reload) ──────────────

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

export const Customer: Model<ICustomer> =
  (mongoose.models.Customer as Model<ICustomer>) || mongoose.model<ICustomer>('Customer', CustomerSchema);

export const ProductModel =
  (mongoose.models.Product || mongoose.model('Product', ProductSchema)) as mongoose.Model<any>;

export const Setting =
  (mongoose.models.Setting || mongoose.model('Setting', SettingSchema)) as mongoose.Model<{ key: string; value: any }>;

export const LocalOrder =
  (mongoose.models.LocalOrder || mongoose.model('LocalOrder', LocalOrderSchema)) as mongoose.Model<any>;
