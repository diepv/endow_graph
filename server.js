
//server setup
const http = require('http');
const hostname = 'localhost';
const port = 6000;

const server = http.createServer(function(req,res){
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end('server up');
});

server.listen(port, hostname, function(){
    console.log('runnninnng');
});
