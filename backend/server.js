const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let isConnected = false;

async function connectToDatabase() {
    if (isConnected) return;
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI not defined.');
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    await seedAdminUser();
}

// --- Schemas ---

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
    amount: { type: Number, required: true }
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
    followUpNotes: [FollowUpNoteSchema]
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

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
const LocalOrder = mongoose.models.LocalOrder || mongoose.model('LocalOrder', LocalOrderSchema);

// --- Helpers ---

const seedAdminUser = async () => {
    try {
        const adminEmail = 'azizulhakimzen@gmail.com';
        const existing = await User.findOne({ email: adminEmail });
        if (!existing) {
            const hashed = await bcrypt.hash('Uniqpa5$word11177', 10);
            await new User({ name: 'Admin', email: adminEmail, password: hashed, role: 'Administrator', status: 'Active', shiftStart: 9, shiftEnd: 22 }).save();
            console.log('Admin user created.');
        } else if (existing.status !== 'Active') {
            existing.status = 'Active';
            await existing.save();
            console.log('Admin status updated to Active.');
        }
    } catch (e) { console.error(e); }
};

const mapToId = (doc) => {
    if (!doc) return doc;
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    return obj;
};

const formatUserResponse = (userDoc) => {
    const obj = mapToId(userDoc);
    delete obj.password;
    return obj;
};

const recalculateCustomerStats = (customer) => {
    const purchases = customer.purchases;
    if (!purchases || purchases.length === 0) {
        customer.purchaseCount = 0; customer.totalSpending = 0; customer.valueRating = 'Low'; customer.purchaseHistory = '';
        return;
    }
    const sorted = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    customer.lastPurchaseDate = sorted[0].date;
    customer.purchaseCount = purchases.length;
    customer.totalSpending = purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    customer.valueRating = customer.totalSpending >= 3000 ? 'High' : customer.totalSpending >= 1000 ? 'Medium' : 'Low';
    customer.purchaseHistory = [...new Set(purchases.map(p => p.product))].join(', ');
};

const handle = (fn) => async (req, res, next) => {
    try {
        await connectToDatabase();
        return await fn(req, res);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

// --- Auth ---

app.post('/api/register', handle(async (req, res) => {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(409).json({ message: 'User already exists.' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await new User({ name: name || email, email, password: hashed, role: 'Sales Executive' }).save();
    return res.status(201).json(formatUserResponse(user));
}));

app.post('/api/login', handle(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid credentials.' });
    if (user.status !== 'Active') return res.status(403).json({ message: 'Account status: ' + user.status });
    return res.json(formatUserResponse(user));
}));

// --- Users ---

app.get('/api/users', handle(async (req, res) => {
    const users = await User.find({});
    return res.json(users.map(formatUserResponse));
}));

app.patch('/api/users/:userId', handle(async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'Not found' });
    if (req.body.status) user.status = req.body.status;
    if (req.body.shiftStart !== undefined) user.shiftStart = Number(req.body.shiftStart);
    if (req.body.shiftEnd !== undefined) user.shiftEnd = Number(req.body.shiftEnd);
    await user.save();
    return res.json(formatUserResponse(user));
}));

// --- Customers ---

