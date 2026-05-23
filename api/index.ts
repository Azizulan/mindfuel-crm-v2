
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { type Document, type Model } from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';

// ─── Queue scoring (inlined — avoids Vercel bundling issues with local imports) ───

interface ScoringNote { date: Date | string; feedback: string; agent: string; reminderDate?: Date | string | null; }
interface ScoringCustomer { id: string; name: string; phone: string; totalSpending: number; purchaseCount: number; lastPurchaseDate?: Date | string | null; followUpNotes?: ScoringNote[]; }
interface ScoringResult { score: number; reason: string; suppressed: boolean; suppressionReason?: string; }

const _daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);
const _toDate = (v: Date | string | null | undefined): Date | null => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
const _isToday = (d: Date, now: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

const _ltvPts = (s: number) => s >= 10000 ? 100 : s >= 5000 ? 80 : s >= 3000 ? 60 : s >= 1000 ? 40 : s > 0 ? 20 : 5;
const _freqPts = (n: number) => n >= 5 ? 80 : n >= 3 ? 60 : n === 2 ? 40 : n === 1 ? 20 : 5;
const _recencyPts = (d: number | null) => d === null ? 0 : d >= 31 && d <= 60 ? 50 : d >= 61 && d <= 90 ? 40 : d >= 0 && d <= 30 ? 20 : d <= 180 ? 15 : 5;
const _callPenalty = (d: number | null) => d === null ? 0 : d <= 1 ? 200 : d <= 3 ? 150 : d <= 7 ? 80 : d <= 14 ? 30 : d <= 30 ? 10 : 0;
const _sentimentMod = (f: string | null, rd: Date | null, now: Date) => {
    if (!f) return 0;
    if (f === 'Call Back Later') return (rd && rd <= now) ? 25 : 5;
    return f === 'Happy' ? 15 : f === 'Positive' ? 10 : f === 'Neutral' ? 0 : f === 'Call Not Received' ? -5 : f === 'Not Interested' ? -25 : f === 'Angry' ? -40 : 0;
};
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
    const latestFeedback = latest?.feedback ?? null;
    const reminderDate = _toDate(latest?.reminderDate);
    const latestDate = latest ? _toDate(latest.date) : null;
    const daysSinceLatest = latestDate ? _daysBetween(latestDate, now) : null;

    if (latestFeedback === 'Angry') return { score: 0, reason: '', suppressed: true, suppressionReason: 'Angry' };
    const cut60 = new Date(now); cut60.setDate(now.getDate() - 60);
    if (notes.filter(n => n.feedback === 'Not Interested' && new Date(n.date) >= cut60).length >= 2)
        return { score: 0, reason: '', suppressed: true, suppressionReason: 'Not Interested ×2 in 60 days' };
    const cut14 = new Date(now); cut14.setDate(now.getDate() - 14);
    if (notes.filter(n => n.feedback === 'Call Not Received' && new Date(n.date) >= cut14).length >= 3)
        return { score: 0, reason: '', suppressed: true, suppressionReason: 'Unreachable (3× no answer in 14 days)' };
    if (latestFeedback === 'Call Back Later' && reminderDate && reminderDate > now)
        return { score: 0, reason: '', suppressed: true, suppressionReason: `Callback scheduled for ${reminderDate.toLocaleDateString()}` };

    // Hard suppress: called within last 30 days — do not show again until 30 days have passed
    // Only exception: CBL with a past/due reminder date (exec explicitly scheduled a callback)
    const isDueCallback = latestFeedback === 'Call Back Later' && reminderDate && reminderDate <= now;
    if (daysSinceLatest !== null && daysSinceLatest < 30 && !isDueCallback)
        return { score: 0, reason: '', suppressed: true, suppressionReason: `Called ${daysSinceLatest}d ago` };

    const lastOrderDate = _toDate(customer.lastPurchaseDate);
    const daysSinceOrder = lastOrderDate ? _daysBetween(lastOrderDate, now) : null;
    const lastCallDate = sorted.length > 0 ? _toDate(sorted[0].date) : null;
    const daysSinceLastCall = lastCallDate ? _daysBetween(lastCallDate, now) : null;
    const exclusivityPenalty = notes.some(n => _isToday(new Date(n.date), now) && n.agent !== agentName) ? 60 : 0;
    const score = _ltvPts(customer.totalSpending) + _freqPts(customer.purchaseCount) + _recencyPts(daysSinceOrder) - _callPenalty(daysSinceLastCall) + _sentimentMod(latestFeedback, reminderDate, now) - exclusivityPenalty;
    return { score, reason: _buildReason(customer.purchaseCount, daysSinceOrder, daysSinceLastCall, latestFeedback, reminderDate, now), suppressed: false };
}

const app = express();

app.use(cors() as any); 
app.use(express.json({ limit: '50mb' }) as any);
app.use(express.urlencoded({ limit: '50mb', extended: true }) as any);

let cachedDb: typeof mongoose | null = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI not defined.');
    const db = await mongoose.connect(process.env.MONGO_URI);
    cachedDb = db;
    await seedAdminUser();
    return db;
}

const FollowUpNoteSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    feedback: { type: String, required: true },
    notes: { type: String },
    agent: { type: String, required: true },
    reminderDate: { type: Date },
    reminderStatus: { type: String, default: 'pending', enum: ['pending', 'completed'] }
});

const PurchaseSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    product: { type: String, required: true },
    amount: { type: Number, required: true },
    steadfastId: { type: String }   // set when synced from Steadfast; used for dedup
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
    suppressionReason: { type: String, default: null }
});

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 }
});

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Sales Executive', enum: ['Administrator', 'Sales Executive'] },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Active', 'Blocked'] },
    shiftStart: { type: Number, default: 10 },
    shiftEnd: { type: Number, default: 21 } 
}, { timestamps: true });

const SettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
});

const LocalOrderSchema = new mongoose.Schema({
    invoice: { type: String, required: true, unique: true },
    recipient_name: { type: String, required: true },
    recipient_phone: { type: String, required: true },
    recipient_address: { type: String, required: true },
    cod_amount: { type: Number, required: true },
    note: { type: String },
    status: { type: String, default: 'pending_approval', enum: ['pending_approval', 'sent_to_courier'] },
    items: [{ name: String, price: Number, quantity: Number }],
    agent: { type: String, required: true }
}, { timestamps: true });

interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: 'Administrator' | 'Sales Executive';
    status: 'Pending' | 'Active' | 'Blocked';
    shiftStart: number;
    shiftEnd: number;
}

interface ICustomer extends Document {
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
}

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
const Customer: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
const LocalOrder = mongoose.models.LocalOrder || mongoose.model('LocalOrder', LocalOrderSchema);

const seedAdminUser = async () => {
    try {
        const adminEmail = 'azizulhakimzen@gmail.com';
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('Uniqpa5$word11177', 10);
            await new User({ name: 'Admin', email: adminEmail, password: hashedPassword, role: 'Administrator', status: 'Active', shiftStart: 9, shiftEnd: 22 }).save();
        }
    } catch (error) { console.error(error); }
};

const mapToId = (doc: any) => {
    if (!doc) return doc;
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    return obj;
};

const formatUserResponse = (userDoc: any) => {
    const userObject = mapToId(userDoc);
    delete userObject.password;
    return userObject;
};

const handleRequest = (handler: (req: any, res: any) => Promise<any>) => 
  async (req: any, res: any, next: NextFunction) => {
    try {
      await connectToDatabase();
      return await handler(req, res);
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ message: error.message || 'Error' });
    }
  };

const recalculateCustomerStats = (customer: ICustomer) => {
    const purchases = customer.purchases;
    if (!purchases || purchases.length === 0) {
        customer.purchaseCount = 0;
        customer.totalSpending = 0;
        customer.valueRating = 'Low';
        customer.purchaseHistory = '';
        return;
    }

    const sorted = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    customer.lastPurchaseDate = sorted[0].date;
    customer.purchaseCount = purchases.length;
    customer.totalSpending = purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    if (customer.totalSpending >= 3000) customer.valueRating = 'High';
    else if (customer.totalSpending >= 1000) customer.valueRating = 'Medium';
    else customer.valueRating = 'Low';

    customer.purchaseHistory = [...new Set(purchases.map(p => p.product))].join(', ');
};

app.post('/api/register', handleRequest(async (req, res) => {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ message: 'Exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const savedUser = await new User({ name: name || email, email, password: hashedPassword, role: 'Sales Executive' }).save();
    return res.status(201).json(formatUserResponse(savedUser));
}));

app.post('/api/login', handleRequest(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid' });
    if (user.status !== 'Active') return res.status(403).json({ message: 'Account status: ' + user.status });
    return res.json(formatUserResponse(user));
}));

app.get('/api/customers', handleRequest(async (req, res) => {
    const { search, page = 1, limit = 10, sortField = 'lastPurchaseDate', sortOrder = 'desc' } = req.query;
    const query: any = {};
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const orderNum = sortOrder === 'asc' ? 1 : -1;

    if (sortField === 'health' || sortField === 'lastInteractionDate') {
        const pipeline: any[] = [{ $match: query }];
        
        if (sortField === 'health') {
            pipeline.push({ $addFields: {
                issueCount: {
                    $add: [
                        { $cond: [{ $or: [{ $eq: ["$name", "Unknown"] }, { $not: ["$name"] }] }, 1, 0] },
                        { $cond: [{ $not: ["$lastPurchaseDate"] }, 1, 0] },
                        { $cond: [{ $lt: [{ $size: { $ifNull: ["$purchases", []] } }, 1] }, 1, 0] },
                        { $cond: [{ $lt: [{ $strLenCP: { $ifNull: ["$phone", ""] } }, 10] }, 1, 0] },
                        { $cond: [{ $eq: ["$lastPurchaseDate", new Date(0)] }, 1, 0] }
                    ]
                }
            }});
            pipeline.push({ $sort: { issueCount: orderNum as 1 | -1, name: 1 } });
        } else if (sortField === 'lastInteractionDate') {
            pipeline.push({ $addFields: {
                sortInteractionDate: {
                    $ifNull: [ { $max: "$followUpNotes.date" }, new Date(0) ]
                }
            }});
            pipeline.push({ $sort: { sortInteractionDate: orderNum as 1 | -1 } });
        }

        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: Number(limit) });
        
        const data = await Customer.aggregate(pipeline);
        const total = await Customer.countDocuments(query);
        return res.json({ data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }

    const sort: any = { [sortField as string]: orderNum };
    const customers = await Customer.find(query).sort(sort).skip(skip).limit(Number(limit));
    const total = await Customer.countDocuments(query);
    return res.json({ data: customers, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

app.put('/api/customers/:id', handleRequest(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    
    const updates = req.body;
    if (updates.name) customer.name = updates.name;
    if (updates.phone) customer.phone = updates.phone;
    if (updates.email) customer.email = updates.email;
    if (updates.address) customer.address = updates.address;
    
    if (updates.purchases) {
        customer.purchases = updates.purchases.map((p: any) => ({
            ...p,
            date: new Date(p.date)
        })) as any;
    }
    
    recalculateCustomerStats(customer);
    await customer.save();
    return res.json(customer);
}));

app.delete('/api/customers/:id', handleRequest(async (req, res) => {
    const result = await Customer.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Customer not found' });
    return res.json({ message: 'Customer deleted successfully' });
}));

app.post('/api/customers/bulk-delete', handleRequest(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'Invalid IDs' });
    const result = await Customer.deleteMany({ id: { $in: ids } });
    return res.json({ message: `${result.deletedCount} records deleted.` });
}));

app.post('/api/customers/bulk-update-date', handleRequest(async (req, res) => {
    const { ids, date } = req.body;
    if (!Array.isArray(ids) || !date) return res.status(400).json({ message: 'Invalid data' });
    
    const newDate = new Date(date);
    const customers = await Customer.find({ id: { $in: ids } });
    
    for (const customer of customers) {
        customer.lastPurchaseDate = newDate;
        if (customer.purchases && customer.purchases.length > 0) {
            customer.purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            customer.purchases[0].date = newDate;
        }
        await customer.save();
    }
    return res.json({ message: `Updated ${customers.length} records.` });
}));

app.post('/api/customers/clear-database', handleRequest(async (req, res) => {
    const { password, adminEmail } = req.body;
    
    const admin = await User.findOne({ email: adminEmail, role: 'Administrator' });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ message: 'Invalid administrator password.' });
    }

    await Customer.deleteMany({ followUpNotes: { $size: 0 } });
    await Customer.updateMany(
        { followUpNotes: { $exists: true, $not: { $size: 0 } } },
        { 
            $set: { 
                purchases: [], 
                purchaseCount: 0, 
                totalSpending: 0, 
                lastPurchaseDate: null,
                purchaseHistory: "",
                valueRating: "Low"
            } 
        }
    );
    
    return res.json({ message: "Database cleared. Outreach list preserved." });
}));

