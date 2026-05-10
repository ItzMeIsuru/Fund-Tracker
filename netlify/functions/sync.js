const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const sql = neon(process.env.DATABASE_URL);

    try {
        if (event.httpMethod === 'POST') {
            const { userId, state } = JSON.parse(event.body);
            
            if (!userId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'User ID required' }) };
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'Sync successful' })
            };
        }

        if (event.httpMethod === 'GET') {
            const userId = event.queryStringParameters.userId;

            if (!userId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'User ID required' }) };
            }

            const result = await sql`
                SELECT state FROM user_data WHERE user_id = ${userId};
            `;

            if (result.length === 0) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
            }

            // result[0].state is already an object if the column is JSONB
            const stateData = result[0].state;
            const body = typeof stateData === 'string' ? stateData : JSON.stringify(stateData);

            return {
                statusCode: 200,
                headers,
                body: body
            };
        }
    } catch (error) {
        console.error('Database Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Database connection failed', details: error.message })
        };
    }
};
