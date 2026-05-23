import 'dotenv/config';
import express, { NextFunction } from 'express';
import mongoose, { type Document, type Model } from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5001;
const isProd = process.env.NODE_ENV === 'production';

// ─── Queue scoring ────────────────────────────────────────────────────────────

interface ScoringNote { date: Date | string; feedback: string; agent: string; reminderDate?: Date | string | null; }
interface ScoringCustomer { id: string; name: string; phone: string; totalSpending: number; purchaseCount: number; lastPurchaseDate?: Date | string | null; followUpNotes?: ScoringNote[]; }
interface ScoringResult { score: number; reason: string; suppressed: boolean; suppressionReason?: string; }

const _daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);
const _toDate = (v: Date | string | null | undefined): Date | null => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const _isToday = (d: Date, now: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
const _ltvPts = (s: number) => s >= 10000 ? 100 : s >= 5000 ? 80 : s >= 3000 ? 60 : s >= 1000 ? 40 : s > 0 ? 20 : 5;
const _freqPts = (n: number) => n >= 5 ? 80 : n >= 3 ? 60 : n === 2 ? 40 : n === 1 ? 20 : 5;
const _recencyPts = (d: number | null) => d === null ? 0 : d >= 31 && d <= 60 ? 50 : d >= 61 && d <= 90 ? 40 : d >= 0 && d <= 30 ? 20 : d <= 180 ? 15 : 5;
const _callPenalty = (d: number | null) => d === null ? 0 : d < 1 ? 80 : d <= 2 ? 40 : d <= 7 ? 15 : d <= 14 ? 5 : 0;
const _sentimentMod = (f: string | null, rd: Date | null, now: Date) => { if (!f) return 0; if (f === 'Call Back Later') return (rd && rd <= now) ? 25 : 5; return f === 'Happy' ? 15 : f === 'Positive' ? 10 : f === 'Neutral' ? 0 : f === 'Call Not Received' ? -5 : f === 'Not Interested' ? -25 : f === 'Angry' ? -40 : 0; };
const _buildReason = (purchaseCount: number, daysSinceOrder: number | null, daysSinceLastCall: number | null, latestFeedback: string | null, reminderDate: Date | null, now: Date): string => {
    if (latestFeedback === 'Call Back Later' && reminderDate && reminderDate <= now) return 'Overdue callback reminder';
    if (latestFeedback === 'Happy' || latestFeedback === 'Positive') return `Warm lead (${latestFeedback})${daysSinceOrder !== null ? `, ${daysSinceOrder}d since last order` : ''}`;
    const seg = purchaseCount >= 5 ? 'VIP' : purchaseCount >= 3 ? 'Loyal customer' : purchaseCount === 2 ? 'Repeat buyer' : purchaseCount === 1 ? 'One-time buyer' : 'No orders yet';
    if (daysSinceOrder === null) return `${seg} — no order history`;
    if (daysSinceOrder >= 31 && daysSinceOrder <= 60) return `${seg}, ${daysSinceOrder}d since last order — prime reorder window`;
    if (daysSinceOrder > 90) return `${seg}, dormant ${daysSinceOrder}d`;
    if (daysSinceLastCall !== null && daysSinceLastCall <= 7) return `${seg}, called ${daysSinceLastCall}d ago`;
    return `${seg}, ${daysSinceOrder}d since last order`;
};
function scoreCustomer(customer: ScoringCustomer, agentName: string, now: Date = new Date()): ScoringResult {
    const notes = customer.followUpNotes ?? [];
    const sorted = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0] ?? null;
    if (latest?.feedback === 'Angry') return { score: 0, reason: '', suppressed: true, suppressionReason: 'Angry' };
    const cut60 = new Date(now); cut60.setDate(now.getDate() - 60);
    if (notes.filter(n => n.feedback === 'Not Interested' && new Date(n.date) >= cut60).length >= 2) return { score: 0, reason: '', suppressed: true, suppressionReason: 'Not Interested ×2 in 60 days' };
    const cut14 = new Date(now); cut14.setDate(now.getDate() - 14);
    if (notes.filter(n => n.feedback === 'Call Not Received' && new Date(n.date) >= cut14).length >= 3) return { score: 0, reason: '', suppressed: true, suppressionReason: 'Unreachable (3× no answer in 14 days)' };
    const latestFeedback = latest?.feedback ?? null;
    const reminderDate = _toDate(latest?.reminderDate);
    if (latestFeedback === 'Call Back Later' && reminderDate && reminderDate > now) return { score: 0, reason: '', suppressed: true, suppressionReason: `Callback scheduled for ${reminderDate.toLocaleDateString()}` };
    const lastOrderDate = _toDate(customer.lastPurchaseDate);
    const daysSinceOrder = lastOrderDate ? _daysBetween(lastOrderDate, now) : null;
    const lastCallDate = sorted.length > 0 ? _toDate(sorted[0].date) : null;
    const daysSinceLastCall = lastCallDate ? _daysBetween(lastCallDate, now) : null;
    const exclusivityPenalty = notes.some(n => _isToday(new Date(n.date), now) && n.agent !== agentName) ? 60 : 0;
    const score = _ltvPts(customer.totalSpending) + _freqPts(customer.purchaseCount) + _recencyPts(daysSinceOrder) - _callPenalty(daysSinceLastCall) + _sentimentMod(latestFeedback, reminderDate, now) - exclusivityPenalty;
    return { score, reason: _buildReason(customer.purchaseCount, daysSinceOrder, daysSinceLastCall, latestFeedback, reminderDate, now), suppressed: false };
}

// ─── Express setup ────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── MongoDB ──────────────────────────────────────────────────────────────────

let isConnected = false;
async function connectToDatabase() {
    if (isConnected) return;
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set. Add it to your .env file.');
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    await seedAdminUser();
}

const FollowUpNoteSchema = new mongoose.Schema({ date: { type: Date, default: Date.now }, feedback: { type: String, required: true }, notes: { type: String }, agent: { type: String, required: true }, reminderDate: { type: Date }, reminderStatus: { type: String, default: 'pending', enum: ['pending', 'completed'] } });
const PurchaseSchema = new mongoose.Schema({ date: { type: Date, required: true }, product: { type: String, required: true }, amount: { type: Number, required: true } });
const CustomerSchema = new mongoose.Schema({ id: { type: String, required: true, unique: true, index: true }, name: { type: String, required: true, index: true }, email: { type: String, index: true }, phone: { type: String, required: true, index: true }, address: { type: String }, lastPurchaseDate: { type: Date, index: true }, purchases: [PurchaseSchema], purchaseCount: { type: Number, default: 0 }, totalSpending: { type: Number, default: 0 }, valueRating: { type: String, index: true }, purchaseHistory: { type: String }, followUpNotes: [FollowUpNoteSchema], suppressedUntil: { type: Date, default: null, index: true }, suppressionReason: { type: String, default: null } });
const ProductSchema = new mongoose.Schema({ name: { type: String, required: true }, price: { type: Number, required: true }, stock: { type: Number, default: 0 } });
const UserSchema = new mongoose.Schema({ name: { type: String, required: true }, email: { type: String, required: true, unique: true }, password: { type: String, required: true }, role: { type: String, default: 'Sales Executive', enum: ['Administrator', 'Sales Executive'] }, status: { type: String, default: 'Pending', enum: ['Pending', 'Active', 'Blocked'] }, shiftStart: { type: Number, default: 10 }, shiftEnd: { type: Number, default: 21 } }, { timestamps: true });
const SettingSchema = new mongoose.Schema({ key: { type: String, required: true, unique: true }, value: { type: mongoose.Schema.Types.Mixed, required: true } });
const LocalOrderSchema = new mongoose.Schema({ invoice: { type: String, required: true, unique: true }, recipient_name: { type: String, required: true }, recipient_phone: { type: String, required: true }, recipient_address: { type: String, required: true }, cod_amount: { type: Number, required: true }, note: { type: String }, status: { type: String, default: 'pending_approval', enum: ['pending_approval', 'sent_to_courier'] }, items: [{ name: String, price: Number, quantity: Number }], agent: { type: String, required: true } }, { timestamps: true });

