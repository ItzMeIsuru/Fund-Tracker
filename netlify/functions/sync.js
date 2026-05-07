const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    // Only allow POST and GET
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const sql = neon(process.env.DATABASE_URL);

    try {
        if (event.httpMethod === 'POST') {
            const { userId, state } = JSON.parse(event.body);
            
            if (!userId) {
                return { statusCode: 400, body: 'User ID required' };
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
                body: JSON.stringify({ message: 'Sync successful' })
            };
        }

        if (event.httpMethod === 'GET') {
            const userId = event.queryStringParameters.userId;

            if (!userId) {
                return { statusCode: 400, body: 'User ID required' };
            }

            const result = await sql`
                SELECT state FROM user_data WHERE user_id = ${userId};
            `;

            if (result.length === 0) {
                return { statusCode: 404, body: 'User not found' };
            }

            return {
                statusCode: 200,
                body: JSON.stringify(JSON.parse(result[0].state))
            };
        }
    } catch (error) {
        console.error('Database Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Database connection failed', details: error.message })
        };
    }
};
