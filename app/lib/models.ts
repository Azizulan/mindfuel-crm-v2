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
  // Last 10 digits of `phone` — uniquely identifies a Bangladesh mobile.
  // Indexed so lookups (Steadfast sync, dedupe, customer search) are O(log n).
  normalizedPhone: { type: String, index: true, default: '' },
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

  // ─── RFM segmentation (Tier 1.6) ────────────────────────────────────────────
  // Recency / Frequency / Monetary scores (each 1-5; R also has 0 = never).
  // rfmSegment is the actionable label; rfmAction is the recommended next step.
  rScore:     { type: Number, default: 0, min: 0, max: 5 },
  fScore:     { type: Number, default: 1, min: 1, max: 5 },
  mScore:     { type: Number, default: 1, min: 1, max: 5 },
  rfmSegment: { type: String, default: 'Outreach Only', index: true },
  rfmAction:  { type: String, default: '' },

  // ─── Optimal call time (Tier 1.4) ───────────────────────────────────────────
  // Best 4-hour window for reaching this customer, derived from their call
  // history. Hours are in CRM_TIMEZONE (default: Asia/Dhaka).
  bestCallHourStart:  { type: Number, default: null },  // 0-23 inclusive
  bestCallHourEnd:    { type: Number, default: null },  // 0-23 exclusive
  bestPickupRate:     { type: Number, default: 0 },     // 0-1
  bestCallConfidence: { type: String, default: 'none', enum: ['none', 'low', 'medium', 'high'] },
  bestCallSummary:    { type: String, default: '' },

  // ─── Best-next-product recommendation (Tier 1.3) ────────────────────────────
  // Looked up from global ProductAssociation rules based on what THIS customer
  // has already bought. Cached on the customer doc so the queue endpoint
  // doesn't re-mine on every request.
  recommendedProduct:        { type: String, default: null },
  recommendedProductReason:  { type: String, default: null },
  recommendedProductLift:    { type: Number, default: 0 },
});

// Auto-sync normalizedPhone whenever phone changes on .save() (Tier 3.12).
// Note: this hook does NOT run for updateOne / bulkWrite / findOneAndUpdate —
// those code paths set normalizedPhone explicitly.
CustomerSchema.pre('save', function (next) {
  if (this.isModified('phone') || !this.normalizedPhone) {
    const digits = String(this.phone || '').replace(/\D/g, '');
    this.normalizedPhone = digits.length >= 10 ? digits.slice(-10) : digits;
  }
  next();
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

// ─── Product association rules (Tier 1.3) ──────────────────────────────────
// One document per directed product pair (A → B) where customers who bought
// A also bought B more often than chance. Mined by /api/admin/recompute-reorder
// from the global customer purchase history.
//
// confidence = P(B|A) — of customers who bought A, what fraction also bought B
// lift       = confidence(A→B) / P(B) — >1 means positive association
// support    = pairCount / totalCustomers
const ProductAssociationSchema = new mongoose.Schema(
  {
    source:      { type: String, required: true, index: true },
    target:      { type: String, required: true },
    pairCount:   { type: Number, required: true },
    sourceCount: { type: Number, required: true },
    support:     { type: Number, required: true },
    confidence:  { type: Number, required: true, index: true },
    lift:        { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

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
  normalizedPhone: string;
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
  rScore: 0 | 1 | 2 | 3 | 4 | 5;
  fScore: 1 | 2 | 3 | 4 | 5;
  mScore: 1 | 2 | 3 | 4 | 5;
  rfmSegment: string;
  rfmAction: string;
  bestCallHourStart: number | null;
  bestCallHourEnd: number | null;
  bestPickupRate: number;
  bestCallConfidence: 'none' | 'low' | 'medium' | 'high';
  bestCallSummary: string;
  recommendedProduct: string | null;
  recommendedProductReason: string | null;
  recommendedProductLift: number;
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

export const ProductAssociation =
  (mongoose.models.ProductAssociation || mongoose.model('ProductAssociation', ProductAssociationSchema)) as mongoose.Model<any>;
