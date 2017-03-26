/**
 * Created by viviandiep on 3/26/17.
 */
var config = {};
var env = process.env.NODE_ENV || "development";
if(env === 'development'){
    config = require("./env/development");
}else{
    if(env === 'production'){
        config = require('./env/production');
    }
}
module.exports = config;