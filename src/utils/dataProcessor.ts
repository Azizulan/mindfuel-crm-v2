
import { Customer, Purchase } from '../types';

const parseFlexibleDate = (dateStr: any): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    const str = String(dateStr).trim();
    // Ignore common "null" placeholders from CSV/Excel
    if (str.toLowerCase() === 'null' || str === '' || str === '0') return null;

    let d = new Date(str);
    
    if (isNaN(d.getTime())) {
        const parts = str.split(/[-/.]/); // Added dot as separator
        if (parts.length === 3) {
            // Check for DD/MM/YYYY
            if (parts[0].length <= 2 && parts[2].length === 4) {
                d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } 
            // Check for YYYY/MM/DD
            else if (parts[0].length === 4) {
                d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
        }
    }
    return isNaN(d.getTime()) ? null : d;
};

export const processAndAnalyzeData = (rawData: any[]): Customer[] => {
  const customerMap = new Map<string, any>();

  const normalizeKeys = (obj: any): any => {
    if (!obj) return {};
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        newObj[cleanKey] = obj[key];
      }
    }
    return newObj;
  };

  rawData.forEach(rawRow => {
    const row = normalizeKeys(rawRow); 
    
    // Identity Detection (Identifier is the unique key)
    let identifier = String(
        row.phone || row.mobile || row.contact || row.cell || 
        row.phonenumber || row.mobilenumber || row.customerphone || 
        row.email || row.id || ''
    ).trim();
    
    if (!identifier || identifier.toLowerCase() === 'null' || identifier === '') return;

    // Bangladesh phone number normalization
    if (/^\d{10}$/.test(identifier)) {
        identifier = '0' + identifier;
    }

    const customerName = String(
        row.name || row.customername || row.client || row.clientname || 
        row.customer || row.recipient || 'Unknown Customer'
    ).trim();

    const rawDate = row.purchasedate || row.date || row.orderdate || row.time || row.createdat || row.timestamp;
    const purchaseDate = parseFlexibleDate(rawDate);
    
    const rawPrice = row.productprice || row.price || row.amount || row.cost || row.total || row.value || 0;
    const productPrice = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
    
    const newPurchase: Purchase = {
        date: purchaseDate || new Date(), // Fallback for stats but will flag in health check if originally null
        product: String(row.product || row.item || row.sku || row.productname || 'General Product').trim(),
        amount: productPrice
    };
    
    if (customerMap.has(identifier)) {
      const existing = customerMap.get(identifier);
      // Only add if not an exact duplicate (prevent double counting in same file)
      const isDuplicate = existing.purchases.some((p: Purchase) => 
        p.date.getTime() === newPurchase.date.getTime() && p.product === newPurchase.product
      );
      if (!isDuplicate) {
          existing.purchases.push(newPurchase);
      }
      if (purchaseDate && (!existing.lastPurchaseDate || purchaseDate > new Date(existing.lastPurchaseDate))) {
        existing.lastPurchaseDate = purchaseDate;
      }
    } else {
      customerMap.set(identifier, {
        id: identifier,
        name: customerName,
        email: String(row.email || '').trim(),
        phone: identifier,
        address: String(row.address || row.location || row.shippingaddress || '').trim(),
        lastPurchaseDate: purchaseDate, // Can be null
        purchases: purchaseDate ? [newPurchase] : [],
        followUpNotes: [],
      });
    }
  });

  return Array.from(customerMap.values()).map(cust => {
    const purchaseCount = cust.purchases.length;
    const totalSpending = cust.purchases.reduce((sum: number, p: Purchase) => sum + p.amount, 0);
    const purchaseHistory = [...new Set(cust.purchases.map((p: Purchase) => p.product))].join(', ');
    
    let valueRating: 'High' | 'Medium' | 'Low' = 'Low';
    if (totalSpending >= 3000) valueRating = 'High';
    else if (totalSpending >= 1000) valueRating = 'Medium';

    return {
      ...cust,
      purchaseCount,
      totalSpending,
      purchaseHistory,
      valueRating
    };
  });
};
