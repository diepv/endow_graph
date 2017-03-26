var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');
var app = express();
var reddit = require('./routes/reddit.js');
var textprocessing = require('./routes/textProcessing.js');
var config = require("./config/config");
// view engine setup


var server = app.listen(process.env.PORT || 3000, function(){
  var port = server.address().port;
  console.log('running on port: ', port);
});



app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var allowCrossDomain = function(req,res,next){
  res.setHeader("Access-Control-Allow-Origin", "http://viviandiep.com");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");

  next();

};

app.use(allowCrossDomain);
app.use('/users', users);

app.get('/reddit',reddit.getThem);
app.use('/printIt',reddit.printMe);
app.post("/getComment", reddit.getRepliesToComment);

app.get("/lda", textprocessing.lda);
app.get("/agg", textprocessing.ldaCount);
app.get("/commentsAgg", textprocessing.commentsAgg);
app.get("/search/:query", textprocessing.getCommentsByKeyword);
app.get("/threadsWithKeyword/:query/:linkNodeStructure", textprocessing.getThreadsByKeyword);
app.get("/testComments", reddit.ldaComments);


app.use('/', function(q,s){
  process.stdout.write("in '/' ");
});

// g 404 and forward to error handler

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