interface IUser extends Document { name: string; email: string; password: string; role: 'Administrator' | 'Sales Executive'; status: 'Pending' | 'Active' | 'Blocked'; shiftStart: number; shiftEnd: number; }
interface ICustomer extends Document { id: string; name: string; email: string; phone: string; address?: string; lastPurchaseDate: Date; purchases: mongoose.Types.DocumentArray<any>; purchaseCount: number; totalSpending: number; valueRating: string; purchaseHistory: string; followUpNotes: mongoose.Types.DocumentArray<any>; suppressedUntil: Date | null; suppressionReason: string | null; }

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
const Customer: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
const LocalOrder = mongoose.models.LocalOrder || mongoose.model('LocalOrder', LocalOrderSchema);

const seedAdminUser = async () => { try { const adminEmail = 'azizulhakimzen@gmail.com'; if (!await User.findOne({ email: adminEmail })) { const hp = await bcrypt.hash('Uniqpa5$word11177', 10); await new User({ name: 'Admin', email: adminEmail, password: hp, role: 'Administrator', status: 'Active', shiftStart: 9, shiftEnd: 22 }).save(); } } catch (e) { console.error(e); } };
const mapToId = (doc: any) => { if (!doc) return doc; const obj = doc.toObject ? doc.toObject() : { ...doc }; if (obj._id) obj.id = obj._id.toString(); return obj; };
const formatUserResponse = (u: any) => { const o = mapToId(u); delete o.password; return o; };
const handleRequest = (handler: (req: any, res: any) => Promise<any>) => async (req: any, res: any, next: NextFunction) => { try { await connectToDatabase(); return await handler(req, res); } catch (err: any) { console.error(err); return res.status(500).json({ message: err.message || 'Server error' }); } };
const recalculateCustomerStats = (c: ICustomer) => { const p = c.purchases; if (!p || p.length === 0) { c.purchaseCount = 0; c.totalSpending = 0; c.valueRating = 'Low'; c.purchaseHistory = ''; return; } const s = [...p].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); c.lastPurchaseDate = s[0].date; c.purchaseCount = p.length; c.totalSpending = p.reduce((sum, x) => sum + (Number(x.amount) || 0), 0); c.valueRating = c.totalSpending >= 3000 ? 'High' : c.totalSpending >= 1000 ? 'Medium' : 'Low'; c.purchaseHistory = [...new Set(p.map(x => x.product))].join(', '); };

// ─── Routes ───────────────────────────────────────────────────────────────────