app.get('/api/stats', handleRequest(async (req, res) => {
    const totalCustomers = await Customer.countDocuments();
    const repeatBuyers = await Customer.countDocuments({ purchaseCount: { $gt: 1 } });
    const agentName = req.query.agent;
    const activityDateParam = req.query.activityDate; // YYYY-MM-DD
    
    const now = new Date();
    
    const gmtRes = await Setting.findOne({ key: 'gmt_offset' });
    const gmtOffset = gmtRes ? Number(gmtRes.value) : 6;
    const tzString = gmtOffset >= 0 ? `+${String(gmtOffset).padStart(2, '0')}:00` : `-${String(Math.abs(gmtOffset)).padStart(2, '0')}:00`;

    // Activity filtering date range
    let startOfActivityRange: Date;
    let endOfActivityRange: Date;

    if (activityDateParam) {
        const d = new Date(activityDateParam as string);
        startOfActivityRange = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        endOfActivityRange = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    } else {
        startOfActivityRange = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endOfActivityRange = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const rangeStart = await Setting.findOne({ key: 'outreach_range_start' });
    const rangeEnd = await Setting.findOne({ key: 'outreach_range_end' });
    const sDays = rangeStart ? Number(rangeStart.value) : 32;
    const eDays = rangeEnd ? Number(rangeEnd.value) : 28;

    const minDate = new Date(); minDate.setDate(now.getDate() - sDays); minDate.setHours(0,0,0,0);
    const maxDate = new Date(); maxDate.setDate(now.getDate() - eDays); maxDate.setHours(23,59,59,999);
    const followUpCount = await Customer.countDocuments({ lastPurchaseDate: { $gte: minDate, $lte: maxDate } });
    const totalOrderCount = await LocalOrder.countDocuments({ createdAt: { $gte: startOfCurrentMonth }, status: 'sent_to_courier' });

    const hourlyAggregation = await Customer.aggregate([
        { $unwind: "$followUpNotes" },
        { $match: { 
            "followUpNotes.date": { $gte: startOfActivityRange, $lte: endOfActivityRange },
            "followUpNotes.feedback": { $ne: "Call Not Received" } 
        } },
        { $group: {
            _id: { 
                agent: "$followUpNotes.agent", 
                hour: { $hour: { date: "$followUpNotes.date", timezone: tzString } } 
            },
            count: { $sum: 1 }
        }},
        { $sort: { "_id.hour": 1 } }
    ]);

    const allSalesExecutives = await User.find({ role: 'Sales Executive' });
    const teamActivityMap: Record<string, any> = {};
    
    allSalesExecutives.forEach(u => {
        teamActivityMap[u.name] = {
            agentName: u.name,
            shiftStart: u.shiftStart,
            shiftEnd: u.shiftEnd,
            startHour: u.shiftStart,
            hourlyBreakdown: Array.from({length: 24}, (_, i) => ({ hour: i, count: 0 })),
            totalToday: 0,
            isCurrentlyLow: false
        };
    });

    hourlyAggregation.forEach(item => {
        const agent = item._id.agent;
        if (teamActivityMap[agent]) {
            teamActivityMap[agent].hourlyBreakdown[item._id.hour].count = item.count;
            teamActivityMap[agent].totalToday += item.count;
        }
    });

    const currentHourInTZ = (now.getUTCHours() + gmtOffset + 24) % 24;
    
    // Only check "low activity" if we are viewing TODAY's stats
    const isTodayActivity = !activityDateParam || activityDateParam === now.toISOString().split('T')[0];

    const teamActivity = Object.values(teamActivityMap).map(agent => {
        const withinShift = currentHourInTZ >= agent.shiftStart && currentHourInTZ < agent.shiftEnd;
        const thisHourCount = agent.hourlyBreakdown[currentHourInTZ].count;
        agent.isCurrentlyLow = isTodayActivity && withinShift && thisHourCount < 10;
        return agent;
    });

    let totalOutreachCount = 0;
    try {
        const outreachAggregation = await Customer.aggregate([
            { $unwind: "$followUpNotes" },
            { $match: { 
                "followUpNotes.date": { $gte: startOfCurrentMonth },
                "followUpNotes.feedback": { $ne: "Call Not Received" }
            } },
            { $group: { _id: "$id" } },
            { $count: "total" }
        ]);
        totalOutreachCount = outreachAggregation[0]?.total || 0;
    } catch (e) { console.warn("Outreach global agg failed", e); }

    const leaderboard = await LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfCurrentMonth }, agent: { $exists: true, $ne: null } } },
        { $group: { _id: "$agent", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { name: "$_id", count: 1, _id: 0 } }
    ]);

    let valueTrend = { monthly: [], yearly: [] };
    let segmentTrend = { monthly: [], yearly: [] };
    if (totalCustomers > 0) {
        try {
            const trendPipeline = (format: string, type: 'rating' | 'isRepeat'): any[] => ([
                { $match: { lastPurchaseDate: { $exists: true, $ne: null } } },
                { $group: {
                    _id: {
                        period: { $dateToString: { format, date: "$lastPurchaseDate" } },
                        metric: type === 'rating' ? "$valueRating" : { $gt: ["$purchaseCount", 1] }
                    },
                    count: { $sum: 1 }
                }},
                { $sort: { "_id.period": 1 } }
            ]);
            const ratingData = await Customer.aggregate(trendPipeline("%Y-%m", 'rating'));
            const segmentData = await Customer.aggregate(trendPipeline("%Y-%m", 'isRepeat'));

            const monthlyRating: any[] = [];
            ratingData.forEach(d => {
                let existing = monthlyRating.find(m => m.period === d._id.period);
                if (!existing) { existing = { period: d._id.period, High: 0, Medium: 0, Low: 0 }; monthlyRating.push(existing); }
                existing[d._id.metric] = d.count;
            });
            valueTrend.monthly = monthlyRating;

            const monthlySegment: any[] = [];
            segmentData.forEach(d => {
                let existing = monthlySegment.find(m => m.period === d._id.period);
                if (!existing) { existing = { period: d._id.period, Repeat: 0, Single: 0 }; monthlySegment.push(existing); }
                existing[d._id.metric ? 'Repeat' : 'Single'] = d.count;
            });
            segmentTrend.monthly = monthlySegment;
        } catch (e) { console.warn("Trend logic failed", e); }
    }

    const recentActivity = await Customer.aggregate([
        { $match: { "followUpNotes.0": { $exists: true } } },
        { $unwind: "$followUpNotes" },
        { $sort: { "followUpNotes.date": -1 } },
        { $limit: 8 },
        { $project: { 
            customerName: "$name", 
            customerId: "$id",
            feedback: "$followUpNotes.feedback", 
            agent: "$followUpNotes.agent", 
            date: "$followUpNotes.date" 
        }}
    ]);

    let agentPerformance = null;
    if (agentName) {
        // Updated to include all orders (pending + sent) for conversion visibility
        const conversions = await LocalOrder.countDocuments({ agent: agentName, createdAt: { $gte: startOfCurrentMonth } });
        const agentAct = teamActivityMap[agentName];
        agentPerformance = {
            monthlyConversions: conversions,
            outreachToday: agentAct?.totalToday || 0,
            outreachThisHour: agentAct?.hourlyBreakdown[currentHourInTZ].count || 0,
            isCurrentlyLow: isTodayActivity && agentAct?.isCurrentlyLow || false
        };
    }

    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
    const revenueData = await Customer.aggregate([
        { $unwind: "$purchases" },
        { $match: { "purchases.date": { $gte: thirtyDaysAgo } } },
        { $group: { 
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$purchases.date" } }, 
            count: { $sum: 1 } 
        } },
        { $sort: { "_id": 1 } },
        { $project: { date: "$_id", count: 1, _id: 0 } }
    ]);

    const bestSellers = await Customer.aggregate([
        { $unwind: "$purchases" },
        { $group: { _id: "$purchases.product", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { name: "$_id", count: 1, _id: 0 } }
    ]);

    return res.json({
        totalCustomers,
        repeatBuyers,
        followUpCount,
        totalOutreachCount,
        totalOrderCount,
        segmentTrend,
        valueTrend,
        bestSellers,
        revenueData,
        leaderboard,
        agentPerformance,
        recentActivity,
        teamActivity
    });
}));

