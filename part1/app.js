var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let db;

(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '' // Set your MySQL root password
    });

    // Create the database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await connection.end();

    // Now connect to the created database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService'
    });

    const [userCount] = await db.execute('SELECT COUNT(*) AS count FROM Users');
    if (userCount[0].count === 0) {
        await db.execute(`
            INSERT INTO Users (username, email, password_hash, role) VALUES
            ('alice123', 'alice@example.com', 'hashed123', 'owner'),
            ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
            ('carol123', 'carol@example.com', 'hashed789', 'owner'),
            ('jono', 'jono@jono.com', 'hashedpassword', 'owner'),
            ('pratik', 'tutor@adelaide.edu.au', 'hashed1234', 'walker')
            `);

        await db.execute(`
            INSERT INTO Dogs (owner_id, name, size) VALUES
            ((SELECT user_id FROM Users WHERE username='alice123'), 'Max', 'medium'),
            ((SELECT user_id FROM Users WHERE username='carol123'), 'Bella', 'small'),
            ((SELECT user_id FROM Users WHERE username='jono'), 'Rossie', 'small'),
            ((SELECT user_id FROM Users WHERE username='pratik'), 'Fernando', 'large'),
            ((SELECT user_id FROM Users WHERE username='bobwalker'), 'Hamilton', 'medium');
            `);

        await db.execute(`
            INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
            ((SELECT dog_id FROM Dogs WHERE name='Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'completed'),
            ((SELECT dog_id FROM Dogs WHERE name='Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'completed'),
            ((SELECT dog_id FROM Dogs WHERE name='Rossie'), '2025-01-18 08:00:00', 60, 'The Braggs', 'open'),
            ((SELECT dog_id FROM Dogs WHERE name='Fernando'), '2025-02-15 08:00:00', 40, 'McDonalds', 'cancelled'),
            ((SELECT dog_id FROM Dogs WHERE name='Hamilton'), '2024-11-11 08:00:00', 20, 'Mercedes Lane', 'completed');
            `);

        await db.execute(`
            INSERT INTO WalkApplications (request_id, walker_id, status) VALUES
            ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name='Hamilton')),
             (SELECT user_id FROM Users WHERE username='bobwalker'), 'pending'),

            ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name='Bella')),
             (SELECT user_id FROM Users WHERE username='bobwalker'), 'accepted'),

            ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name='Max')),
             (SELECT user_id FROM Users WHERE username='bobwalker'), 'accepted');
        `);

        await db.execute(`
            INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) VALUES
            ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name='Bella')),
             (SELECT user_id FROM Users WHERE username='bobwalker'),
             (SELECT user_id FROM Users WHERE username='carol123'),
             5, 'Excellent job'),

            ((SELECT request_id FROM WalkRequests WHERE dog_id = (SELECT dog_id FROM Dogs WHERE name='Max')),
             (SELECT user_id FROM Users WHERE username='bobwalker'),
             (SELECT user_id FROM Users WHERE username='alice123'),
             4, 'Walk was fine');
        `);
    }

  } catch (err) {
    console.error('Error setting up database. Ensure Mysql is running: service mysql start', err);
  }
})();

// /api/dogs route
// Returns a list of all dogs with their size and owners username
app.get('/api/dogs', async (req, res) => {
  try {
    const [results] = await db.execute(`
        SELECT d.name AS dog_name, d.size, u.username AS owner_username
        FROM Dogs d
        JOIN Users u ON d.owner_id = u.user_id
        `);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// /api/walkrequests/open
// Return all open walk requests, including dog name, requested time, location, owner username
app.get('/api/walkrequests/open', async (req, res) => {
    try {
        const [results] = await db.execute(`
            SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
            FROM WalkRequests wr
            JOIN Dogs d ON wr.dog_id = d.dog_id
            JOIN Users u ON d.owner_id = u.user_id
            WHERE wr.status = 'open'
            `);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch open walk requests' });
    }
});

// /api/walkers/summary
// Return a summary of each walker with their avg rating and the number of completed walks
app.get('/api/walkers/summary', async (req, res) => {
    try {
        const [results] = await db.execute(`
            SELECT
                u.username AS walker_username,
                COUNT(DISTINCT wrt.rating_id) AS total_ratings,
                ROUND(AVG(wrt.rating), 1) AS average_rating,
                COUNT(DISTINCT CASE
                    WHEN wrq.status = 'completed' THEN wrq.request_id
                    ELSE NULL
                END) AS completed_walks
            FROM Users u
            LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
            LEFT JOIN WalkRequests wrq ON wa.request_id = wrq.request_id
            LEFT JOIN WalkRatings wrt ON wrt.request_id = wrq.request_id AND wrt.walker_id = u.user_id
            WHERE u.role = 'walker'
            GROUP BY u.user_id
            `);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch walker summaries' });
    }
});

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
