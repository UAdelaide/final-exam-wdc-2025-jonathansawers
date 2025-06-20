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

    const [userCount] = await db.execute('SELECT COUNT(*) AS count FROM users');
    if (userCount[0].count === 0) {
        await db.execute(`
            INSERT INTO Users (username, email, password_hash, role) VALUES
            ('alice123', 'alice@example.com', 'hashed123', 'owner'),
            ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
            ('carol123', 'carol@example.com', 'hashed789', 'owner'),
            ('jono', 'jono@jono.com', 'hashedpassword', 'owner'),
            ('pratik', 'tutor@adelaide.edu.au', 'hashed1234', 'owner')
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
// Return a summary of each walker with their avg rating/number of completed walks
app.get('/api/walkers/summary', async (req, res) => {
    try {
        const [results] = await db.execute(`
            SELECT u.username AS walker_username, COUNT(wr.rating_id) AS total_ratings, ROUND(AVG(wr.rating), 1) AS average_rating,
            (
                SELECT COUNT(*)
                FROM WalkRequests wr2
                JOIN WalkApplications wa2 ON wr2.request_id = wa2.request_id
                WHERE wr2.status = 'completed' AND wa2.walker_id = u.user_id AND wa2.status = 'accepted'
            ) AS completed_walks
            FROM Users u
            LEFT JOIN WalkRatings wr ON u.user_id = wr.walker_id
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