app.post('/api/register', handleRequest(async (req, res) => { const { name, email, password } = req.body; if (await User.findOne({ email })) return res.status(409).json({ message: 'Exists' }); const hp = await bcrypt.hash(password, 10); return res.status(201).json(formatUserResponse(await new User({ name: name || email, email, password: hp, role: 'Sales Executive' }).save())); }));
app.post('/api/login', handleRequest(async (req, res) => { const { email, password } = req.body; const user = await User.findOne({ email }); if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Invalid' }); if (user.status !== 'Active') return res.status(403).json({ message: 'Account status: ' + user.status }); return res.json(formatUserResponse(user)); }));

app.get('/api/customers', handleRequest(async (req, res) => {
    const { search, page = 1, limit = 10, sortField = 'lastPurchaseDate', sortOrder = 'desc' } = req.query;
    const query: any = {};
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const skip = (Number(page) - 1) * Number(limit);
    const orderNum = sortOrder === 'asc' ? 1 : -1;
    if (sortField === 'health' || sortField === 'lastInteractionDate') {
        const pipeline: any[] = [{ $match: query }];
        if (sortField === 'health') { pipeline.push({ $addFields: { issueCount: { $add: [{ $cond: [{ $or: [{ $eq: ["$name", "Unknown"] }, { $not: ["$name"] }] }, 1, 0] }, { $cond: [{ $not: ["$lastPurchaseDate"] }, 1, 0] }, { $cond: [{ $lt: [{ $size: { $ifNull: ["$purchases", []] } }, 1] }, 1, 0] }, { $cond: [{ $lt: [{ $strLenCP: { $ifNull: ["$phone", ""] } }, 10] }, 1, 0] }, { $cond: [{ $eq: ["$lastPurchaseDate", new Date(0)] }, 1, 0] }] } } }); pipeline.push({ $sort: { issueCount: orderNum as 1 | -1, name: 1 } }); }
        else { pipeline.push({ $addFields: { sortInteractionDate: { $ifNull: [{ $max: "$followUpNotes.date" }, new Date(0)] } } }); pipeline.push({ $sort: { sortInteractionDate: orderNum as 1 | -1 } }); }
        pipeline.push({ $skip: skip }, { $limit: Number(limit) });
        return res.json({ data: await Customer.aggregate(pipeline), total: await Customer.countDocuments(query), page: Number(page), totalPages: Math.ceil(await Customer.countDocuments(query) / Number(limit)) });
    }
    const customers = await Customer.find(query).sort({ [sortField as string]: orderNum }).skip(skip).limit(Number(limit));
    const total = await Customer.countDocuments(query);
    return res.json({ data: customers, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

app.put('/api/customers/:id', handleRequest(async (req, res) => { const c = await Customer.findOne({ id: req.params.id }); if (!c) return res.status(404).json({ message: 'Not found' }); const u = req.body; if (u.name) c.name = u.name; if (u.phone) c.phone = u.phone; if (u.email) c.email = u.email; if (u.address) c.address = u.address; if (u.purchases) c.purchases = u.purchases.map((p: any) => ({ ...p, date: new Date(p.date) })) as any; recalculateCustomerStats(c); await c.save(); return res.json(c); }));
app.delete('/api/customers/:id', handleRequest(async (req, res) => { const r = await Customer.deleteOne({ id: req.params.id }); if (r.deletedCount === 0) return res.status(404).json({ message: 'Not found' }); return res.json({ message: 'Deleted' }); }));
app.post('/api/customers/bulk-delete', handleRequest(async (req, res) => { const { ids } = req.body; if (!Array.isArray(ids)) return res.status(400).json({ message: 'Invalid' }); const r = await Customer.deleteMany({ id: { $in: ids } }); return res.json({ message: `${r.deletedCount} records deleted.` }); }));
app.post('/api/customers/bulk-update-date', handleRequest(async (req, res) => { const { ids, date } = req.body; if (!Array.isArray(ids) || !date) return res.status(400).json({ message: 'Invalid' }); const nd = new Date(date); const customers = await Customer.find({ id: { $in: ids } }); for (const c of customers) { c.lastPurchaseDate = nd; if (c.purchases?.length > 0) { c.purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); c.purchases[0].date = nd; } await c.save(); } return res.json({ message: `Updated ${customers.length} records.` }); }));
app.post('/api/customers/clear-database', handleRequest(async (req, res) => { const { password, adminEmail } = req.body; const admin = await User.findOne({ email: adminEmail, role: 'Administrator' }); if (!admin || !await bcrypt.compare(password, admin.password)) return res.status(401).json({ message: 'Invalid administrator password.' }); await Customer.deleteMany({ followUpNotes: { $size: 0 } }); await Customer.updateMany({ followUpNotes: { $exists: true, $not: { $size: 0 } } }, { $set: { purchases: [], purchaseCount: 0, totalSpending: 0, lastPurchaseDate: null, purchaseHistory: '', valueRating: 'Low' } }); return res.json({ message: 'Database cleared.' }); }));

app.post('/api/customers/:customerId/followup', handleRequest(async (req, res) => {
    const c = await Customer.findOne({ id: req.params.customerId });
    if (!c) return res.status(404).json({ message: 'Not found' });
    const note = req.body;
    if (note.reminderDate) note.reminderStatus = 'pending';
    c.followUpNotes.push(note);
    const now = new Date(); const fb = note.feedback;
    if (fb === 'Angry') { const u = new Date(now); u.setDate(u.getDate() + 180); c.suppressedUntil = u; c.suppressionReason = 'Angry'; }
    else if (fb === 'Not Interested') { const cut = new Date(now); cut.setDate(now.getDate() - 60); if (c.followUpNotes.filter((n: any) => n.feedback === 'Not Interested' && new Date(n.date) >= cut).length >= 2) { const u = new Date(now); u.setDate(u.getDate() + 90); c.suppressedUntil = u; c.suppressionReason = 'Not Interested ×2 in 60 days'; } }
    else if (fb === 'Call Not Received') { const cut = new Date(now); cut.setDate(now.getDate() - 14); if (c.followUpNotes.filter((n: any) => n.feedback === 'Call Not Received' && new Date(n.date) >= cut).length >= 3) { const u = new Date(now); u.setDate(u.getDate() + 30); c.suppressedUntil = u; c.suppressionReason = 'Unreachable — 3× no answer in 14 days'; } }
    else if (fb === 'Call Back Later' && note.reminderDate) { const rd = new Date(note.reminderDate); if (rd > now) { c.suppressedUntil = rd; c.suppressionReason = `Callback scheduled for ${rd.toLocaleDateString()}`; } }
    await c.save(); return res.json(c);
}));
app.delete('/api/customers/:customerId/suppression', handleRequest(async (req, res) => { const c = await Customer.findOne({ id: req.params.customerId }); if (!c) return res.status(404).json({ message: 'Not found' }); c.suppressedUntil = null; c.suppressionReason = null; await c.save(); return res.json({ message: 'Suppression lifted' }); }));
app.patch('/api/customers/:customerId/followup/:noteId/complete', handleRequest(async (req, res) => { const c = await Customer.findOne({ id: req.params.customerId }); if (!c) return res.status(404).json({ message: 'Not found' }); const n = c.followUpNotes.id(req.params.noteId); if (n) { n.reminderStatus = 'completed'; await c.save(); } return res.json(c); }));
app.patch('/api/customers/:customerId/purchase/:purchaseId/date', handleRequest(async (req, res) => { const c = await Customer.findOne({ id: req.params.customerId }); if (!c) return res.status(404).json({ message: 'Not found' }); const p = c.purchases.id(req.params.purchaseId); if (p) { p.date = new Date(req.body.date); recalculateCustomerStats(c); await c.save(); } return res.json(c); }));

app.post('/api/upload-customers', handleRequest(async (req, res) => {
    const data = req.body;
    if (!Array.isArray(data) || data.length === 0) return res.status(400).json({ message: 'No records.' });
    const ops = data.map((cust: any) => { const purchases = (cust.purchases || []).map((p: any) => ({ ...p, date: new Date(p.date) })); let lpd = new Date(cust.lastPurchaseDate); if (isNaN(lpd.getTime())) lpd = new Date(); const ts = purchases.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0); return { updateOne: { filter: { phone: String(cust.phone).trim() }, update: { $set: { id: String(cust.phone).trim(), name: String(cust.name || 'Unknown').trim(), email: String(cust.email || '').trim(), address: String(cust.address || '').trim(), purchases, lastPurchaseDate: lpd, totalSpending: ts, valueRating: ts >= 3000 ? 'High' : ts >= 1000 ? 'Medium' : 'Low', purchaseCount: purchases.length } }, upsert: true } }; });
    await Customer.bulkWrite(ops);
    return res.status(201).json({ message: `${ops.length} records synchronized.` });
}));

app.get('/api/users', handleRequest(async (req, res) => res.json((await User.find({})).map(formatUserResponse))));
app.patch('/api/users/:userId', handleRequest(async (req, res) => { const u = await User.findById(req.params.userId); if (!u) return res.status(404).json({ message: 'Not found' }); if (req.body.status) u.status = req.body.status; if (req.body.shiftStart !== undefined) u.shiftStart = Number(req.body.shiftStart); if (req.body.shiftEnd !== undefined) u.shiftEnd = Number(req.body.shiftEnd); await u.save(); return res.json(formatUserResponse(u)); }));

app.get('/api/products', handleRequest(async (req, res) => res.json((await ProductModel.find({})).map(mapToId))));
app.post('/api/products', handleRequest(async (req, res) => { const p = new ProductModel(req.body); await p.save(); return res.status(201).json(mapToId(p)); }));
app.delete('/api/products/:id', handleRequest(async (req, res) => { await ProductModel.findByIdAndDelete(req.params.id); return res.json({ message: 'Deleted' }); }));

app.get('/api/orders/local', handleRequest(async (req, res) => res.json(await LocalOrder.find({ status: 'pending_approval' }).sort({ createdAt: -1 }))));
app.post('/api/orders/local', handleRequest(async (req, res) => res.status(201).json(await new LocalOrder(req.body).save())));
app.delete('/api/orders/local/:id', handleRequest(async (req, res) => { await LocalOrder.findByIdAndDelete(req.params.id); return res.json({ message: 'Removed' }); }));
app.patch('/api/orders/local/:id/sent', handleRequest(async (req, res) => { const o = await LocalOrder.findById(req.params.id); if (o) { o.status = 'sent_to_courier'; await o.save(); } return res.json(o); }));
app.get('/api/orders/latest/:phone', handleRequest(async (req, res) => { const o = await LocalOrder.findOne({ recipient_phone: req.params.phone }).sort({ createdAt: -1 }); if (!o) return res.status(404).json({ message: 'No orders found' }); return res.json(o); }));

app.get('/api/settings/outreach-target', handleRequest(async (req, res) => { const t = await Setting.findOne({ key: 'outreach_target' }); return res.json({ value: t ? t.value : 100 }); }));
app.post('/api/settings/outreach-target', handleRequest(async (req, res) => { await Setting.findOneAndUpdate({ key: 'outreach_target' }, { value: Number(req.body.value) }, { upsert: true }); return res.json({ message: 'Updated' }); }));
app.get('/api/settings/outreach-range', handleRequest(async (req, res) => { const s = await Setting.findOne({ key: 'outreach_range_start' }); const e = await Setting.findOne({ key: 'outreach_range_end' }); return res.json({ start: s ? Number(s.value) : 32, end: e ? Number(e.value) : 28 }); }));
app.post('/api/settings/outreach-range', handleRequest(async (req, res) => { await Setting.findOneAndUpdate({ key: 'outreach_range_start' }, { value: Number(req.body.start) }, { upsert: true }); await Setting.findOneAndUpdate({ key: 'outreach_range_end' }, { value: Number(req.body.end) }, { upsert: true }); return res.json({ message: 'Updated' }); }));
app.get('/api/settings/repeat-only', handleRequest(async (req, res) => { const m = await Setting.findOne({ key: 'repeat_only_mode' }); return res.json({ value: m ? !!m.value : false }); }));
app.post('/api/settings/repeat-only', handleRequest(async (req, res) => { await Setting.findOneAndUpdate({ key: 'repeat_only_mode' }, { value: !!req.body.value }, { upsert: true }); return res.json({ message: 'Updated' }); }));
app.get('/api/settings/value-only', handleRequest(async (req, res) => { const m = await Setting.findOne({ key: 'value_only_mode' }); return res.json({ value: m ? !!m.value : false }); }));
app.post('/api/settings/value-only', handleRequest(async (req, res) => { await Setting.findOneAndUpdate({ key: 'value_only_mode' }, { value: !!req.body.value }, { upsert: true }); return res.json({ message: 'Updated' }); }));
app.get('/api/settings/min-order-value', handleRequest(async (req, res) => { const v = await Setting.findOne({ key: 'min_order_value' }); return res.json({ value: v ? Number(v.value) : 0 }); }));
app.post('/api/settings/min-order-value', handleRequest(async (req, res) => { await Setting.findOneAndUpdate({ key: 'min_order_value' }, { value: Number(req.body.value) }, { upsert: true }); return res.json({ message: 'Updated' }); }));
app.get('/api/settings/gmt-offset', handleRequest(async (req, res) => { const v = await Setting.findOne({ key: 'gmt_offset' }); return res.json({ value: v ? Number(v.value) : 6 }); }));
app.post('/api/settings/gmt-offset', handleRequest(async (req, res) => { await Setting.findOneAndUpdate({ key: 'gmt_offset' }, { value: Number(req.body.value) }, { upsert: true }); return res.json({ message: 'Updated' }); }));

app.get('/api/admin/suppressed', handleRequest(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const now = new Date();

    // Backfill: find customers whose notes qualify for suppression but suppressedUntil not yet set
    const unsuppressed = await Customer.find({
        $or: [{ suppressedUntil: null }, { suppressedUntil: { $lte: now } }],
        'followUpNotes.0': { $exists: true }
    }).select('id followUpNotes').lean();

    const cut60 = new Date(now); cut60.setDate(now.getDate() - 60);
    const cut14 = new Date(now); cut14.setDate(now.getDate() - 14);
    const bulkOps: any[] = [];

    for (const c of unsuppressed) {
        const notes = (c.followUpNotes || []) as any[];
        const sorted = [...notes].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latest = sorted[0];
        let until: Date | null = null; let reason = '';
        if (latest?.feedback === 'Angry') {
            until = new Date(now); until.setDate(until.getDate() + 180); reason = 'Angry';
        } else if (notes.filter((n: any) => n.feedback === 'Not Interested' && new Date(n.date) >= cut60).length >= 2) {
            until = new Date(now); until.setDate(until.getDate() + 90); reason = 'Not Interested ×2 in 60 days';
        } else if (notes.filter((n: any) => n.feedback === 'Call Not Received' && new Date(n.date) >= cut14).length >= 3) {
            until = new Date(now); until.setDate(until.getDate() + 30); reason = 'Unreachable — 3× no answer in 14 days';
        } else if (latest?.feedback === 'Call Back Later' && latest?.reminderDate && new Date(latest.reminderDate) > now) {
            until = new Date(latest.reminderDate); reason = `Callback scheduled for ${until.toLocaleDateString()}`;
        }
        if (until) bulkOps.push({ updateOne: { filter: { id: c.id }, update: { $set: { suppressedUntil: until, suppressionReason: reason } } } });
    }
    if (bulkOps.length > 0) await Customer.bulkWrite(bulkOps);

    const skip = (Number(page) - 1) * Number(limit);
    const query = { suppressedUntil: { $gt: now } };
    const [data, total] = await Promise.all([Customer.find(query).select('id name phone suppressedUntil suppressionReason totalSpending purchaseCount').sort({ suppressedUntil: 1 }).skip(skip).limit(Number(limit)).lean(), Customer.countDocuments(query)]);
    return res.json({ data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

app.get('/api/admin/executive-performance', handleRequest(async (req, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const outreachDateFilter: any = {};
    if (startDate) outreachDateFilter.$gte = new Date(startDate);
    if (endDate)   outreachDateFilter.$lte = new Date(endDate);
    const outreachMatch: any = { 'followUpNotes.feedback': { $ne: 'Call Not Received' } };
    if (Object.keys(outreachDateFilter).length) outreachMatch['followUpNotes.date'] = outreachDateFilter;

    const salesDateFilter: any = {};
    if (startDate) salesDateFilter.$gte = new Date(startDate);
    if (endDate)   salesDateFilter.$lte = new Date(endDate);
    const salesMatchArr: any[] = [];
    if (Object.keys(salesDateFilter).length) salesMatchArr.push({ $match: { createdAt: salesDateFilter } });
    salesMatchArr.push({ $match: { agent: { $exists: true, $ne: null } } });

    const [outreach, sales] = await Promise.all([
        Customer.aggregate([
            { $unwind: '$followUpNotes' },
            { $match: outreachMatch },
            { $group: { _id: { agent: '$followUpNotes.agent', month: { $dateToString: { format: '%Y-%m', date: '$followUpNotes.date' } } }, outreachCount: { $sum: 1 } } }
        ]),
        LocalOrder.aggregate([
            ...salesMatchArr,
            { $group: { _id: { agent: '$agent', month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } }, totalOrders: { $sum: 1 } } }
        ])
    ]);
    const map: Record<string, Record<string, any>> = {};
    outreach.forEach(({ _id: { agent, month }, outreachCount }) => { if (!agent) return; if (!map[agent]) map[agent] = {}; if (!map[agent][month]) map[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 }; map[agent][month].outreachCount = outreachCount; });
    sales.forEach(({ _id: { agent, month }, totalOrders }) => { if (!agent) return; if (!map[agent]) map[agent] = {}; if (!map[agent][month]) map[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 }; map[agent][month].orderCount = totalOrders; map[agent][month].earnings = totalOrders * 7; });
    // Sort by total orders descending so top performers appear first
    return res.json(Object.keys(map).map(a => {
        const history = Object.values(map[a]).sort((x, y) => y.month.localeCompare(x.month));
        const totalOrders = history.reduce((s, r) => s + (r.orderCount || 0), 0);
        return { agentName: a, history, totalOrders };
    }).sort((a, b) => b.totalOrders - a.totalOrders).map(({ agentName, history }) => ({ agentName, history })));
}));

app.get('/api/audit-log', handleRequest(async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline: any[] = [{ $unwind: '$followUpNotes' }];
    if (search) pipeline.push({ $match: { $or: [{ name: { $regex: search, $options: 'i' } }, { 'followUpNotes.agent': { $regex: search, $options: 'i' } }, { 'followUpNotes.notes': { $regex: search, $options: 'i' } }] } });
    const total = (await Customer.aggregate([...pipeline, { $count: 'total' }]))[0]?.total || 0;
    pipeline.push({ $sort: { 'followUpNotes.date': -1 } }, { $skip: skip }, { $limit: Number(limit) }, { $project: { customerName: '$name', customerId: '$id', feedback: '$followUpNotes.feedback', notes: '$followUpNotes.notes', agent: '$followUpNotes.agent', date: '$followUpNotes.date', _id: 0 } });
    return res.json({ data: await Customer.aggregate(pipeline), total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

app.get('/api/customers/followup', handleRequest(async (req, res) => {
    const { search, page = 1, limit = 10, tab = 'pending', sortField = 'lastPurchaseDate', sortOrder = 'desc', outreachStart, outreachEnd } = req.query;
    const [rsRes, reRes, roRes, voRes, mvRes] = await Promise.all([Setting.findOne({ key: 'outreach_range_start' }), Setting.findOne({ key: 'outreach_range_end' }), Setting.findOne({ key: 'repeat_only_mode' }), Setting.findOne({ key: 'value_only_mode' }), Setting.findOne({ key: 'min_order_value' })]);
    const gs = rsRes ? Number(rsRes.value) : 32; const ge = reRes ? Number(reRes.value) : 28;
    const rs = outreachStart ? Number(outreachStart) : gs; const re = outreachEnd ? Number(outreachEnd) : ge;
    const now = new Date();
    const bMin = new Date(); bMin.setDate(now.getDate() - gs); bMin.setHours(0,0,0,0);
    const bMax = new Date(); bMax.setDate(now.getDate() - ge); bMax.setHours(23,59,59,999);
    const nMin = new Date(); nMin.setDate(now.getDate() - rs); nMin.setHours(0,0,0,0);
    const nMax = new Date(); nMax.setDate(now.getDate() - re); nMax.setHours(23,59,59,999);
    const t10 = new Date(); t10.setDate(now.getDate() - 10); t10.setHours(0,0,0,0);
    const q: any = { $or: [{ lastPurchaseDate: { $gte: bMin, $lte: bMax } }, { 'followUpNotes.date': { $gte: t10 } }] };
    if (roRes?.value) q.purchaseCount = { $gt: 1 };
    if (voRes?.value) q.totalSpending = { $gte: mvRes ? Number(mvRes.value) : 0 };
    if (search) q.$or = [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
    const candidates = await Customer.find(q).lean();
    const orders = await LocalOrder.find({ createdAt: { $gte: t10 } }).select('recipient_phone createdAt').lean();
    const segs: Record<string, any[]> = { pending: [], ordered: [], callLater: [], noAnswer: [], notInterested: [], all: [] };
    candidates.forEach(c => {
        const lpt = c.lastPurchaseDate ? new Date(c.lastPurchaseDate).getTime() : 0;
        const recentNotes = (c.followUpNotes || []).filter((n: any) => new Date(n.date).getTime() >= t10.getTime());
        const hasRecentNote = recentNotes.length > 0;
        if (hasRecentNote) segs.all.push(c);
        const inB = lpt >= bMin.getTime() && lpt <= bMax.getTime();
        const inN = lpt >= nMin.getTime() && lpt <= nMax.getTime();
        if (inB) {
            // Standard outreach-window customers — classify by purchase date + notes after last purchase
            if (orders.some(o => o.recipient_phone === c.phone && new Date(o.createdAt).getTime() > lpt)) { if (inN) segs.ordered.push(c); }
            else {
                const ln = [...(c.followUpNotes || []).filter((n: any) => new Date(n.date).getTime() > lpt)].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                if (ln?.feedback === 'Call Back Later') segs.callLater.push(c);
                else if (inN) { if (!ln) segs.pending.push(c); else if (ln.feedback === 'Call Not Received') segs.noAnswer.push(c); else segs.notInterested.push(c); }
            }
        } else if (hasRecentNote) {
            // Call-queue customers (outside purchase window) — classify by latest recent note
            const ln = [...recentNotes].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            if (orders.some(o => o.recipient_phone === c.phone && new Date(o.createdAt).getTime() >= t10.getTime())) {
                segs.ordered.push(c);
            } else if (ln.feedback === 'Call Back Later') {
                segs.callLater.push(c);
            } else if (ln.feedback === 'Call Not Received') {
                segs.noAnswer.push(c);
            } else if (ln.feedback === 'Not Interested' || ln.feedback === 'Angry') {
                segs.notInterested.push(c);
            }
            // Happy / Positive / Neutral → warm leads; visible in "all" tab only
        }
    });
    const list = segs[tab as string] || segs.pending;
    const sn = sortOrder === 'asc' ? 1 : -1;
    list.sort((a: any, b: any) => { let va = sortField === 'lastInteractionDate' ? Math.max(...((a.followUpNotes || []).map((n: any) => new Date(n.date).getTime())), 0) : (a[sortField as string] instanceof Date ? a[sortField as string].getTime() : a[sortField as string] ?? 0); let vb = sortField === 'lastInteractionDate' ? Math.max(...((b.followUpNotes || []).map((n: any) => new Date(n.date).getTime())), 0) : (b[sortField as string] instanceof Date ? b[sortField as string].getTime() : b[sortField as string] ?? 0); return va < vb ? -sn : va > vb ? sn : 0; });
    const skip = (Number(page) - 1) * Number(limit);
    return res.json({ data: list.slice(skip, skip + Number(limit)), total: list.length, page: Number(page), totalPages: Math.ceil(list.length / Number(limit)), counts: { pending: segs.pending.length, ordered: segs.ordered.length, callLater: segs.callLater.length, noAnswer: segs.noAnswer.length, notInterested: segs.notInterested.length, all: segs.all.length } });
}));

app.get('/api/dashboard/today', handleRequest(async (req, res) => {
    const now = new Date();
    const gmtRes = await Setting.findOne({ key: 'gmt_offset' });
    const gmtOffset = gmtRes ? Number(gmtRes.value) : 6;
    const tzString = gmtOffset >= 0 ? `+${String(gmtOffset).padStart(2, '0')}:00` : `-${String(Math.abs(gmtOffset)).padStart(2, '0')}:00`;
    const offsetMs = gmtOffset * 3600000;
    const localDate = new Date(now.getTime() + offsetMs);
    const todayLocalMidnight = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate()));
    const todayStart = new Date(todayLocalMidnight.getTime() - offsetMs);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86400000);
    const threeDaysAgo = new Date(todayStart.getTime() - 3 * 86400000);
    const sevenDaysAgoAbs = new Date(now.getTime() - 7 * 86400000);

    const [sentimentAgg, yesterdayCallsAgg, last7DaysAgg, remindersDueToday, hotLeadsAgg, ordersTodayAgg, ordersYesterdayAgg, agentActivityAgg, angryVipsAgg, overdueRemindersCount] = await Promise.all([
        Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: todayStart } } }, { $group: { _id: '$followUpNotes.feedback', count: { $sum: 1 } } }]),
        Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: yesterdayStart, $lt: todayStart } } }, { $count: 'total' }]),
        Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: sevenDaysAgo } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$followUpNotes.date', timezone: tzString } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Customer.countDocuments({ followUpNotes: { $elemMatch: { reminderDate: { $lte: now }, reminderStatus: 'pending' } } }),
        Customer.aggregate([
            { $match: { 'followUpNotes.0': { $exists: true } } },
            { $addFields: { latestNote: { $arrayElemAt: ['$followUpNotes', -1] } } },
            { $match: { 'latestNote.feedback': { $in: ['Happy', 'Positive'] }, 'latestNote.date': { $lt: threeDaysAgo }, $expr: { $or: [{ $eq: ['$purchaseCount', 0] }, { $lt: ['$lastPurchaseDate', '$latestNote.date'] }] } } },
            { $count: 'total' }
        ]),
        LocalOrder.aggregate([{ $match: { createdAt: { $gte: todayStart }, status: 'sent_to_courier' } }, { $group: { _id: null, total: { $sum: '$cod_amount' } } }]),
        LocalOrder.aggregate([{ $match: { createdAt: { $gte: yesterdayStart, $lt: todayStart }, status: 'sent_to_courier' } }, { $group: { _id: null, total: { $sum: '$cod_amount' } } }]),
        Customer.aggregate([
            { $unwind: '$followUpNotes' },
            { $match: { 'followUpNotes.date': { $gte: todayStart } } },
            { $group: { _id: '$followUpNotes.agent', callsToday: { $sum: 1 }, callsLastHour: { $sum: { $cond: [{ $gte: ['$followUpNotes.date', oneHourAgo] }, 1, 0] } }, lastActivityAt: { $max: '$followUpNotes.date' }, happyCalls: { $sum: { $cond: [{ $in: ['$followUpNotes.feedback', ['Happy', 'Positive']] }, 1, 0] } } } }
        ]),
        Customer.aggregate([
            { $match: { purchaseCount: { $gte: 5 } } },
            { $addFields: { angryRecent: { $filter: { input: '$followUpNotes', as: 'n', cond: { $and: [{ $eq: ['$$n.feedback', 'Angry'] }, { $gte: ['$$n.date', sevenDaysAgoAbs] }] } } } } },
            { $match: { 'angryRecent.0': { $exists: true } } },
            { $count: 'total' }
        ]),
        Customer.countDocuments({ followUpNotes: { $elemMatch: { reminderDate: { $lt: todayStart }, reminderStatus: 'pending' } } })
    ]);

    const callsToday = (sentimentAgg as any[]).reduce((s, x) => s + x.count, 0);
    const callsYesterday = (yesterdayCallsAgg as any[])[0]?.total || 0;

    const last7Map: Record<string, number> = {};
    (last7DaysAgg as any[]).forEach(d => { last7Map[d._id] = d.count; });
    const callsLast7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo.getTime() + i * 86400000 + offsetMs);
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        return { date: dateStr, count: last7Map[dateStr] || 0 };
    });

    const SENTIMENTS = ['Happy', 'Positive', 'Neutral', 'Call Back Later', 'Call Not Received', 'Not Interested', 'Angry'];
    const sentMap: Record<string, number> = {};
    (sentimentAgg as any[]).forEach(s => { sentMap[s._id] = s.count; });
    const sentimentToday = SENTIMENTS.map(s => ({ sentiment: s, count: sentMap[s] || 0 })).filter(s => s.count > 0);

    const agentActivity = (agentActivityAgg as any[]).map(a => ({
        name: a._id,
        callsToday: a.callsToday,
        callsLastHour: a.callsLastHour,
        lastActivityAt: a.lastActivityAt,
        happyRateToday: a.callsToday > 0 ? parseFloat(((a.happyCalls / a.callsToday) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.callsToday - a.callsToday);

    const angryVipCount = (angryVipsAgg as any[])[0]?.total || 0;
    const hotLeadsCount = (hotLeadsAgg as any[])[0]?.total || 0;
    const actionItems: any[] = [];
    if (angryVipCount > 0) actionItems.push({ id: 'angry-vips', severity: 'critical', message: `${angryVipCount} VIP customer${angryVipCount > 1 ? 's' : ''} marked Angry this week — review notes`, cta: 'Review notes', ctaView: 'followUp' });
    if (overdueRemindersCount > 0) actionItems.push({ id: 'overdue-reminders', severity: 'warning', message: `${overdueRemindersCount} reminder${overdueRemindersCount > 1 ? 's' : ''} overdue — still pending`, cta: 'View reminders', ctaView: 'followUp' });
    if (hotLeadsCount > 0) actionItems.push({ id: 'hot-leads', severity: 'info', message: `${hotLeadsCount} warm lead${hotLeadsCount > 1 ? 's' : ''} haven't been followed up in 3+ days`, cta: 'Start queue', ctaView: 'callQueue' });
    if (callsToday === 0) actionItems.push({ id: 'no-calls', severity: 'warning', message: 'No calls logged yet today — queue not started', cta: 'Open queue', ctaView: 'callQueue' });

    return res.json({
        callsToday, callsYesterday, callsLast7Days,
        ordersTodayBDT: (ordersTodayAgg as any[])[0]?.total || 0,
        ordersYesterdayBDT: (ordersYesterdayAgg as any[])[0]?.total || 0,
        hotLeadsCount, remindersDueToday,
        agentActivity, sentimentToday, actionItems
    });
}));

app.get('/api/dashboard/month', handleRequest(async (req, res) => {
    const now = new Date();
    const gmtRes = await Setting.findOne({ key: 'gmt_offset' });
    const gmtOffset = gmtRes ? Number(gmtRes.value) : 6;
    const tzString = gmtOffset >= 0 ? `+${String(gmtOffset).padStart(2, '0')}:00` : `-${String(Math.abs(gmtOffset)).padStart(2, '0')}:00`;
    const offsetMs = gmtOffset * 3600000;
    const localDate = new Date(now.getTime() + offsetMs);
    const yr = localDate.getUTCFullYear(), mo = localDate.getUTCMonth();
    const dayOfMonth = localDate.getUTCDate();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const monthStart = new Date(Date.UTC(yr, mo, 1) - offsetMs);
    const nextMonthStart = new Date(Date.UTC(yr, mo + 1, 1) - offsetMs);
    const lastMonthStart = new Date(Date.UTC(yr, mo - 1, 1) - offsetMs);
    const lastMonthEnd = new Date(monthStart.getTime() - 1);
    const lastMonthDays = new Date(yr, mo, 0).getDate();
    const todayDateStr = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

    const [revTargetSetting, ordTargetSetting] = await Promise.all([
        Setting.findOne({ key: 'monthly_revenue_target' }),
        Setting.findOne({ key: 'monthly_orders_target' })
    ]);
    const revenueTarget = revTargetSetting ? Number(revTargetSetting.value) : 0;
    const ordersTarget = ordTargetSetting ? Number(ordTargetSetting.value) : 0;

    const [dailyRevAgg, dailyCallsAgg, dailyOrdAgg, newCustAgg, repeatCustAgg, sentThisAgg, sentLastAgg, segPerfAgg, lastMonthRevAgg, lastMonthOrdAgg] = await Promise.all([
        Customer.aggregate([{ $unwind: '$purchases' }, { $match: { 'purchases.date': { $gte: monthStart, $lt: nextMonthStart } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchases.date', timezone: tzString } }, revenue: { $sum: '$purchases.amount' } } }, { $sort: { _id: 1 } }]),
        Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: monthStart, $lt: nextMonthStart } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$followUpNotes.date', timezone: tzString } }, calls: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Customer.aggregate([{ $unwind: '$purchases' }, { $match: { 'purchases.date': { $gte: monthStart, $lt: nextMonthStart } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchases.date', timezone: tzString } }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Customer.aggregate([{ $match: { purchaseCount: { $gte: 1 } } }, { $addFields: { firstPurchase: { $min: { $map: { input: '$purchases', as: 'p', in: '$$p.date' } } } } }, { $match: { firstPurchase: { $gte: monthStart, $lt: nextMonthStart } } }, { $count: 'total' }]),
        Customer.aggregate([{ $match: { purchaseCount: { $gte: 2 } } }, { $addFields: { prevPurchases: { $size: { $filter: { input: '$purchases', as: 'p', cond: { $lt: ['$$p.date', monthStart] } } } }, thisPurchases: { $size: { $filter: { input: '$purchases', as: 'p', cond: { $and: [{ $gte: ['$$p.date', monthStart] }, { $lt: ['$$p.date', nextMonthStart] }] } } } } } }, { $match: { prevPurchases: { $gte: 1 }, thisPurchases: { $gte: 1 } } }, { $count: 'total' }]),
        Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: monthStart, $lt: nextMonthStart } } }, { $group: { _id: '$followUpNotes.feedback', count: { $sum: 1 } } }]),
        Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: lastMonthStart, $lte: lastMonthEnd } } }, { $group: { _id: '$followUpNotes.feedback', count: { $sum: 1 } } }]),
        Customer.aggregate([
            { $addFields: { segment: { $switch: { branches: [{ case: { $gte: ['$purchaseCount', 5] }, then: 'VIP' }, { case: { $gte: ['$purchaseCount', 3] }, then: 'Loyal' }, { case: { $eq: ['$purchaseCount', 2] }, then: 'Repeat' }, { case: { $eq: ['$purchaseCount', 1] }, then: 'OneTime' }], default: 'Outreach' } }, notesThisMonth: { $filter: { input: '$followUpNotes', as: 'n', cond: { $and: [{ $gte: ['$$n.date', monthStart] }, { $lt: ['$$n.date', nextMonthStart] }] } } }, purchasesThisMonth: { $filter: { input: '$purchases', as: 'p', cond: { $and: [{ $gte: ['$$p.date', monthStart] }, { $lt: ['$$p.date', nextMonthStart] }] } } } } },
            { $match: { 'notesThisMonth.0': { $exists: true } } },
            { $group: { _id: '$segment', customersCalled: { $sum: 1 }, totalNotes: { $sum: { $size: '$notesThisMonth' } }, happyNotes: { $sum: { $size: { $filter: { input: '$notesThisMonth', as: 'n', cond: { $in: ['$$n.feedback', ['Happy', 'Positive']] } } } } }, ordersThisMonth: { $sum: { $size: '$purchasesThisMonth' } }, revenueThisMonth: { $sum: { $reduce: { input: '$purchasesThisMonth', initialValue: 0, in: { $add: ['$$value', '$$this.amount'] } } } } } }
        ]),
        Customer.aggregate([{ $unwind: '$purchases' }, { $match: { 'purchases.date': { $gte: lastMonthStart, $lte: lastMonthEnd } } }, { $group: { _id: null, total: { $sum: '$purchases.amount' } } }]),
        Customer.aggregate([{ $unwind: '$purchases' }, { $match: { 'purchases.date': { $gte: lastMonthStart, $lte: lastMonthEnd } } }, { $count: 'total' }])
    ]);

    const revMap: Record<string, number> = {}, callsMap: Record<string, number> = {}, ordMap: Record<string, number> = {};
    (dailyRevAgg as any[]).forEach(d => { revMap[d._id] = d.revenue; });
    (dailyCallsAgg as any[]).forEach(d => { callsMap[d._id] = d.calls; });
    (dailyOrdAgg as any[]).forEach(d => { ordMap[d._id] = d.orders; });
    const dailyData = Array.from({ length: dayOfMonth }, (_, i) => {
        const d = i + 1;
        const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { day: d, date: ds, revenue: revMap[ds] || 0, calls: callsMap[ds] || 0, orders: ordMap[ds] || 0, isToday: ds === todayDateStr };
    });
    const revenueMTD = dailyData.reduce((s, d) => s + d.revenue, 0);
    const ordersMTD = dailyData.reduce((s, d) => s + d.orders, 0);

    const buildFunnel = (agg: any[]) => {
        const m: Record<string, number> = {};
        agg.forEach((a: any) => { m[a._id] = a.count; });
        const total = Object.values(m).reduce((s, v) => s + v, 0);
        const positive = (m['Happy'] || 0) + (m['Positive'] || 0);
        return { totalCalls: total, positiveCalls: positive, convRate: total > 0 ? parseFloat(((positive / total) * 100).toFixed(1)) : 0 };
    };

    const SEGS = ['VIP', 'Loyal', 'Repeat', 'OneTime', 'Outreach'];
    const segmentPerformance = SEGS.map(seg => {
        const d = (segPerfAgg as any[]).find((s: any) => s._id === seg);
        if (!d || d.customersCalled === 0) return null;
        return { segment: seg, customersCalled: d.customersCalled, happyRate: d.totalNotes > 0 ? parseFloat(((d.happyNotes / d.totalNotes) * 100).toFixed(1)) : 0, orderRate: d.customersCalled > 0 ? parseFloat(((d.ordersThisMonth / d.customersCalled) * 100).toFixed(1)) : 0, revenue: d.revenueThisMonth };
    }).filter(Boolean);

    const revLastMonth = (lastMonthRevAgg as any[])[0]?.total || 0;
    const ordLastMonth = (lastMonthOrdAgg as any[])[0]?.total || 0;
    const anomalies: any[] = [];
    if (revLastMonth > 0 && dayOfMonth >= 7) {
        const pace = revenueMTD / (revLastMonth * dayOfMonth / lastMonthDays);
        const changePct = Math.round((pace - 1) * 100);
        if (Math.abs(changePct) >= 25) anomalies.push({ id: 'rev-pace', severity: changePct < 0 ? 'warning' : 'info', message: `Revenue pace ${changePct > 0 ? '▲ ' + changePct + '% ahead of' : '▼ ' + Math.abs(changePct) + '% behind'} last month` });
    }
    if (ordLastMonth > 0 && dayOfMonth >= 7) {
        const pace = ordersMTD / (ordLastMonth * dayOfMonth / lastMonthDays);
        const changePct = Math.round((pace - 1) * 100);
        if (Math.abs(changePct) >= 25) anomalies.push({ id: 'ord-pace', severity: changePct < 0 ? 'warning' : 'info', message: `Order volume pace ${changePct > 0 ? '▲ ' + changePct + '% ahead of' : '▼ ' + Math.abs(changePct) + '% behind'} last month` });
    }
    const thisMonthFunnel = buildFunnel(sentThisAgg);
    const lastMonthFunnel = buildFunnel(sentLastAgg);
    if (lastMonthFunnel.convRate > 0 && thisMonthFunnel.totalCalls > 50) {
        const convDiff = thisMonthFunnel.convRate - lastMonthFunnel.convRate;
        if (Math.abs(convDiff) >= 5) anomalies.push({ id: 'conv-rate', severity: convDiff < 0 ? 'warning' : 'info', message: `Happy/Positive rate ${convDiff > 0 ? '▲ ' + convDiff.toFixed(1) + '% higher' : '▼ ' + Math.abs(convDiff).toFixed(1) + '% lower'} than last month` });
    }

    const monthLabel = new Date(yr, mo, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const lastMonthLabel = new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'short' });
    const currMonthLabel = new Date(yr, mo, 1).toLocaleString('default', { month: 'short' });

    return res.json({ monthLabel, dayOfMonth, daysInMonth, revenueMTD, revenueTarget, ordersMTD, ordersTarget, newCustomersMTD: (newCustAgg as any[])[0]?.total || 0, repeatCustomersMTD: (repeatCustAgg as any[])[0]?.total || 0, dailyData, sentimentFunnel: { current: { label: currMonthLabel, ...thisMonthFunnel }, previous: { label: lastMonthLabel, ...lastMonthFunnel } }, segmentPerformance, anomalies });
}));