app.get('/api/customers/followup', handle(async (req, res) => {
    const { search, page = 1, limit = 10, tab = 'pending', sortField = 'lastPurchaseDate', sortOrder = 'desc', outreachStart, outreachEnd } = req.query;
    const [rangeStartRes, rangeEndRes, repeatOnlyRes, valueOnlyRes, minOrderValRes] = await Promise.all([
        Setting.findOne({ key: 'outreach_range_start' }),
        Setting.findOne({ key: 'outreach_range_end' }),
        Setting.findOne({ key: 'repeat_only_mode' }),
        Setting.findOne({ key: 'value_only_mode' }),
        Setting.findOne({ key: 'min_order_value' })
    ]);

    const globalStart = rangeStartRes ? Number(rangeStartRes.value) : 32;
    const globalEnd = rangeEndRes ? Number(rangeEndRes.value) : 28;
    const refinedStart = outreachStart ? Number(outreachStart) : globalStart;
    const refinedEnd = outreachEnd ? Number(outreachEnd) : globalEnd;
    const isRepeatOnly = repeatOnlyRes ? !!repeatOnlyRes.value : false;
    const isValueOnly = valueOnlyRes ? !!valueOnlyRes.value : false;
    const minOrderVal = minOrderValRes ? Number(minOrderValRes.value) : 0;

    const now = new Date();
    const broadMinDate = new Date(); broadMinDate.setDate(now.getDate() - globalStart); broadMinDate.setHours(0,0,0,0);
    const broadMaxDate = new Date(); broadMaxDate.setDate(now.getDate() - globalEnd); broadMaxDate.setHours(23,59,59,999);
    const narrowMinDate = new Date(); narrowMinDate.setDate(now.getDate() - refinedStart); narrowMinDate.setHours(0,0,0,0);
    const narrowMaxDate = new Date(); narrowMaxDate.setDate(now.getDate() - refinedEnd); narrowMaxDate.setHours(23,59,59,999);
    const tenDaysAgo = new Date(); tenDaysAgo.setDate(now.getDate() - 10); tenDaysAgo.setHours(0,0,0,0);

    const baseQuery = {
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
    const allLocalOrders = await LocalOrder.find({ createdAt: { $gte: broadMinDate } }).select('recipient_phone createdAt').lean();
    const segments = { pending: [], ordered: [], callLater: [], noAnswer: [], notInterested: [], all: [] };

    candidates.forEach(c => {
        const lastPurchaseTime = c.lastPurchaseDate ? new Date(c.lastPurchaseDate).getTime() : 0;
        const hasRecentInteraction = (c.followUpNotes || []).some(n => new Date(n.date).getTime() >= tenDaysAgo.getTime());
        if (hasRecentInteraction) segments.all.push(c);

        const inBroadWindow = lastPurchaseTime >= broadMinDate.getTime() && lastPurchaseTime <= broadMaxDate.getTime();
        const inNarrowWindow = lastPurchaseTime >= narrowMinDate.getTime() && lastPurchaseTime <= narrowMaxDate.getTime();

        if (inBroadWindow) {
            const hasRecentOrder = allLocalOrders.some(o => o.recipient_phone === c.phone && new Date(o.createdAt).getTime() > lastPurchaseTime);
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
        }
    });

    const activeList = segments[tab] || segments.pending;
    const sortOrderNum = sortOrder === 'asc' ? 1 : -1;
    activeList.sort((a, b) => {
        let valA, valB;
        if (sortField === 'lastInteractionDate') {
            const getDate = c => { const notes = c.followUpNotes || []; return notes.length === 0 ? 0 : Math.max(...notes.map(n => new Date(n.date).getTime())); };
            valA = getDate(a); valB = getDate(b);
        } else {
            valA = a[sortField] ?? 0; valB = b[sortField] ?? 0;
            if (valA instanceof Date) valA = valA.getTime();
            if (valB instanceof Date) valB = valB.getTime();
        }
        if (valA < valB) return -1 * sortOrderNum;
        if (valA > valB) return 1 * sortOrderNum;
        return 0;
    });

    const skip = (Number(page) - 1) * Number(limit);
    return res.json({
        data: activeList.slice(skip, skip + Number(limit)),
        total: activeList.length,
        page: Number(page),
        totalPages: Math.ceil(activeList.length / Number(limit)),
        counts: { pending: segments.pending.length, ordered: segments.ordered.length, callLater: segments.callLater.length, noAnswer: segments.noAnswer.length, notInterested: segments.notInterested.length, all: segments.all.length }
    });
}));

app.get('/api/customers', handle(async (req, res) => {
    const { search, page = 1, limit = 10, sortField = 'lastPurchaseDate', sortOrder = 'desc' } = req.query;
    const query = {};
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const orderNum = sortOrder === 'asc' ? 1 : -1;

    if (sortField === 'lastInteractionDate') {
        const pipeline = [
            { $match: query },
            { $addFields: { sortInteractionDate: { $ifNull: [{ $max: "$followUpNotes.date" }, new Date(0)] } } },
            { $sort: { sortInteractionDate: orderNum } },
            { $skip: skip },
            { $limit: Number(limit) }
        ];
        const data = await Customer.aggregate(pipeline);
        const total = await Customer.countDocuments(query);
        return res.json({ data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    }

    const customers = await Customer.find(query).sort({ [sortField]: orderNum }).skip(skip).limit(Number(limit));
    const total = await Customer.countDocuments(query);
    return res.json({ data: customers, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

app.put('/api/customers/:id', handle(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    const { name, phone, email, address, purchases } = req.body;
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (email) customer.email = email;
    if (address) customer.address = address;
    if (purchases) customer.purchases = purchases.map(p => ({ ...p, date: new Date(p.date) }));
    recalculateCustomerStats(customer);
    await customer.save();
    return res.json(customer);
}));

app.delete('/api/customers/:id', handle(async (req, res) => {
    const result = await Customer.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Not found' });
    return res.json({ message: 'Deleted' });
}));

app.post('/api/customers/bulk-delete', handle(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'Invalid IDs' });
    const result = await Customer.deleteMany({ id: { $in: ids } });
    return res.json({ message: `${result.deletedCount} records deleted.` });
}));

app.post('/api/customers/bulk-update-date', handle(async (req, res) => {
    const { ids, date } = req.body;
    if (!Array.isArray(ids) || !date) return res.status(400).json({ message: 'Invalid data' });
    const newDate = new Date(date);
    const customers = await Customer.find({ id: { $in: ids } });
    for (const c of customers) {
        c.lastPurchaseDate = newDate;
        if (c.purchases && c.purchases.length > 0) {
            c.purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            c.purchases[0].date = newDate;
        }
        await c.save();
    }
    return res.json({ message: `Updated ${customers.length} records.` });
}));

app.post('/api/customers/clear-database', handle(async (req, res) => {
    const { password, adminEmail } = req.body;
    const admin = await User.findOne({ email: adminEmail, role: 'Administrator' });
    if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ message: 'Invalid administrator password.' });
    await Customer.deleteMany({ followUpNotes: { $size: 0 } });
    await Customer.updateMany(
        { followUpNotes: { $exists: true, $not: { $size: 0 } } },
        { $set: { purchases: [], purchaseCount: 0, totalSpending: 0, lastPurchaseDate: null, purchaseHistory: "", valueRating: "Low" } }
    );
    return res.json({ message: "Database cleared." });
}));

app.post('/api/customers/:customerId/followup', handle(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.customerId });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    const note = req.body;
    if (note.reminderDate) note.reminderStatus = 'pending';
    customer.followUpNotes.push(note);
    await customer.save();
    return res.json(customer);
}));