app.get('/api/admin/executive-performance', handleRequest(async (req, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    // Build date-range match clauses
    const outreachDateFilter: any = {};
    if (startDate) outreachDateFilter.$gte = new Date(startDate);
    if (endDate)   outreachDateFilter.$lte = new Date(endDate);
    const outreachMatch: any = { "followUpNotes.feedback": { $ne: "Call Not Received" } };
    if (Object.keys(outreachDateFilter).length) outreachMatch["followUpNotes.date"] = outreachDateFilter;

    const salesDateFilter: any = {};
    if (startDate) salesDateFilter.$gte = new Date(startDate);
    if (endDate)   salesDateFilter.$lte = new Date(endDate);
    const salesMatch: any = {};
    if (Object.keys(salesDateFilter).length) salesMatch.createdAt = salesDateFilter;

    // 1. Aggregate Outreach Activity from followUpNotes
    const outreachAggregation = await Customer.aggregate([
        { $unwind: "$followUpNotes" },
        { $match: outreachMatch },
        { $group: {
            _id: {
                agent: "$followUpNotes.agent",
                month: { $dateToString: { format: "%Y-%m", date: "$followUpNotes.date" } }
            },
            outreachCount: { $sum: 1 }
        }}
    ]);

    // 2. Aggregate Sales Activity from LocalOrder (all orders regardless of status)
    const salesPipeline: any[] = [];
    if (Object.keys(salesMatch).length) salesPipeline.push({ $match: salesMatch });
    salesPipeline.push({ $group: {
        _id: {
            agent: "$agent",
            month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
        },
        totalOrders: { $sum: 1 },
        approvedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "sent_to_courier"] }, 1, 0] }
        }
    }});
    const salesAggregation = await LocalOrder.aggregate(salesPipeline);

    // 3. Merge Results
    const performanceMap: Record<string, Record<string, any>> = {};

    // Fill with outreach data
    outreachAggregation.forEach(item => {
        const { agent, month } = item._id;
        if (!agent) return;
        if (!performanceMap[agent]) performanceMap[agent] = {};
        if (!performanceMap[agent][month]) performanceMap[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 };
        performanceMap[agent][month].outreachCount = item.outreachCount;
    });

    // Fill with sales data
    salesAggregation.forEach(item => {
        const { agent, month } = item._id;
        if (!agent) return;
        if (!performanceMap[agent]) performanceMap[agent] = {};
        if (!performanceMap[agent][month]) performanceMap[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 };
        performanceMap[agent][month].orderCount = item.totalOrders;
        performanceMap[agent][month].earnings = item.totalOrders * 7;
    });

    // Format for Frontend — sort agents by total orders desc so top performers appear first
    const finalData = Object.keys(performanceMap).map(agentName => {
        const history = Object.values(performanceMap[agentName]).sort((a, b) => b.month.localeCompare(a.month));
        const totalOrders = history.reduce((s: number, r: any) => s + (r.orderCount || 0), 0);
        return { agentName, history, totalOrders };
    }).sort((a, b) => b.totalOrders - a.totalOrders)
      .map(({ agentName, history }) => ({ agentName, history }));

    return res.json(finalData);
}));

