/**
 * Fix followUpNote timestamps in mindfuel_crm.
 *
 * All 5,351 notes in mindfuel_crm were seeded from an Excel export which
 * stripped the time component, leaving every note at midnight UTC.
 * The test DB has the same notes with correct timestamps, plus additional
 * notes logged after the export.
 *
 * For each customer matched by phone number:
 *   - Replace mindfuel_crm followUpNotes with the test DB notes (authoritative)
 *   - test DB is a superset: same notes + correct times + newer notes
 *
 * Run:  node backend/fix_note_timestamps.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const rawUri = process.env.MONGO_URI || '';
const baseUri = rawUri.replace(/\/[^/?]+(\?|$)/, '/$1');

if (!baseUri) { console.error('MONGO_URI not set'); process.exit(1); }

async function run() {
    const client = new MongoClient(baseUri);
    try {
        await client.connect();
        const newDb  = client.db('mindfuel_crm');
        const testDb = client.db('test');

        // Build phone → notes map from test DB (only customers that have notes)
        const testCustomers = await testDb.collection('customers').find(
            { followUpNotes: { $exists: true, $not: { $size: 0 } } },
            { projection: { phone: 1, followUpNotes: 1 } }
        ).toArray();

        console.log(`test customers with notes: ${testCustomers.length}`);

        const testByPhone = new Map();
        for (const c of testCustomers) {
            if (c.phone) testByPhone.set(c.phone.replace(/\s+/g, ''), c.followUpNotes);
        }
        console.log(`Unique phones with notes in test: ${testByPhone.size}`);

        // Now update mindfuel_crm customers whose phone matches test
        let matched = 0, updated = 0, ops = [];

        const newCursor = newDb.collection('customers').find(
            {},
            { projection: { _id: 1, phone: 1, followUpNotes: 1 } }
        );

        for await (const c of newCursor) {
            const phone = (c.phone || '').replace(/\s+/g, '');
            const testNotes = testByPhone.get(phone);
            if (!testNotes) continue;
            matched++;

            // Strip _id from subdocs to avoid conflicts
            const notes = testNotes.map(({ _id, ...rest }) => rest);

            ops.push({
                updateOne: {
                    filter: { _id: c._id },
                    update: { $set: { followUpNotes: notes } }
                }
            });

            if (ops.length === 500) {
                const r = await newDb.collection('customers').bulkWrite(ops);
                updated += r.modifiedCount;
                ops = [];
                process.stdout.write(`  ...${updated} updated so far\r`);
            }
        }

        if (ops.length > 0) {
            const r = await newDb.collection('customers').bulkWrite(ops);
            updated += r.modifiedCount;
        }

        console.log(`\nCustomers matched by phone: ${matched}`);
        console.log(`Customers updated:          ${updated}`);

        // Verify: count midnight notes remaining
        const midnight = await newDb.collection('customers').aggregate([
            { $unwind: '$followUpNotes' },
            { $match: { $expr: { $and: [
                { $eq: [{ $hour:   '$followUpNotes.date' }, 0] },
                { $eq: [{ $minute: '$followUpNotes.date' }, 0] },
                { $eq: [{ $second: '$followUpNotes.date' }, 0] }
            ]}}},
            { $count: 'total' }
        ]).toArray();

        const totalNow = await newDb.collection('customers').aggregate([
            { $unwind: '$followUpNotes' }, { $count: 'total' }
        ]).toArray();

        console.log(`\nmindfuel_crm after fix:`);
        console.log(`  Total notes:        ${totalNow[0]?.total}`);
        console.log(`  Midnight UTC notes: ${midnight[0]?.total || 0}`);

    } finally {
        await client.close();
    }
}

run().catch(err => { console.error('Fix failed:', err.message); process.exit(1); });
