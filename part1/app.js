var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var db = require('./db')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var dogRouter = require('./routes/dogs');
var walkRequestsRouter = require('./routes/walkrequests');
var walkersRoute = require('./routes/walkers');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/dogs', dogRouter);
app.use('/api/walkrequests', walkRequestsRouter);
app.use('/api/walkers', walkersRoute);

module.exports = app;