app.get('/api/audit-log', handleRequest(async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline: any[] = [{ $unwind: "$followUpNotes" }];
    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { "name": { $regex: search, $options: 'i' } },
                    { "followUpNotes.agent": { $regex: search, $options: 'i' } },
                    { "followUpNotes.notes": { $regex: search, $options: 'i' } }
                ]
            }
        });
    }
    const countRes = await Customer.aggregate([...pipeline, { $count: "total" }]);
    const total = countRes[0]?.total || 0;
    pipeline.push({ $sort: { "followUpNotes.date": -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: Number(limit) });
    pipeline.push({
        $project: {
            customerName: "$name",
            customerId: "$id",
            feedback: "$followUpNotes.feedback",
            notes: "$followUpNotes.notes",
            agent: "$followUpNotes.agent",
            date: "$followUpNotes.date",
            _id: 0
        }
    });
    const data = await Customer.aggregate(pipeline);
    return res.json({ data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

app.get('/api/customers/followup', handleRequest(async (req, res) => {
    const { search, page = 1, limit = 10, tab = 'pending', sortField = 'lastPurchaseDate', sortOrder = 'desc', outreachStart, outreachEnd } = req.query;
    const rangeStartRes = await Setting.findOne({ key: 'outreach_range_start' });
    const rangeEndRes = await Setting.findOne({ key: 'outreach_range_end' });
    const repeatOnlyModeRes = await Setting.findOne({ key: 'repeat_only_mode' });
    const valueOnlyModeRes = await Setting.findOne({ key: 'value_only_mode' });
    const minOrderValRes = await Setting.findOne({ key: 'min_order_value' });
    
    const globalStart = rangeStartRes ? Number(rangeStartRes.value) : 32;
    const globalEnd = rangeEndRes ? Number(rangeEndRes.value) : 28;
    
    // User refined range (portion of the list)
    const refinedStart = outreachStart ? Number(outreachStart) : globalStart;
    const refinedEnd = outreachEnd ? Number(outreachEnd) : globalEnd;
    
    const isRepeatOnly = repeatOnlyModeRes ? !!repeatOnlyModeRes.value : false;
    const isValueOnly = valueOnlyModeRes ? !!valueOnlyModeRes.value : false;
    const minOrderVal = minOrderValRes ? Number(minOrderValRes.value) : 0;
    
    const now = new Date();
    
    // Broad window for the candidate pool (including all history tabs)
    const broadMinDate = new Date(); broadMinDate.setDate(now.getDate() - globalStart); broadMinDate.setHours(0,0,0,0);
    const broadMaxDate = new Date(); broadMaxDate.setDate(now.getDate() - globalEnd); broadMaxDate.setHours(23,59,59,999);
    
    // Narrow window for the 'To Call' portion if executive refinement is provided
    const narrowMinDate = new Date(); narrowMinDate.setDate(now.getDate() - refinedStart); narrowMinDate.setHours(0,0,0,0);
    const narrowMaxDate = new Date(); narrowMaxDate.setDate(now.getDate() - refinedEnd); narrowMaxDate.setHours(23,59,59,999);
    
    const tenDaysAgo = new Date(); tenDaysAgo.setDate(now.getDate() - 10); tenDaysAgo.setHours(0,0,0,0);
    
    const baseQuery: any = {
        $or: [
            { lastPurchaseDate: { $gte: broadMinDate, $lte: broadMaxDate } },
            { "followUpNotes.date": { $gte: tenDaysAgo } }
        ]
    };
    
    if (isRepeatOnly) baseQuery.purchaseCount = { $gt: 1 };
    if (isValueOnly) baseQuery.totalSpending = { $gte: minOrderVal };
    
    if (search) {
        baseQuery.$or = [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
        ];
    }
    
    const candidates = await Customer.find(baseQuery).lean();
    const allLocalOrders = await LocalOrder.find({ createdAt: { $gte: tenDaysAgo } }).select('recipient_phone createdAt').lean();
    const segments: Record<string, any[]> = { pending: [], ordered: [], callLater: [], noAnswer: [], notInterested: [], all: [] };

    candidates.forEach(c => {
        const lastPurchaseTime = c.lastPurchaseDate ? new Date(c.lastPurchaseDate).getTime() : 0;
        const recentNotes = (c.followUpNotes || []).filter(n => new Date(n.date).getTime() >= tenDaysAgo.getTime());
        const hasRecentNote = recentNotes.length > 0;
        if (hasRecentNote) segments.all.push(c);

        const inBroadWindow = lastPurchaseTime >= broadMinDate.getTime() && lastPurchaseTime <= broadMaxDate.getTime();
        const inNarrowWindow = lastPurchaseTime >= narrowMinDate.getTime() && lastPurchaseTime <= narrowMaxDate.getTime();

        if (inBroadWindow) {
            // Standard outreach-window customers — classify by purchase date + notes after last purchase
            const hasRecentOrder = allLocalOrders.some(o =>
                o.recipient_phone === c.phone &&
                new Date(o.createdAt).getTime() > lastPurchaseTime
            );
            if (hasRecentOrder) {
                if (inNarrowWindow) segments.ordered.push(c);
            } else {
                const notesAfterPurchase = (c.followUpNotes || []).filter(n => new Date(n.date).getTime() > lastPurchaseTime);
                const latestNote = [...notesAfterPurchase].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                if (latestNote && latestNote.feedback === 'Call Back Later') {
                    segments.callLater.push(c);
                } else if (inNarrowWindow) {
                    if (!latestNote) segments.pending.push(c);
                    else if (latestNote.feedback === 'Call Not Received') segments.noAnswer.push(c);
                    else segments.notInterested.push(c);
                }
            }
        } else if (hasRecentNote) {
            // Call-queue customers (outside purchase window) — classify by latest recent note
            const ln = [...recentNotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            if (allLocalOrders.some(o => o.recipient_phone === c.phone && new Date(o.createdAt).getTime() >= tenDaysAgo.getTime())) {
                segments.ordered.push(c);
            } else if (ln.feedback === 'Call Back Later') {
                segments.callLater.push(c);
            } else if (ln.feedback === 'Call Not Received') {
                segments.noAnswer.push(c);
            } else if (ln.feedback === 'Not Interested' || ln.feedback === 'Angry') {
                segments.notInterested.push(c);
            }
            // Happy / Positive / Neutral → warm leads visible in "all" tab only
        }
    });
    
    const activeList = segments[tab as string] || segments.pending;
    const totalInTab = activeList.length;
    const sortOrderNum = sortOrder === 'asc' ? 1 : -1;
    
    activeList.sort((a: any, b: any) => {
        let valA, valB;
        if (sortField === 'lastInteractionDate') {
            const getSortDate = (c: any) => {
                const notes = c.followUpNotes || [];
                if (notes.length === 0) return 0;
                const dates = notes.map((n: any) => new Date(n.date).getTime());
                return Math.max(...dates);
            };
            valA = getSortDate(a);
            valB = getSortDate(b);
        } else {
            valA = a[sortField as string];
            valB = b[sortField as string];
            if (valA === undefined || valA === null) valA = 0;
            if (valB === undefined || valB === null) valB = 0;
            if (valA instanceof Date) valA = valA.getTime();
            if (valB instanceof Date) valB = valB.getTime();
        }

        if (valA < valB) return -1 * sortOrderNum;
        if (valA > valB) return 1 * sortOrderNum;
        return 0;
    });
    
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedList = activeList.slice(skip, skip + Number(limit));
    
    return res.json({
        data: paginatedList,
        total: totalInTab,
        page: Number(page),
        totalPages: Math.ceil(totalInTab / Number(limit)),
        counts: {
            pending: segments.pending.length,
            ordered: segments.ordered.length,
            callLater: segments.callLater.length,
            noAnswer: segments.noAnswer.length,
            notInterested: segments.notInterested.length,
            all: segments.all.length
        }
    });
}));

app.get('/api/users', handleRequest(async (req, res) => {
    const users = await User.find({});
    return res.json(users.map(formatUserResponse));
}));

app.patch('/api/users/:userId', handleRequest(async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Not found' });
    
    if (req.body.status) user.status = req.body.status;
    if (req.body.shiftStart !== undefined) user.shiftStart = Number(req.body.shiftStart);
    if (req.body.shiftEnd !== undefined) user.shiftEnd = Number(req.body.shiftEnd);
    
    await user.save();
    return res.json(formatUserResponse(user));
}));

app.post('/api/upload-customers', handleRequest(async (req, res) => {
    const customersData = req.body;
    if (!Array.isArray(customersData) || customersData.length === 0) {
        return res.status(400).json({ message: 'No valid records to process.' });
    }
    const operations = customersData.map((cust: any) => {
        const purchases = (cust.purchases || []).map((p: any) => ({
            ...p,
            date: new Date(p.date)
        }));
        let lastPurchaseDate = new Date(cust.lastPurchaseDate);
        if (isNaN(lastPurchaseDate.getTime())) lastPurchaseDate = new Date();
        const totalSpending = purchases.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        let valueRating = 'Low';
        if (totalSpending >= 3000) valueRating = 'High';
        else if (totalSpending >= 1000) valueRating = 'Medium';
        
        return {
            updateOne: {
                filter: { phone: String(cust.phone).trim() },
                update: { 
                    $set: { 
                        id: String(cust.phone).trim(),
                        name: String(cust.name || 'Unknown').trim(),
                        email: String(cust.email || '').trim(),
                        address: String(cust.address || '').trim(),
                        purchases,
                        lastPurchaseDate,
                        totalSpending, 
                        valueRating, 
                        purchaseCount: purchases.length 
                    }
                },
                upsert: true
            }
        };
    });
    await Customer.bulkWrite(operations);
    return res.status(201).json({ message: `${operations.length} records synchronized by identifier.` });
}));

app.post('/api/customers/:customerId/followup', handleRequest(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.customerId });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    const newNote = req.body;
    if (newNote.reminderDate) newNote.reminderStatus = 'pending';
    customer.followUpNotes.push(newNote);

    // Suppression triggers — evaluated after push so the new note is included
    const now = new Date();
    const feedback = newNote.feedback;

    if (feedback === 'Angry') {
        const until = new Date(now); until.setDate(until.getDate() + 180);
        customer.suppressedUntil = until;
        customer.suppressionReason = 'Angry';
    } else if (feedback === 'Not Interested') {
        const cutoff60 = new Date(now); cutoff60.setDate(now.getDate() - 60);
        const niCount = customer.followUpNotes.filter(
            (n: any) => n.feedback === 'Not Interested' && new Date(n.date) >= cutoff60
        ).length;
        if (niCount >= 2) {
            const until = new Date(now); until.setDate(until.getDate() + 90);
            customer.suppressedUntil = until;
            customer.suppressionReason = 'Not Interested ×2 in 60 days';
        }
    } else if (feedback === 'Call Not Received') {
        const cutoff14 = new Date(now); cutoff14.setDate(now.getDate() - 14);
        const cnrCount = customer.followUpNotes.filter(
            (n: any) => n.feedback === 'Call Not Received' && new Date(n.date) >= cutoff14
        ).length;
        if (cnrCount >= 3) {
            const until = new Date(now); until.setDate(until.getDate() + 30);
            customer.suppressedUntil = until;
            customer.suppressionReason = 'Unreachable — 3× no answer in 14 days';
        }
    }

    await customer.save();
    return res.json(customer);
}));

