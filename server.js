
import express from "express";
import path from 'path';
// import cors from "cors";

// import fs from 'fs'
// import http from 'http'
// import https from 'https'

import dotenv from 'dotenv'
dotenv.config()

import routeAuth from './routes/auth.route.js'

export const start = async (web3, bot) => {

  const app = express();

  // app.use(cors(corsOptions));
  
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-client-key, x-client-token, x-client-secret, Authorization");
    next();
  });
  
  app.use(express.json()); 
  app.use(express.urlencoded({ extended: true }));
  
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  
  app.use(express.static(path.join(__dirname, '/auth_react/build')));
  
  app.get('/login', function (req, res) {
      res.sendFile(path.join(__dirname, '/auth_react/build', 'index.html'));
  });
  
  app.use('/api', routeAuth(web3, bot));
  
  const port = process.env.PORT;
  
  // var options = {
  //     key: fs.readFileSync(__dirname + '/../ssl/private.key', 'utf8'),
  //     cert: fs.readFileSync(__dirname + '/../ssl/certificate.crt', 'utf8'),
  // };
  
  console.log(`VolumeBoostBot API Server up and running on port ${port} !`);
  
  //https.createServer(options, app).listen(port);
  app.listen(port);
}