app.get('/api/dashboard/alltime', handleRequest(async (req, res) => {
    const [totalCustomers, totalRevenueAgg, lifecycleCounts, cycleAgg, monthlyTrendAgg, topProductsAgg] = await Promise.all([
        Customer.countDocuments(),
        Customer.aggregate([{ $group: { _id: null, total: { $sum: '$totalSpending' } } }]),
        Promise.all([
            Customer.countDocuments({ purchaseCount: { $gte: 5 } }),
            Customer.countDocuments({ purchaseCount: { $gte: 3, $lt: 5 } }),
            Customer.countDocuments({ purchaseCount: 2 }),
            Customer.countDocuments({ purchaseCount: 1 }),
            Customer.countDocuments({ purchaseCount: 0 })
        ]),
        Customer.aggregate([{ $match: { purchaseCount: { $gte: 2 } } }, { $addFields: { firstDate: { $min: { $map: { input: '$purchases', as: 'p', in: '$$p.date' } } }, lastDate: { $max: { $map: { input: '$purchases', as: 'p', in: '$$p.date' } } } } }, { $addFields: { avgCycle: { $divide: [{ $divide: [{ $subtract: ['$lastDate', '$firstDate'] }, 86400000] }, { $subtract: ['$purchaseCount', 1] }] } } }, { $group: { _id: null, avg: { $avg: '$avgCycle' } } }]),
        Customer.aggregate([
            { $match: { 'purchases.0': { $exists: true } } },
            { $addFields: { firstPurchaseDate: { $min: { $map: { input: '$purchases', as: 'p', in: '$$p.date' } } } } },
            { $addFields: { firstPurchaseMonth: { $dateToString: { format: '%Y-%m', date: '$firstPurchaseDate' } } } },
            { $unwind: '$purchases' },
            { $addFields: { purchaseMonth: { $dateToString: { format: '%Y-%m', date: '$purchases.date' } }, isNew: { $eq: [{ $dateToString: { format: '%Y-%m', date: '$purchases.date' } }, '$firstPurchaseMonth'] } } },
            { $group: { _id: '$purchaseMonth', revenue: { $sum: '$purchases.amount' }, orders: { $sum: 1 }, newCustomers: { $sum: { $cond: ['$isNew', 1, 0] } }, uniqueCustomers: { $addToSet: '$id' } } },
            { $project: { revenue: 1, orders: 1, newCustomers: 1, uniqueCustomers: { $size: '$uniqueCustomers' } } },
            { $sort: { _id: 1 } }
        ]),
        Customer.aggregate([{ $unwind: '$purchases' }, { $group: { _id: '$purchases.product', customers: { $addToSet: '$id' }, orders: { $sum: 1 }, revenue: { $sum: '$purchases.amount' } } }, { $project: { orders: 1, revenue: 1, customers: { $size: '$customers' } } }, { $sort: { revenue: -1 } }, { $limit: 10 }])
    ]);

    const totalRevenue = (totalRevenueAgg as any[])[0]?.total || 0;
    const [vip, loyal, repeat, oneTime, outreach] = lifecycleCounts as number[];
    const buyers = totalCustomers - outreach;
    const avgLTV = buyers > 0 ? Math.round(totalRevenue / buyers) : 0;
    const repeatPurchaseRate = totalCustomers > 0 ? parseFloat((((vip + loyal + repeat) / totalCustomers) * 100).toFixed(1)) : 0;
    const avgReorderCycle = (cycleAgg as any[])[0]?.avg ? Math.round((cycleAgg as any[])[0].avg) : null;

    const allSpending = await Customer.find({ totalSpending: { $gt: 0 } }).select('totalSpending').sort({ totalSpending: -1 }).lean();
    const totalRev = (allSpending as any[]).reduce((s, c) => s + c.totalSpending, 0) || 1;
    const n = allSpending.length;
    const revenueConcentration = [0.01, 0.05, 0.1, 0.2, 0.5].map(p => {
        const count = Math.ceil(n * p);
        const cumRev = (allSpending as any[]).slice(0, count).reduce((s, c) => s + c.totalSpending, 0);
        return { pct: p * 100, customerCount: count, revenueShare: parseFloat(((cumRev / totalRev) * 100).toFixed(1)) };
    });

    const topProducts = (topProductsAgg as any[]).map((p: any) => ({ name: p._id, customers: p.customers, orders: p.orders, revenue: p.revenue }));

    const variantBuckets: Record<string, number> = { 'Chocolate': 0, 'Natural': 0, 'Mixed': 0, 'Other': 0 };
    const custVariants: Record<string, Set<string>> = {};
    for (const doc of allSpending) {
        const c = doc as any;
        if (c.purchases) {
            c.purchases.forEach((p: any) => {
                const name = (p.product || '').toLowerCase();
                const variant = name.includes('chocolate') ? 'Chocolate' : name.includes('natural') ? 'Natural' : 'Other';
                if (!custVariants[c.id]) custVariants[c.id] = new Set();
                custVariants[c.id].add(variant);
            });
        }
    }
    for (const id in custVariants) {
        const vs = custVariants[id];
        if (vs.has('Chocolate') && vs.has('Natural')) variantBuckets['Mixed']++;
        else if (vs.has('Chocolate')) variantBuckets['Chocolate']++;
        else if (vs.has('Natural')) variantBuckets['Natural']++;
        else variantBuckets['Other']++;
    }

    const monthlyTrend = (monthlyTrendAgg as any[]).map(m => ({ month: m._id, revenue: m.revenue, orders: m.orders, newCustomers: m.newCustomers, repeatCustomers: m.uniqueCustomers - m.newCustomers }));

    return res.json({ totalCustomers, avgLTV, totalRevenue, repeatPurchaseRate, avgReorderCycle, lifecycle: { vip, loyal, repeat, oneTime, outreach }, revenueConcentration, topProducts, variantBuckets, monthlyTrend });
}));

