/**
 * Migration script: copy Products and LocalOrders from the old database
 * into mindfuel_crm on the same Atlas cluster.
 *
 * Run:  node backend/migrate_from_old_db.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const TARGET_DB = 'mindfuel_crm';

// Strip the database name from the URI so we can switch databases freely
const rawUri = process.env.MONGO_URI || '';
const baseUri = rawUri.replace(/\/[^/?]+(\?|$)/, '/$1');  // keep query string if any

if (!baseUri) {
    console.error('MONGO_URI is not set in backend/.env');
    process.exit(1);
}

async function run() {
    const client = new MongoClient(baseUri);

    try {
        await client.connect();
        console.log('✓ Connected to MongoDB Atlas\n');

        // --- List all databases ---
        const { databases } = await client.db('admin').admin().listDatabases();
        const skip = new Set(['admin', 'local', 'config', TARGET_DB]);
        const candidates = databases
            .map(d => d.name)
            .filter(n => !skip.has(n));

        if (candidates.length === 0) {
            console.log('No source databases found on this cluster (other than mindfuel_crm).');
            return;
        }

        console.log('Databases found on cluster:');
        candidates.forEach(n => console.log(`  • ${n}`));
        console.log();

        const targetDb = client.db(TARGET_DB);

        for (const dbName of candidates) {
            const sourceDb = client.db(dbName);
            const colNames = (await sourceDb.listCollections().toArray()).map(c => c.name);
            console.log(`── ${dbName}  (collections: ${colNames.join(', ') || 'none'})`);

            // ── Products ──────────────────────────────────────────────────
            if (colNames.includes('products')) {
                const srcProducts = await sourceDb.collection('products').find({}).toArray();
                console.log(`   products: ${srcProducts.length} found`);

                if (srcProducts.length > 0) {
                    const existing = await targetDb.collection('products').countDocuments();
                    if (existing > 0) {
                        console.log(`   → target already has ${existing} products — SKIPPING (delete them first if you want to overwrite)`);
                    } else {
                        const docs = srcProducts.map(({ _id, ...rest }) => rest);
                        const r = await targetDb.collection('products').insertMany(docs);
                        console.log(`   ✓ Inserted ${r.insertedCount} products into ${TARGET_DB}`);
                    }
                }
            }

            // ── LocalOrders ───────────────────────────────────────────────
            for (const colName of ['localorders', 'LocalOrders', 'local_orders', 'orders']) {
                if (!colNames.includes(colName)) continue;

                const srcOrders = await sourceDb.collection(colName).find({}).toArray();
                console.log(`   ${colName}: ${srcOrders.length} found`);

                if (srcOrders.length > 0) {
                    // Upsert by invoice to avoid duplicates
                    const ops = srcOrders.map(({ _id, ...rest }) => ({
                        updateOne: {
                            filter: { invoice: rest.invoice },
                            update: { $setOnInsert: rest },
                            upsert: true
                        }
                    }));
                    const r = await targetDb.collection('localorders').bulkWrite(ops);
                    console.log(`   ✓ Orders — inserted: ${r.upsertedCount}, already existed: ${r.matchedCount}`);
                }
                break;  // only process the first matching collection name
            }

            console.log();
        }

        // --- Summary ---
        const finalProducts = await targetDb.collection('products').countDocuments();
        const finalOrders   = await targetDb.collection('localorders').countDocuments();
        console.log('─────────────────────────────────────────');
        console.log(`mindfuel_crm now has:`);
        console.log(`  Products    : ${finalProducts}`);
        console.log(`  LocalOrders : ${finalOrders}`);
        console.log('─────────────────────────────────────────');

    } finally {
        await client.close();
    }
}

run().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
