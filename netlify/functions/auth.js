const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const sql = neon(process.env.DATABASE_URL);

    try {
        // Ensure table exists
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                email VARCHAR(255) UNIQUE,
                password VARCHAR(255)
            );
        `;

        const { action, payload } = JSON.parse(event.body);

        if (action === 'register') {
            const { username, email, password } = payload;
            
            if (!username || !email || !password) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
            }

            // Check if username is taken
            const userCheck = await sql`SELECT username FROM users WHERE username = ${username}`;
            if (userCheck.length > 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'username is already taken use another username' }) };
            }

            // Check if email is taken
            const emailCheck = await sql`SELECT email FROM users WHERE email = ${email}`;
            if (emailCheck.length > 0) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'email is already registered' }) };
            }

            await sql`
                INSERT INTO users (username, email, password)
                VALUES (${username}, ${email}, ${password})
            `;

            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Registration successful', username }) };
        } 
        
        else if (action === 'login') {
            const { identifier, password } = payload; // identifier can be email or username
            
            if (!identifier) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Identifier required' }) };
            }

            // Check new users table
            const user = await sql`
                SELECT username, password FROM users 
                WHERE username = ${identifier} OR email = ${identifier}
            `;

            if (user.length > 0) {
                // User exists in new table, verify password
                if (user[0].password !== password) {
                    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
                }
                return { statusCode: 200, headers, body: JSON.stringify({ message: 'Login successful', username: user[0].username }) };
            }

            // Fallback for old users in user_data
            const oldUser = await sql`
                SELECT user_id FROM user_data WHERE user_id = ${identifier}
            `;

            if (oldUser.length > 0) {
                // Old user found, let them log in without checking password
                return { statusCode: 200, headers, body: JSON.stringify({ message: 'Legacy login successful', username: oldUser[0].user_id }) };
            }

            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
        }

        else if (action === 'update') {
            const { username, email, password } = payload;
            
            if (!username) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Username required' }) };
            }

            // Ensure email is unique if provided and not the same user
            if (email) {
                const emailCheck = await sql`SELECT username FROM users WHERE email = ${email} AND username != ${username}`;
                if (emailCheck.length > 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email is already registered to another account' }) };
                }
            }

            await sql`
                INSERT INTO users (username, email, password)
                VALUES (${username}, ${email}, ${password})
                ON CONFLICT (username)
                DO UPDATE SET 
                    email = COALESCE(EXCLUDED.email, users.email),
                    password = COALESCE(EXCLUDED.password, users.password)
            `;

            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Account updated successfully' }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };

    } catch (error) {
        console.error('Database Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Database error', details: error.message })
        };
    }
};