app.patch('/api/customers/:customerId/followup/:noteId/complete', handle(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.customerId });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    const note = customer.followUpNotes.id(req.params.noteId);
    if (note) { note.reminderStatus = 'completed'; await customer.save(); }
    return res.json(customer);
}));

app.patch('/api/customers/:customerId/purchase/:purchaseId/date', handle(async (req, res) => {
    const customer = await Customer.findOne({ id: req.params.customerId });
    if (!customer) return res.status(404).json({ message: 'Not found' });
    const p = customer.purchases.id(req.params.purchaseId);
    if (p) { p.date = new Date(req.body.date); recalculateCustomerStats(customer); await customer.save(); }
    return res.json(customer);
}));

// --- Upload ---

app.post('/api/upload-customers', handle(async (req, res) => {
    const customersData = req.body;
    if (!Array.isArray(customersData) || customersData.length === 0) return res.status(400).json({ message: 'No valid records.' });
    const operations = customersData.map(cust => {
        const purchases = (cust.purchases || []).map(p => ({ ...p, date: new Date(p.date) }));
        let lastPurchaseDate = new Date(cust.lastPurchaseDate);
        if (isNaN(lastPurchaseDate.getTime())) lastPurchaseDate = new Date();
        const totalSpending = purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const valueRating = totalSpending >= 3000 ? 'High' : totalSpending >= 1000 ? 'Medium' : 'Low';
        return {
            updateOne: {
                filter: { phone: String(cust.phone).trim() },
                update: { $set: { id: String(cust.phone).trim(), name: String(cust.name || 'Unknown').trim(), email: String(cust.email || '').trim(), address: String(cust.address || '').trim(), purchases, lastPurchaseDate, totalSpending, valueRating, purchaseCount: purchases.length } },
                upsert: true
            }
        };
    });
    await Customer.bulkWrite(operations);
    return res.status(201).json({ message: `${operations.length} records synchronized.` });
}));