app.get('/api/stats', handleRequest(async (req, res) => {
    const [totalCustomers, repeatBuyers] = await Promise.all([Customer.countDocuments(), Customer.countDocuments({ purchaseCount: { $gt: 1 } })]);
    const agentName = req.query.agent; const activityDateParam = req.query.activityDate as string | undefined;
    const now = new Date();
    const gmtRes = await Setting.findOne({ key: 'gmt_offset' }); const gmtOffset = gmtRes ? Number(gmtRes.value) : 6;
    const tzString = gmtOffset >= 0 ? `+${String(gmtOffset).padStart(2, '0')}:00` : `-${String(Math.abs(gmtOffset)).padStart(2, '0')}:00`;
    let startA: Date, endA: Date;
    if (activityDateParam) { const d = new Date(activityDateParam); startA = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0); endA = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59); }
    else { startA = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); endA = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59); }
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [rsRes, reRes] = await Promise.all([Setting.findOne({ key: 'outreach_range_start' }), Setting.findOne({ key: 'outreach_range_end' })]);
    const sDays = rsRes ? Number(rsRes.value) : 32; const eDays = reRes ? Number(reRes.value) : 28;
    const minD = new Date(); minD.setDate(now.getDate() - sDays); minD.setHours(0,0,0,0);
    const maxD = new Date(); maxD.setDate(now.getDate() - eDays); maxD.setHours(23,59,59,999);
    const [followUpCount, totalOrderCount] = await Promise.all([Customer.countDocuments({ lastPurchaseDate: { $gte: minD, $lte: maxD } }), LocalOrder.countDocuments({ createdAt: { $gte: startOfMonth }, status: 'sent_to_courier' })]);
    const hourlyAgg = await Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: startA, $lte: endA }, 'followUpNotes.feedback': { $ne: 'Call Not Received' } } }, { $group: { _id: { agent: '$followUpNotes.agent', hour: { $hour: { date: '$followUpNotes.date', timezone: tzString } } }, count: { $sum: 1 } } }, { $sort: { '_id.hour': 1 } }]);
    const execs = await User.find({ role: 'Sales Executive' });
    const tam: Record<string, any> = {};
    execs.forEach(u => { tam[u.name] = { agentName: u.name, shiftStart: u.shiftStart, shiftEnd: u.shiftEnd, startHour: u.shiftStart, hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })), totalToday: 0, isCurrentlyLow: false }; });
    hourlyAgg.forEach(({ _id: { agent, hour }, count }) => { if (tam[agent]) { tam[agent].hourlyBreakdown[hour].count = count; tam[agent].totalToday += count; } });
    const curHour = (now.getUTCHours() + gmtOffset + 24) % 24;
    const isToday = !activityDateParam || activityDateParam === now.toISOString().split('T')[0];
    const teamActivity = Object.values(tam).map(a => { a.isCurrentlyLow = isToday && curHour >= a.shiftStart && curHour < a.shiftEnd && a.hourlyBreakdown[curHour].count < 10; return a; });
    let totalOutreachCount = 0;
    try { const r = await Customer.aggregate([{ $unwind: '$followUpNotes' }, { $match: { 'followUpNotes.date': { $gte: startOfMonth }, 'followUpNotes.feedback': { $ne: 'Call Not Received' } } }, { $group: { _id: '$id' } }, { $count: 'total' }]); totalOutreachCount = r[0]?.total || 0; } catch {}
    const leaderboard = await LocalOrder.aggregate([{ $match: { createdAt: { $gte: startOfMonth }, agent: { $exists: true, $ne: null } } }, { $group: { _id: '$agent', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }, { $project: { name: '$_id', count: 1, _id: 0 } }]);
    let valueTrend: any = { monthly: [] }; let segmentTrend: any = { monthly: [] };
    try { const tp = (fmt: string, type: string): any[] => [{ $match: { lastPurchaseDate: { $exists: true, $ne: null } } }, { $group: { _id: { period: { $dateToString: { format: fmt, date: '$lastPurchaseDate' } }, metric: type === 'rating' ? '$valueRating' : { $gt: ['$purchaseCount', 1] } }, count: { $sum: 1 } } }, { $sort: { '_id.period': 1 } }]; const [rd, sd] = await Promise.all([Customer.aggregate(tp('%Y-%m', 'rating')), Customer.aggregate(tp('%Y-%m', 'isRepeat'))]); const mr: any[] = []; rd.forEach((d: any) => { let ex = mr.find(m => m.period === d._id.period); if (!ex) { ex = { period: d._id.period, High: 0, Medium: 0, Low: 0 }; mr.push(ex); } ex[d._id.metric] = d.count; }); valueTrend.monthly = mr; const ms: any[] = []; sd.forEach((d: any) => { let ex = ms.find(m => m.period === d._id.period); if (!ex) { ex = { period: d._id.period, Repeat: 0, Single: 0 }; ms.push(ex); } ex[d._id.metric ? 'Repeat' : 'Single'] = d.count; }); segmentTrend.monthly = ms; } catch {}
    const t30 = new Date(); t30.setDate(now.getDate() - 30);
    const [revenueData, bestSellers, recentActivity] = await Promise.all([
        Customer.aggregate([{ $unwind: '$purchases' }, { $match: { 'purchases.date': { $gte: t30 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchases.date' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $project: { date: '$_id', count: 1, _id: 0 } }]),
        Customer.aggregate([{ $unwind: '$purchases' }, { $group: { _id: '$purchases.product', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }, { $project: { name: '$_id', count: 1, _id: 0 } }]),
        Customer.aggregate([{ $match: { 'followUpNotes.0': { $exists: true } } }, { $unwind: '$followUpNotes' }, { $sort: { 'followUpNotes.date': -1 } }, { $limit: 8 }, { $project: { customerName: '$name', customerId: '$id', feedback: '$followUpNotes.feedback', agent: '$followUpNotes.agent', date: '$followUpNotes.date' } }])
    ]);
    let agentPerformance = null;
    if (agentName) { const convs = await LocalOrder.countDocuments({ agent: agentName, createdAt: { $gte: startOfMonth } }); const aa = tam[agentName as string]; agentPerformance = { monthlyConversions: convs, outreachToday: aa?.totalToday || 0, outreachThisHour: aa?.hourlyBreakdown[curHour].count || 0, isCurrentlyLow: isToday && aa?.isCurrentlyLow || false }; }
    return res.json({ totalCustomers, repeatBuyers, followUpCount, totalOutreachCount, totalOrderCount, segmentTrend, valueTrend, bestSellers, revenueData, leaderboard, agentPerformance, recentActivity, teamActivity });
}));

app.get('/api/queue/today', handleRequest(async (req, res) => {
    const agentId = (req.query.agentId as string) || '';
    const size = Math.min(Math.max(Number(req.query.size) || 50, 1), 200);
    if (!agentId) return res.status(400).json({ message: 'agentId is required' });
    const now = new Date();
    const candidates = await Customer.find({ $and: [{ $or: [{ purchaseCount: { $gt: 0 } }, { 'followUpNotes.0': { $exists: true } }] }, { $or: [{ suppressedUntil: null }, { suppressedUntil: { $lte: now } }] }] }).select('id name phone totalSpending purchaseCount lastPurchaseDate followUpNotes').lean();
    let suppressed = 0;
    const scored: any[] = [];
    for (const doc of candidates) {
        const customer: ScoringCustomer = { id: doc.id, name: doc.name, phone: doc.phone, totalSpending: doc.totalSpending ?? 0, purchaseCount: doc.purchaseCount ?? 0, lastPurchaseDate: doc.lastPurchaseDate, followUpNotes: (doc.followUpNotes ?? []).map((n: any) => ({ date: n.date, feedback: n.feedback, agent: n.agent, reminderDate: n.reminderDate ?? null })) };
        const result = scoreCustomer(customer, agentId, now);
        if (result.suppressed) { suppressed++; continue; }
        const notes = customer.followUpNotes ?? [];
        const sn = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const ln = sn[0] ?? null; const lcd = ln ? new Date(ln.date) : null; const lod = customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate) : null; const mpd = 86400000;
        scored.push({ id: customer.id, name: customer.name, phone: customer.phone, score: result.score, reason: result.reason, lastSentiment: ln?.feedback ?? null, daysSinceLastCall: lcd ? Math.floor((now.getTime() - lcd.getTime()) / mpd) : null, daysSinceLastOrder: lod ? Math.floor((now.getTime() - lod.getTime()) / mpd) : null, totalSpending: customer.totalSpending, purchaseCount: customer.purchaseCount });
    }
    scored.sort((a, b) => b.score - a.score);
    return res.json({ queue: scored.slice(0, size), suppressed, totalEligible: scored.length, generatedAt: now.toISOString() });
}));

// ─── Static files (production) ────────────────────────────────────────────────

if (isProd) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!isProd) console.log('API only — run "npm run dev" in another terminal for the frontend.');
});
