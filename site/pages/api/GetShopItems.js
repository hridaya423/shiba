const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_SHOP_TABLE = process.env.AIRTABLE_SHOP_TABLE || 'Shop';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const shopItems = await getAllShopItems();
    return res.status(200).json({ ok: true, shopItems });
  } catch (e) {
    console.error('GetShopItems error:', e);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

async function airtableRequest(path, options = {}) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }
  return response.json();
}

async function getAllShopItems() {
  const allItems = [];
  let offset = null;
  
  do {
    const params = new URLSearchParams({
      pageSize: '100', // Maximum page size
    });
    
    if (offset) {
      params.set('offset', offset);
    }

    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_SHOP_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    if (data.records) {
      // Extract and normalize shop item data
      const items = data.records.map(record => {
        const fields = record.fields || {};
        return {
          id: record.id,
          name: fields.Name || '',
          cost: typeof fields.Cost === 'number' ? fields.Cost : 0,
          description: fields.Description || '',
          soldItems: typeof fields.SoldItems === 'number' ? fields.SoldItems : 0,
          initialStock: typeof fields.InitialStock === 'number' ? fields.InitialStock : 0,
          inStock: typeof fields['In Stock'] === 'number' ? fields['In Stock'] : 0,
        };
      });
      
      allItems.push(...items);
    }
    
    offset = data.offset; // Get next page offset
  } while (offset);
  
  return allItems;
}