app.delete('/api/customers/:customerId/suppression', handleRequest(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.customerId });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    customer.suppressedUntil = null;
    customer.suppressionReason = null;
    await customer.save();
    return res.json({ message: 'Suppression lifted', customer });
}));

app.get('/api/admin/suppressed', handleRequest(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const now = new Date();
    const skip = (Number(page) - 1) * Number(limit);
    const query = { suppressedUntil: { $gt: now } };
    const [data, total] = await Promise.all([
        Customer.find(query)
            .select('id name phone suppressedUntil suppressionReason totalSpending purchaseCount')
            .sort({ suppressedUntil: 1 })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        Customer.countDocuments(query)
    ]);
    return res.json({ data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

app.patch('/api/customers/:customerId/followup/:noteId/complete', handleRequest(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.customerId });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    const note = customer.followUpNotes.id(req.params.noteId);
    if (note) {
        note.reminderStatus = 'completed';
        await customer.save();
    }
    return res.json(customer);
}));

app.patch('/api/customers/:customerId/purchase/:purchaseId/date', handleRequest(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.customerId });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    const p = customer.purchases.id(req.params.purchaseId);
    if (p) {
        p.date = new Date(req.body.date);
        recalculateCustomerStats(customer);
        await customer.save();
    }
    return res.json(customer);
}));

app.get('/api/products', handleRequest(async (req, res) => {
    const products = await ProductModel.find({});
    return res.json(products.map(mapToId));
}));

app.post('/api/products', handleRequest(async (req, res) => {
    const product = new ProductModel(req.body);
    await product.save();
    return res.status(201).json(mapToId(product));
}));

