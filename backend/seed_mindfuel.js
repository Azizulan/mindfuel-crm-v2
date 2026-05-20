const mongoose = require('mongoose');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// ── Excel date serial → JS Date ─────────────────────────────────────────────
function excelDateToJS(serial) {
    if (!serial || typeof serial !== 'number') return null;
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
}

function parseDate(val) {
    if (!val) return null;
    if (typeof val === 'number') return excelDateToJS(val);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

// ── Schemas ──────────────────────────────────────────────────────────────────
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
    email: { type: String },
    phone: { type: String, required: true, index: true },
    address: { type: String },
    lastPurchaseDate: { type: Date, index: true },
    purchases: [PurchaseSchema],
    purchaseCount: { type: Number, default: 0 },
    totalSpending: { type: Number, default: 0 },
    valueRating: { type: String },
    purchaseHistory: { type: String },
    followUpNotes: [FollowUpNoteSchema],
    // Extra MindFuel fields preserved
    lifecycleStage: { type: String },
    frequencySegment: { type: String },
    variantPreference: { type: String },
    recommendedAction: { type: String },
    daysSinceLastOrder: { type: Number }
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

const ProductSchema2 = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 }
});

async function main() {
    // ── New database: mindfuel_crm ────────────────────────────────────────────
    const baseUri = process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, '/');
    const newUri = baseUri + 'mindfuel_crm';
    console.log('Connecting to new database: mindfuel_crm ...');
    await mongoose.connect(newUri);
    console.log('Connected.');

    const Customer = mongoose.model('Customer', CustomerSchema);
    const User = mongoose.model('User', UserSchema);
    mongoose.model('Setting', SettingSchema);
    mongoose.model('LocalOrder', LocalOrderSchema);
    mongoose.model('Product', ProductSchema2);

    // ── Read Excel ────────────────────────────────────────────────────────────
    console.log('Reading Excel file...');
    const wb = XLSX.readFile('C:\\Users\\azizu\\Downloads\\MINDFUEL_customers_cleaned_v4.xlsx');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['All_Customers'], { defval: '' });
    console.log(`Read ${rows.length} customer rows.`);

    // ── Seed admin user ───────────────────────────────────────────────────────
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
    } else {
        console.log('Admin already exists and active.');
    }

    // ── Clear existing customers ──────────────────────────────────────────────
    await Customer.deleteMany({});
    console.log('Cleared existing customers.');

    // ── Map & insert in batches ───────────────────────────────────────────────
    const BATCH = 500;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const docs = [];

        for (const row of batch) {
            const phone = String(row.Phone || '').trim().replace(/\s+/g, '');
            if (!phone) { skipped++; continue; }

            // Normalize BD phone numbers
            const normalizedPhone = /^\d{10}$/.test(phone) ? '0' + phone : phone;

            const lastOrderDate = parseDate(row.Last_Order_Date);
            const firstOrderDate = parseDate(row.First_Order_Date);
            const callDate = parseDate(row.Latest_Call_Date);

            const totalSpending = Number(row.Total_Spent_BDT) || 0;
            const totalOrders = Number(row.Total_Orders) || 0;
            const avgOrderValue = Number(row.Avg_Order_Value_BDT) || 0;

            const valueRating = totalSpending >= 3000 ? 'High' : totalSpending >= 1000 ? 'Medium' : 'Low';

            // Build synthetic purchase history from aggregate data
            const purchases = [];
            if (lastOrderDate && totalOrders > 0) {
                purchases.push({
                    date: lastOrderDate,
                    product: row.Product_Codes_Bought || row.Variant_Preference || 'Peanut Butter',
                    amount: avgOrderValue || totalSpending
                });
                // Add first order if different date
                if (firstOrderDate && firstOrderDate.getTime() !== lastOrderDate.getTime() && totalOrders >= 2) {
                    purchases.push({
                        date: firstOrderDate,
                        product: row.Product_Codes_Bought || row.Variant_Preference || 'Peanut Butter',
                        amount: avgOrderValue || totalSpending
                    });
                }
            }

            // Build follow-up note from call history
            const followUpNotes = [];
            if (row.Latest_Sentiment && callDate) {
                followUpNotes.push({
                    date: callDate,
                    feedback: row.Latest_Sentiment,
                    notes: row.Latest_Call_Notes || row.Latest_Sentiment,
                    agent: row.Latest_Agent || 'Unknown',
                    reminderStatus: row.Reminder_Status || 'pending'
                });
            }

            docs.push({
                id: normalizedPhone,
                name: String(row.Name || 'Unknown').trim(),
                email: String(row.Email || '').trim(),
                phone: normalizedPhone,
                address: String(row.Latest_Address || '').trim(),
                lastPurchaseDate: lastOrderDate,
                purchases,
                purchaseCount: totalOrders,
                totalSpending,
                valueRating,
                purchaseHistory: String(row.Product_Codes_Bought || row.Variant_Preference || '').trim(),
                followUpNotes,
                lifecycleStage: String(row.Lifecycle_Stage || '').trim(),
                frequencySegment: String(row.Frequency_Segment || '').trim(),
                variantPreference: String(row.Variant_Preference || '').trim(),
                recommendedAction: String(row.Recommended_Action || '').trim(),
                daysSinceLastOrder: Number(row.Days_Since_Last_Order) || 0
            });
        }

        if (docs.length > 0) {
            try {
                await Customer.insertMany(docs, { ordered: false });
                inserted += docs.length;
            } catch (err) {
                // ordered:false continues on duplicate key errors
                const ok = err.result?.nInserted || 0;
                inserted += ok;
                skipped += (docs.length - ok);
            }
        }

        process.stdout.write(`\rProgress: ${Math.min(i + BATCH, rows.length)}/${rows.length} rows processed...`);
    }

    console.log(`\n\nDone!`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Database: mindfuel_crm`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
