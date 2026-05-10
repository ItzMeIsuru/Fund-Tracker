const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Set headers
    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    const sql = neon(process.env.DATABASE_URL);

    try {
        if (req.method === 'POST') {
            const { userId, state } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID required' });
            }

            // Upsert the user data
            await sql`
                INSERT INTO user_data (user_id, state, last_updated)
                VALUES (${userId}, ${JSON.stringify(state)}, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    state = EXCLUDED.state,
                    last_updated = CURRENT_TIMESTAMP;
            `;

            return res.status(200).json({ message: 'Sync successful' });
        }

        if (req.method === 'GET') {
            const userId = req.query.userId || req.query.userid; // Vercel might lowercase query params depending on settings

            if (!userId) {
                return res.status(400).json({ error: 'User ID required' });
            }

            const result = await sql`
                SELECT state FROM user_data WHERE user_id = ${userId};
            `;

            if (result.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // result[0].state is already an object if the column is JSONB
            const stateData = result[0].state;
            
            if (typeof stateData === 'string') {
                return res.status(200).send(stateData);
            } else {
                return res.status(200).json(stateData);
            }
        }
    } catch (error) {
        console.error('Database Error:', error);
        return res.status(500).json({ error: 'Database connection failed', details: error.message });
    }
};