// --- Stats ---

app.get('/api/stats', handle(async (req, res) => {
    const totalCustomers = await Customer.countDocuments();
    const repeatBuyers = await Customer.countDocuments({ purchaseCount: { $gt: 1 } });
    const agentName = req.query.agent;
    const activityDateParam = req.query.activityDate;
    const now = new Date();

    const gmtRes = await Setting.findOne({ key: 'gmt_offset' });
    const gmtOffset = gmtRes ? Number(gmtRes.value) : 6;
    const tzString = gmtOffset >= 0 ? `+${String(gmtOffset).padStart(2, '0')}:00` : `-${String(Math.abs(gmtOffset)).padStart(2, '0')}:00`;

    let startOfActivityRange, endOfActivityRange;
    if (activityDateParam) {
        const d = new Date(activityDateParam);
        startOfActivityRange = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        endOfActivityRange = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    } else {
        startOfActivityRange = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endOfActivityRange = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [rangeStart, rangeEnd] = await Promise.all([Setting.findOne({ key: 'outreach_range_start' }), Setting.findOne({ key: 'outreach_range_end' })]);
    const sDays = rangeStart ? Number(rangeStart.value) : 32;
    const eDays = rangeEnd ? Number(rangeEnd.value) : 28;

    const minDate = new Date(); minDate.setDate(now.getDate() - sDays); minDate.setHours(0,0,0,0);
    const maxDate = new Date(); maxDate.setDate(now.getDate() - eDays); maxDate.setHours(23,59,59,999);
    const followUpCount = await Customer.countDocuments({ lastPurchaseDate: { $gte: minDate, $lte: maxDate } });
    const totalOrderCount = await LocalOrder.countDocuments({ createdAt: { $gte: startOfCurrentMonth }, status: 'sent_to_courier' });

    const hourlyAggregation = await Customer.aggregate([
        { $unwind: "$followUpNotes" },
        { $match: { "followUpNotes.date": { $gte: startOfActivityRange, $lte: endOfActivityRange }, "followUpNotes.feedback": { $ne: "Call Not Received" } } },
        { $group: { _id: { agent: "$followUpNotes.agent", hour: { $hour: { date: "$followUpNotes.date", timezone: tzString } } }, count: { $sum: 1 } } },
        { $sort: { "_id.hour": 1 } }
    ]);

    const allSalesExecutives = await User.find({ role: 'Sales Executive' });
    const teamActivityMap = {};
    allSalesExecutives.forEach(u => {
        teamActivityMap[u.name] = { agentName: u.name, shiftStart: u.shiftStart, shiftEnd: u.shiftEnd, startHour: u.shiftStart, hourlyBreakdown: Array.from({length: 24}, (_, i) => ({ hour: i, count: 0 })), totalToday: 0, isCurrentlyLow: false };
    });
    hourlyAggregation.forEach(item => {
        const agent = item._id.agent;
        if (teamActivityMap[agent]) { teamActivityMap[agent].hourlyBreakdown[item._id.hour].count = item.count; teamActivityMap[agent].totalToday += item.count; }
    });

    const currentHourInTZ = (now.getUTCHours() + gmtOffset + 24) % 24;
    const isTodayActivity = !activityDateParam || activityDateParam === now.toISOString().split('T')[0];
    const teamActivity = Object.values(teamActivityMap).map(agent => {
        const withinShift = currentHourInTZ >= agent.shiftStart && currentHourInTZ < agent.shiftEnd;
        agent.isCurrentlyLow = isTodayActivity && withinShift && agent.hourlyBreakdown[currentHourInTZ].count < 10;
        return agent;
    });

    let totalOutreachCount = 0;
    try {
        const outreachAgg = await Customer.aggregate([
            { $unwind: "$followUpNotes" },
            { $match: { "followUpNotes.date": { $gte: startOfCurrentMonth }, "followUpNotes.feedback": { $ne: "Call Not Received" } } },
            { $group: { _id: "$id" } },
            { $count: "total" }
        ]);
        totalOutreachCount = outreachAgg[0]?.total || 0;
    } catch(e) {}

    const leaderboard = await LocalOrder.aggregate([
        { $match: { createdAt: { $gte: startOfCurrentMonth }, status: 'sent_to_courier' } },
        { $group: { _id: "$agent", count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 },
        { $project: { name: "$_id", count: 1, _id: 0 } }
    ]);

    let valueTrend = { monthly: [], yearly: [] };
    let segmentTrend = { monthly: [], yearly: [] };
    if (totalCustomers > 0) {
        try {
            const ratingData = await Customer.aggregate([
                { $match: { lastPurchaseDate: { $exists: true, $ne: null } } },
                { $group: { _id: { period: { $dateToString: { format: "%Y-%m", date: "$lastPurchaseDate" } }, metric: "$valueRating" }, count: { $sum: 1 } } },
                { $sort: { "_id.period": 1 } }
            ]);
            const monthlyRating = [];
            ratingData.forEach(d => {
                let existing = monthlyRating.find(m => m.period === d._id.period);
                if (!existing) { existing = { period: d._id.period, High: 0, Medium: 0, Low: 0 }; monthlyRating.push(existing); }
                existing[d._id.metric] = d.count;
            });
            valueTrend.monthly = monthlyRating;

            const segmentData = await Customer.aggregate([
                { $match: { lastPurchaseDate: { $exists: true, $ne: null } } },
                { $group: { _id: { period: { $dateToString: { format: "%Y-%m", date: "$lastPurchaseDate" } }, metric: { $gt: ["$purchaseCount", 1] } }, count: { $sum: 1 } } },
                { $sort: { "_id.period": 1 } }
            ]);
            const monthlySegment = [];
            segmentData.forEach(d => {
                let existing = monthlySegment.find(m => m.period === d._id.period);
                if (!existing) { existing = { period: d._id.period, Repeat: 0, Single: 0 }; monthlySegment.push(existing); }
                existing[d._id.metric ? 'Repeat' : 'Single'] = d.count;
            });
            segmentTrend.monthly = monthlySegment;
        } catch(e) {}
    }

    const recentActivity = await Customer.aggregate([
        { $match: { "followUpNotes.0": { $exists: true } } },
        { $unwind: "$followUpNotes" }, { $sort: { "followUpNotes.date": -1 } }, { $limit: 8 },
        { $project: { customerName: "$name", customerId: "$id", feedback: "$followUpNotes.feedback", agent: "$followUpNotes.agent", date: "$followUpNotes.date" } }
    ]);

    let agentPerformance = null;
    if (agentName) {
        const conversions = await LocalOrder.countDocuments({ agent: agentName, createdAt: { $gte: startOfCurrentMonth } });
        const agentAct = teamActivityMap[agentName];
        agentPerformance = { monthlyConversions: conversions, outreachToday: agentAct?.totalToday || 0, outreachThisHour: agentAct?.hourlyBreakdown[currentHourInTZ].count || 0, isCurrentlyLow: isTodayActivity && agentAct?.isCurrentlyLow || false };
    }

    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
    const revenueData = await Customer.aggregate([
        { $unwind: "$purchases" }, { $match: { "purchases.date": { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$purchases.date" } }, count: { $sum: 1 } } },
        { $sort: { "_id": 1 } }, { $project: { date: "$_id", count: 1, _id: 0 } }
    ]);

    const bestSellers = await Customer.aggregate([
        { $unwind: "$purchases" }, { $group: { _id: "$purchases.product", count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 }, { $project: { name: "$_id", count: 1, _id: 0 } }
    ]);

    return res.json({ totalCustomers, repeatBuyers, followUpCount, totalOutreachCount, totalOrderCount, segmentTrend, valueTrend, bestSellers, revenueData, leaderboard, agentPerformance, recentActivity, teamActivity });
}));

// --- Executive Performance ---

app.get('/api/admin/executive-performance', handle(async (req, res) => {
    const { startDate, endDate } = req.query;
    const outreachDateMatch = {};
    const orderDateMatch = {};
    if (startDate) { outreachDateMatch.$gte = new Date(startDate); orderDateMatch.$gte = new Date(startDate); }
    if (endDate)   { outreachDateMatch.$lte = new Date(endDate);   orderDateMatch.$lte = new Date(endDate);   }
    const outreachMatchStage = { "followUpNotes.feedback": { $ne: "Call Not Received" } };
    if (startDate || endDate) outreachMatchStage["followUpNotes.date"] = outreachDateMatch;
    const salesMatchStage = {};
    if (startDate || endDate) salesMatchStage["createdAt"] = orderDateMatch;

    const outreachAgg = await Customer.aggregate([
        { $unwind: "$followUpNotes" },
        { $match: outreachMatchStage },
        { $group: { _id: { agent: "$followUpNotes.agent", month: { $dateToString: { format: "%Y-%m", date: "$followUpNotes.date" } } }, outreachCount: { $sum: 1 } } }
    ]);
    const salesAgg = await LocalOrder.aggregate([
        ...(Object.keys(salesMatchStage).length ? [{ $match: salesMatchStage }] : []),
        { $group: { _id: { agent: "$agent", month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } } }, totalOrders: { $sum: 1 }, approvedOrders: { $sum: { $cond: [{ $eq: ["$status", "sent_to_courier"] }, 1, 0] } } } }
    ]);
    const map = {};
    outreachAgg.forEach(({ _id: { agent, month }, outreachCount }) => {
        if (!map[agent]) map[agent] = {};
        if (!map[agent][month]) map[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 };
        map[agent][month].outreachCount = outreachCount;
    });
    salesAgg.forEach(({ _id: { agent, month }, totalOrders }) => {
        if (!map[agent]) map[agent] = {};
        if (!map[agent][month]) map[agent][month] = { month, outreachCount: 0, orderCount: 0, earnings: 0 };
        map[agent][month].orderCount = totalOrders;
        map[agent][month].earnings = totalOrders * 7;
    });
    const finalData = Object.keys(map).map(agentName => ({ agentName, history: Object.values(map[agentName]).sort((a, b) => b.month.localeCompare(a.month)) })).sort((a, b) => a.agentName.localeCompare(b.agentName));
    return res.json(finalData);
}));

// --- Audit Log ---

app.get('/api/audit-log', handle(async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [{ $unwind: "$followUpNotes" }];
    if (search) {
        pipeline.push({ $match: { $or: [{ "name": { $regex: search, $options: 'i' } }, { "followUpNotes.agent": { $regex: search, $options: 'i' } }, { "followUpNotes.notes": { $regex: search, $options: 'i' } }] } });
    }
    const countRes = await Customer.aggregate([...pipeline, { $count: "total" }]);
    const total = countRes[0]?.total || 0;
    pipeline.push({ $sort: { "followUpNotes.date": -1 } }, { $skip: skip }, { $limit: Number(limit) });
    pipeline.push({ $project: { customerName: "$name", customerId: "$id", feedback: "$followUpNotes.feedback", notes: "$followUpNotes.notes", agent: "$followUpNotes.agent", date: "$followUpNotes.date", _id: 0 } });
    const data = await Customer.aggregate(pipeline);
    return res.json({ data, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
}));

// --- Products ---

app.get('/api/products', handle(async (req, res) => {
    const products = await ProductModel.find({});
    return res.json(products.map(mapToId));
}));

app.post('/api/products', handle(async (req, res) => {
    const product = new ProductModel(req.body);
    await product.save();
    return res.status(201).json(mapToId(product));
}));

app.delete('/api/products/:id', handle(async (req, res) => {
    await ProductModel.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Deleted' });
}));

// --- Orders ---

app.get('/api/orders/local', handle(async (req, res) => {
    const orders = await LocalOrder.find({ status: 'pending_approval' }).sort({ createdAt: -1 });
    return res.json(orders);
}));

app.post('/api/orders/local', handle(async (req, res) => {
    const order = new LocalOrder(req.body);
    await order.save();
    return res.status(201).json(order);
}));

app.delete('/api/orders/local/:id', handle(async (req, res) => {
    await LocalOrder.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Order removed' });
}));

app.patch('/api/orders/local/:id/sent', handle(async (req, res) => {
    const order = await LocalOrder.findById(req.params.id);
    if (order) { order.status = 'sent_to_courier'; await order.save(); }
    return res.json(order);
}));

app.get('/api/orders/latest/:phone', handle(async (req, res) => {
    const order = await LocalOrder.findOne({ recipient_phone: req.params.phone }).sort({ createdAt: -1 });
    if (!order) return res.status(404).json({ message: 'No orders found' });
    return res.json(order);
}));

// --- Settings ---

app.get('/api/settings/outreach-target', handle(async (req, res) => {
    const s = await Setting.findOne({ key: 'outreach_target' });
    return res.json({ value: s ? s.value : 100 });
}));
app.post('/api/settings/outreach-target', handle(async (req, res) => {
    await Setting.findOneAndUpdate({ key: 'outreach_target' }, { value: Number(req.body.value) }, { upsert: true });
    return res.json({ message: 'Updated' });
}));
app.get('/api/settings/outreach-range', handle(async (req, res) => {
    const [s, e] = await Promise.all([Setting.findOne({ key: 'outreach_range_start' }), Setting.findOne({ key: 'outreach_range_end' })]);
    return res.json({ start: s ? Number(s.value) : 32, end: e ? Number(e.value) : 28 });
}));
app.post('/api/settings/outreach-range', handle(async (req, res) => {
    await Promise.all([
        Setting.findOneAndUpdate({ key: 'outreach_range_start' }, { value: Number(req.body.start) }, { upsert: true }),
        Setting.findOneAndUpdate({ key: 'outreach_range_end' }, { value: Number(req.body.end) }, { upsert: true })
    ]);
    return res.json({ message: 'Updated' });
}));
app.get('/api/settings/repeat-only', handle(async (req, res) => {
    const s = await Setting.findOne({ key: 'repeat_only_mode' });
    return res.json({ value: s ? !!s.value : false });
}));
app.post('/api/settings/repeat-only', handle(async (req, res) => {
    await Setting.findOneAndUpdate({ key: 'repeat_only_mode' }, { value: !!req.body.value }, { upsert: true });
    return res.json({ message: 'Updated' });
}));
app.get('/api/settings/value-only', handle(async (req, res) => {
    const s = await Setting.findOne({ key: 'value_only_mode' });
    return res.json({ value: s ? !!s.value : false });
}));
app.post('/api/settings/value-only', handle(async (req, res) => {
    await Setting.findOneAndUpdate({ key: 'value_only_mode' }, { value: !!req.body.value }, { upsert: true });
    return res.json({ message: 'Updated' });
}));
app.get('/api/settings/min-order-value', handle(async (req, res) => {
    const s = await Setting.findOne({ key: 'min_order_value' });
    return res.json({ value: s ? Number(s.value) : 0 });
}));
app.post('/api/settings/min-order-value', handle(async (req, res) => {
    await Setting.findOneAndUpdate({ key: 'min_order_value' }, { value: Number(req.body.value) }, { upsert: true });
    return res.json({ message: 'Updated' });
}));
app.get('/api/settings/gmt-offset', handle(async (req, res) => {
    const s = await Setting.findOne({ key: 'gmt_offset' });
    return res.json({ value: s ? Number(s.value) : 6 });
}));
app.post('/api/settings/gmt-offset', handle(async (req, res) => {
    await Setting.findOneAndUpdate({ key: 'gmt_offset' }, { value: Number(req.body.value) }, { upsert: true });
    return res.json({ message: 'Updated' });
}));

// --- Start ---

connectToDatabase()
    .then(() => {
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    });
