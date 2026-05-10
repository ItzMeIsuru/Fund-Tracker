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

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
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

        const { action, payload } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        if (action === 'register') {
            const { username, email, password } = payload;
            
            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Check if username is taken
            const userCheck = await sql`SELECT username FROM users WHERE username = ${username}`;
            if (userCheck.length > 0) {
                return res.status(400).json({ error: 'username is already taken use another username' });
            }

            // Check if email is taken
            const emailCheck = await sql`SELECT email FROM users WHERE email = ${email}`;
            if (emailCheck.length > 0) {
                return res.status(400).json({ error: 'email is already registered' });
            }

            await sql`
                INSERT INTO users (username, email, password)
                VALUES (${username}, ${email}, ${password})
            `;

            return res.status(200).json({ message: 'Registration successful', username, email });
        } 
        
        else if (action === 'login') {
            const { identifier, password } = payload; // identifier can be email or username
            
            if (!identifier) {
                return res.status(400).json({ error: 'Identifier required' });
            }

            // Check new users table
            const user = await sql`
                SELECT username, email, password FROM users 
                WHERE username = ${identifier} OR email = ${identifier}
            `;

            if (user.length > 0) {
                // User exists in new table, verify password
                if (user[0].password !== password) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
                return res.status(200).json({ message: 'Login successful', username: user[0].username, email: user[0].email });
            }

            // Fallback for old users in user_data
            const oldUser = await sql`
                SELECT user_id FROM user_data WHERE user_id = ${identifier}
            `;

            if (oldUser.length > 0) {
                // Old user found, let them log in without checking password
                return res.status(200).json({ message: 'Legacy login successful', username: oldUser[0].user_id });
            }

            return res.status(401).json({ error: 'Invalid credentials' });
        }

        else if (action === 'update') {
            const { username, email, password } = payload;
            
            if (!username) {
                return res.status(400).json({ error: 'Username required' });
            }

            // Ensure email is unique if provided and not the same user
            if (email) {
                const emailCheck = await sql`SELECT username FROM users WHERE email = ${email} AND username != ${username}`;
                if (emailCheck.length > 0) {
                    return res.status(400).json({ error: 'email is already registered to another account' });
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

            return res.status(200).json({ message: 'Account updated successfully' });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('Database Error:', error);
        return res.status(500).json({ error: 'Database error', details: error.message });
    }
};
