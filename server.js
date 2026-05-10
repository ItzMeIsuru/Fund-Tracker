require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let sql;

// Initialize Database connection and auto-create tables
async function initDb() {
    try {
        sql = neon(process.env.DATABASE_URL);
        
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(255) PRIMARY KEY,
                email VARCHAR(255) UNIQUE,
                password VARCHAR(255)
            );
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS user_data (
                user_id VARCHAR(255) PRIMARY KEY, 
                state JSONB NOT NULL, 
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log("Database connected and tables verified successfully.");
    } catch (error) {
        console.error("Error connecting to database or creating tables:", error);
    }
}

// Call init on startup
if (process.env.DATABASE_URL) {
    initDb();
} else {
    console.warn("WARNING: DATABASE_URL is not set in environment variables. Database features will fail.");
}

// ============================================
// Auth API Route
// ============================================
app.post('/api/auth', async (req, res) => {
    if (!sql) return res.status(500).json({ error: 'Database not connected' });

    try {
        const { action, payload } = req.body;

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
});

// ============================================
// Sync API Route
// ============================================
app.all('/api/sync', async (req, res) => {
    if (!sql) return res.status(500).json({ error: 'Database not connected' });

    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        if (req.method === 'POST') {
            const { userId, state } = req.body;
            
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
            const userId = req.query.userId || req.query.userid;

            if (!userId) {
                return res.status(400).json({ error: 'User ID required' });
            }

            const result = await sql`
                SELECT state FROM user_data WHERE user_id = ${userId};
            `;

            if (result.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

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
});

// Fallback to index.html for any other requests (Single Page App behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
