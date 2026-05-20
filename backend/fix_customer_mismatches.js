/**
 * Fix Count and Revenue mismatches in customer records.
 * For each customer:
 *   - purchaseCount kept as max(purchaseCount, purchases.length)
 *   - totalSpending kept as max(totalSpending, sum of purchase amounts)
 *   - valueRating recalculated from corrected totalSpending
 *
 * Run:  node backend/fix_customer_mismatches.js
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const DB_NAME = 'mindfuel_crm';

const uri = process.env.MONGO_URI || '';
if (!uri) {
    console.error('MONGO_URI is not set in backend/.env');
    process.exit(1);
}

function calcValueRating(spending) {
    if (spending >= 10000) return 'High';
    if (spending >= 3000) return 'Medium';
    return 'Low';
}

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const col = client.db(DB_NAME).collection('customers');

        const customers = await col.find({}).toArray();
        console.log(`Loaded ${customers.length} customers`);

        let countFixed = 0;
        let revenueFixed = 0;
        let ops = [];

        for (const c of customers) {
            const purchases = c.purchases || [];
            const calcSpending = purchases.reduce((s, p) => s + (p.amount || 0), 0);
            const update = {};

            if (c.purchaseCount !== purchases.length) {
                const corrected = Math.max(c.purchaseCount || 0, purchases.length);
                update.purchaseCount = corrected;
                countFixed++;
            }

            if (Math.abs(calcSpending - (c.totalSpending || 0)) > 1) {
                const corrected = Math.max(c.totalSpending || 0, calcSpending);
                update.totalSpending = corrected;
                update.valueRating = calcValueRating(corrected);
                revenueFixed++;
            }

            if (Object.keys(update).length > 0) {
                ops.push({
                    updateOne: {
                        filter: { _id: c._id },
                        update: { $set: update }
                    }
                });
            }
        }

        if (ops.length === 0) {
            console.log('No mismatches found — nothing to fix.');
            return;
        }

        const result = await col.bulkWrite(ops);
        console.log(`\nFixed ${result.modifiedCount} customers`);
        console.log(`  Count mismatches resolved : ${countFixed}`);
        console.log(`  Revenue mismatches resolved: ${revenueFixed}`);
    } finally {
        await client.close();
    }
}

run().catch(err => {
    console.error('Fix failed:', err.message);
    process.exit(1);
});
