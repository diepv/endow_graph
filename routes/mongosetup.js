var mongo = require('mongodb');
var Server = mongo.Server;
Db = mongo.Db;
BSON = mongo.BSONPure;
var server = new Server('75.142.61.61', 27017, {auto_reconnect:true, safe:true});
exports.db = new Db('reddit', server);
