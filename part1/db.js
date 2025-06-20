const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
});

db.connect((err) => {
    if (err) throw err;
    console.log("Mysql connected");
});

module.exports = db;