app.delete('/api/products/:id', handleRequest(async (req, res) => {
    await ProductModel.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Deleted' });
}));

app.get('/api/orders/local', handleRequest(async (req, res) => {
    const orders = await LocalOrder.find({ status: 'pending_approval' }).sort({ createdAt: -1 });
    return res.json(orders);
}));

app.post('/api/orders/local', handleRequest(async (req, res) => {
    const order = new LocalOrder(req.body);
    await order.save();
    return res.status(201).json(order);
}));

app.delete('/api/orders/local/:id', handleRequest(async (req, res) => {
    await LocalOrder.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Order removed' });
}));

app.patch('/api/orders/local/:id/sent', handleRequest(async (req, res) => {
    const order = await LocalOrder.findById(req.params.id);
    if (order) {
        order.status = 'sent_to_courier';
        await order.save();
    }
    return res.json(order);
}));

app.get('/api/orders/latest/:phone', handleRequest(async (req, res) => {
    const order = await LocalOrder.findOne({ recipient_phone: req.params.phone }).sort({ createdAt: -1 });
    if (!order) return res.status(404).json({ message: 'No orders found' });
    return res.json(order);
}));

app.get('/api/settings/outreach-target', handleRequest(async (req, res) => {
    const target = await Setting.findOne({ key: 'outreach_target' });
    return res.json({ value: target ? target.value : 100 });
}));

app.post('/api/settings/outreach-target', handleRequest(async (req, res) => {
    const { value } = req.body;
    await Setting.findOneAndUpdate(
        { key: 'outreach_target' },
        { value: Number(value) },
        { upsert: true, new: true }
    );
    return res.json({ message: 'Target updated successfully' });
}));

app.get('/api/settings/outreach-range', handleRequest(async (req, res) => {
    const start = await Setting.findOne({ key: 'outreach_range_start' });
    const end = await Setting.findOne({ key: 'outreach_range_end' });
    return res.json({ 
        start: start ? Number(start.value) : 32, 
        end: end ? Number(end.value) : 28 
    });
}));

app.post('/api/settings/outreach-range', handleRequest(async (req, res) => {
    const { start, end } = req.body;
    await Setting.findOneAndUpdate({ key: 'outreach_range_start' }, { value: Number(start) }, { upsert: true });
    await Setting.findOneAndUpdate({ key: 'outreach_range_end' }, { value: Number(end) }, { upsert: true });
    return res.json({ message: 'Range updated successfully' });
}));

app.get('/api/settings/repeat-only', handleRequest(async (req, res) => {
    const mode = await Setting.findOne({ key: 'repeat_only_mode' });
    return res.json({ value: mode ? !!mode.value : false });
}));

app.post('/api/settings/repeat-only', handleRequest(async (req, res) => {
    const { value } = req.body;
    await Setting.findOneAndUpdate({ key: 'repeat_only_mode' }, { value: !!value }, { upsert: true });
    return res.json({ message: 'Mode updated successfully' });
}));

app.get('/api/settings/value-only', handleRequest(async (req, res) => {
    const mode = await Setting.findOne({ key: 'value_only_mode' });
    return res.json({ value: mode ? !!mode.value : false });
}));

app.post('/api/settings/value-only', handleRequest(async (req, res) => {
    const { value } = req.body;
    await Setting.findOneAndUpdate({ key: 'value_only_mode' }, { value: !!value }, { upsert: true });
    return res.json({ message: 'Mode updated successfully' });
}));

app.get('/api/settings/min-order-value', handleRequest(async (req, res) => {
    const val = await Setting.findOne({ key: 'min_order_value' });
    return res.json({ value: val ? Number(val.value) : 0 });
}));

app.post('/api/settings/min-order-value', handleRequest(async (req, res) => {
    const { value } = req.body;
    await Setting.findOneAndUpdate({ key: 'min_order_value' }, { value: Number(value) }, { upsert: true });
    return res.json({ message: 'Value updated successfully' });
}));

app.get('/api/settings/gmt-offset', handleRequest(async (req, res) => {
    const offset = await Setting.findOne({ key: 'gmt_offset' });
    return res.json({ value: offset ? Number(offset.value) : 6 });
}));

app.post('/api/settings/gmt-offset', handleRequest(async (req, res) => {
    const { value } = req.body;
    await Setting.findOneAndUpdate({ key: 'gmt_offset' }, { value: Number(value) }, { upsert: true });
    return res.json({ message: 'GMT offset updated successfully' });
}));

app.get('/api/queue/today', handleRequest(async (req, res) => {
    const agentId = (req.query.agentId as string) || '';
    const size = Math.min(Math.max(Number(req.query.size) || 50, 1), 200);

    if (!agentId) return res.status(400).json({ message: 'agentId is required' });

    const now = new Date();
    const sixtyDaysAgo = new Date(now); sixtyDaysAgo.setDate(now.getDate() - 60);

    // Fetch scoring candidates: customers with purchase/call history, excluding active suppressions.
    const candidates = await Customer.find({
        $and: [
            { $or: [{ purchaseCount: { $gt: 0 } }, { 'followUpNotes.0': { $exists: true } }] },
            { $or: [{ suppressedUntil: null }, { suppressedUntil: { $lte: now } }] }
        ]
    }).select('id name phone totalSpending purchaseCount lastPurchaseDate followUpNotes').lean();

    let suppressed = 0;
    const scored: Array<{
        id: string;
        name: string;
        phone: string;
        score: number;
        reason: string;
        lastSentiment: string | null;
        daysSinceLastCall: number | null;
        daysSinceLastOrder: number | null;
        totalSpending: number;
        purchaseCount: number;
    }> = [];

    for (const doc of candidates) {
        const customer: ScoringCustomer = {
            id: doc.id,
            name: doc.name,
            phone: doc.phone,
            totalSpending: doc.totalSpending ?? 0,
            purchaseCount: doc.purchaseCount ?? 0,
            lastPurchaseDate: doc.lastPurchaseDate,
            followUpNotes: (doc.followUpNotes ?? []).map((n: any) => ({
                date: n.date,
                feedback: n.feedback,
                agent: n.agent,
                reminderDate: n.reminderDate ?? null,
            })),
        };

        const result = scoreCustomer(customer, agentId, now);

        if (result.suppressed) {
            suppressed++;
            continue;
        }

        // Derive display fields
        const notes = customer.followUpNotes ?? [];
        const sortedNotes = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latestNote = sortedNotes[0] ?? null;
        const lastCallDate = latestNote ? new Date(latestNote.date) : null;
        const lastOrderDate = customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate) : null;
        const msPerDay = 1000 * 60 * 60 * 24;

        scored.push({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            score: result.score,
            reason: result.reason,
            lastSentiment: latestNote?.feedback ?? null,
            daysSinceLastCall: lastCallDate ? Math.floor((now.getTime() - lastCallDate.getTime()) / msPerDay) : null,
            daysSinceLastOrder: lastOrderDate ? Math.floor((now.getTime() - lastOrderDate.getTime()) / msPerDay) : null,
            totalSpending: customer.totalSpending,
            purchaseCount: customer.purchaseCount,
        });
    }

    scored.sort((a, b) => b.score - a.score);

    return res.json({
        queue: scored.slice(0, size),
        suppressed,
        totalEligible: scored.length,
        generatedAt: now.toISOString(),
    });
}));

