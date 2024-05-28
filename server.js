const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require("cors");
const bodyParser = require('body-parser');
const formidable = require('formidable');
const http = require("http");
const console = require('console');
const compression  = require('compression')
const os  = require('os')
const axios = require('axios');

const FormData = require('form-data');
const getFileName = require('./src/util.js');
const cvmsConfig = require("./src/config/cvms.config.js");

const log4js = require('log4js');
log4js.configure(path.join(__dirname, 'src', 'log4js.json')); // log4js 설정

const logger = require('log4js').getLogger('cvmsSsrApi');

//const {producer} = require('./src/kafka.js');

//const {SsrApi25} = require('./src/SsrApi25');
//const dbConfigDev = require("./src/config/db.config");
//const dbConfigReal = require("./src/config/db.config.real");

import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createApp } from './src/app.js';

const port = 8080;
const version = 2023.1;


//require('console-stamp')(console, 'yyyy/mm/dd HH:MM:ss.l' );
//import consoleStamp from 'console-stamp';

const whitelist = ["http://localhost","https://192.168.0.177:2443","https://10.5.4.6"]; // 접속 허용 주소
const app = express();
app.use(
    bodyParser.urlencoded({
        extended: true
    })/*,
    cors({
        origin(req, res) {
            console.log("접속된 주소: " + req);

                -1 === whitelist.indexOf(req) && req
                    ? res(Error("허가되지 않은 주소입니다."))
                    : res(null, !0);
        },
        credentials: !0,
        optionsSuccessStatus: 200,
    })*/
);
app.use(compression());

let platform = '';
const server = http.createServer({}, app).listen(port, function () {

    platform = os.platform();
    //console.log(new Date(), 'CVMS Report Server Started listening on port ' + port + '! version:' + version);
    logger.info('MC Guard Server Started listening on port ' + port + '! version:' + version + ' os:' + os.platform(), process.env.NODE_ENV);

});

//import consoleStamp from 'console-stamp';


// This is the important stuff
server.keepAliveTimeout = (5 * 60 * 1000) + 1000;
server.headersTimeout = (5 * 60 * 1000) + 2000;


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


// error handling 미들웨어
app.use((err, req, res, next) => {
    if (err.message === 'someError') {
          res.status(400).json({ message: "someQuery notfound." });
      return;
    }
  
    res.status(500).json({ message: "internal server error" });
});

app.get('/btn', (req, res) => {
    const ssrApp = createSSRApp({
      data: () => ({ count: 1 }),
      template: `<button @click="count++">{{ count }}</button>`
    })
  
    renderToString(ssrApp).then((html) => {
      res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vue SSR Example</title>
        </head>
        <body>
          <div id="app">${html}</div>
        </body>
      </html>
      `)
    })
});



app.get('/', (req, res) => {
    const  ssrApp = createApp({
      data: () => ({ count: 1 }),
      template: `<button @click="count++">{{ count }}</button>`
    })
  
    //ssrApp.mount('#app')

    renderToString(ssrApp).then((html) => {
      res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vue SSR Example</title>
        </head>
        <body>
          <div id="app">${html}</div>
        </body>
      </html>
      `)
    })
});

createApp().mount('#app')


app.get('/test', function (req, res) {
    res.send('Cvms report server is running...');
});

app.get('/events/:event', async (req, res) => {
    //res.send('event : ' + req.params.event + '\n')
    await producer.send({
        topic:  cvmsConfig.kafka.sendTopic,/*'tp.cvms.backend.sending',*/
        messages: [
            {value: req.params.event},
        ],
    })
    res.send('successfully stored event : ' + req.params.event + '\n')
})

