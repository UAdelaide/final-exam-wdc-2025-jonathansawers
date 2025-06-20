const express = require('express');
const path = require('path');
const session = require('express-session');
var mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));
app.use(session({
  secret: 'dog-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

// copied from pt1
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
  } catch (err) {
    console.error('Error setting up database. Ensure Mysql is running: service mysql start', err);
  }
})();

// Login route
app.post('/login', async (req, res) => {
    // Get username/password from request header
    const { username, password } = req.body;
    try {
        // Run query on DB to check for username
        const [rows] = await db.execute(`
            SELECT * FROM Users WHERE username=?
            `, [username]);

            // Check that username/pw are valid
        if (rows.length === 0 || rows[0].password_hash !== password) {
            return res.status(401).send("Invalid username or password");
        }

        // Set session details
        const user = rows[0];
        req.session.user_id = user.user_id;
        req.session.role = user.role;

        // Redirect user to correct page
        if (user.role === 'owner') {
            return res.redirect('/owner-dashboard.html');
        }
        return res.redirect('/walker-dashboard.html');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occured' });
    }
});

// Logout route
app.post('/logout', async (req,res) => {
  // Destroy session, and catch error
  req.session.destroy((err) => {
    if (err) {
      console.error('Failed to destroy session');
      return res.status(500).send("Could not destroy session");
    }
    res.clearCookie('connect.sid');
    return res.redirect('/');
  });
});

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);

// Export the app instead of listening here
module.exports = app;