// ─── Steadfast / Packzy Delivery Sync ────────────────────────────────────────
app.post('/api/sync/steadfast', handleRequest(async (req, res) => {
    const { apiKey, secretKey, startDate, endDate } = req.body;
    if (!apiKey || !secretKey) {
        return res.status(400).json({ message: 'Steadfast API credentials are required. Please add them in Settings → Courier Integration.' });
    }

    const PACKZY = 'https://portal.packzy.com/api/v1';
    const sfHeaders: Record<string, string> = {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    // Dates: treat startDate/endDate as local date strings (YYYY-MM-DD)
    const rangeStart = startDate ? new Date(startDate + 'T00:00:00') : null;
    const rangeEnd   = endDate   ? new Date(endDate   + 'T23:59:59') : null;

    const result = { synced: 0, newCustomers: 0, alreadySynced: 0, paymentsProcessed: 0, errors: [] as string[] };

    // ── Step 1: fetch ALL payment pages (oldest-first, 10/page) ───────────
    // We must walk all pages because Steadfast returns oldest→newest.
    // We collect everything then filter by date so we don't miss recent ones.
    let page = 1;
    const MAX_PAGES = 200;
    const allPayments: any[] = [];

    while (page <= MAX_PAGES) {
        const resp = await fetch(`${PACKZY}/payments?page=${page}`, { headers: sfHeaders });
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Steadfast /payments page ${page} returned ${resp.status}: ${txt.slice(0, 200)}`);
        }
        const raw = await resp.json();
        // Real response: { status, message, payments: [...] }
        const items: any[] = raw.payments ?? [];
        if (items.length === 0) break;
        allPayments.push(...items);
        if (items.length < 10) break; // last page (10 per page)
        page++;
    }

    // Filter to date range
    const paymentsInRange = allPayments.filter(p => {
        const pDate = p.created_at ? new Date(p.created_at) : null;
        if (!pDate) return true;
        if (rangeStart && pDate < rangeStart) return false;
        if (rangeEnd   && pDate > rangeEnd)   return false;
        return true;
    });

    // ── Step 2: fetch consignments per payment and upsert customers ────────
    for (const payment of paymentsInRange) {
        try {
            // Field is payment_id (e.g. "SFC-20458087"), not id
            const pid = payment.payment_id;
            const resp2 = await fetch(`${PACKZY}/payments/${pid}`, { headers: sfHeaders });
            if (!resp2.ok) {
                result.errors.push(`Payment ${pid}: HTTP ${resp2.status}`);
                continue;
            }
            const raw2 = await resp2.json();
            // Real response: { status, message, payment: { ..., consignments: [...] } }
            const consignments: any[] = raw2?.payment?.consignments ?? [];

            result.paymentsProcessed++;

            for (const c of consignments) {
                const rawPhone = String(c.recipient_phone ?? '').replace(/\D/g, '');
                if (rawPhone.length < 10) continue;

                const last10  = rawPhone.slice(-10);
                const cid     = String(c.consignment_id ?? c.id ?? '');
                const amount  = parseFloat(String(c.cod_amount ?? 0)) || 0;
                const delDate = new Date(c.created_at ?? payment.created_at ?? Date.now());

                const existing = await Customer.findOne({ phone: { $regex: last10 + '$' } }).lean();

                if (existing) {
                    // Dedup: skip if this consignment_id already synced
                    const alreadyIn = ((existing as any).purchases ?? []).some((p: any) => p.steadfastId === cid);
                    if (alreadyIn) { result.alreadySynced++; continue; }

                    const product = c.item_description ?? c.parcel_details ?? c.remarks ?? 'Steadfast Delivery';
                    await Customer.updateOne({ _id: existing._id }, {
                        $inc: { purchaseCount: 1, totalSpending: amount },
                        $max: { lastPurchaseDate: delDate },
                        $push: { purchases: { date: delDate, amount, product, steadfastId: cid } },
                    });
                    result.synced++;
                } else {
                    // New customer — create a minimal profile
                    const phone11 = rawPhone.length === 11 ? rawPhone : ('0' + rawPhone.slice(-10));
                    await Customer.create({
                        id: `SF-${phone11}`,
                        name: c.recipient_name ?? 'Unknown',
                        phone: phone11,
                        address: c.recipient_address ?? '',
                        purchaseCount: 1,
                        totalSpending: amount,
                        lastPurchaseDate: delDate,
                        purchases: [{ date: delDate, amount, product: c.item_description ?? c.parcel_details ?? c.remarks ?? 'Steadfast Delivery', steadfastId: cid }],
                        valueRating: amount >= 5000 ? 'High' : amount >= 1000 ? 'Medium' : 'Low',
                        followUpNotes: [],
                    });
                    result.newCustomers++;
                    result.synced++;
                }
            }
        } catch (err: any) {
            result.errors.push(`Payment ${payment.payment_id ?? payment.id}: ${err.message}`);
        }
    }

    return res.json({
        message: `Sync complete — ${result.synced} deliveries applied (${result.newCustomers} new customer${result.newCustomers !== 1 ? 's' : ''} created). ${result.alreadySynced} already up to date.`,
        ...result,
    });
}));

export default app;
