import express from 'express';
import path from 'path';
//import { v4 as uuidv4 } from 'uuid';
import { Gamelog } from './gamelog';

interface SessionMetrics {
    token: string
    redactleIndex: number
    article: string
    yesterday: string
}

interface ErrorData {
    message: string
}

const fs = require("fs");

const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const https = require('https');

const app: express.Application = express();
const port = process.env.PORT || 3000;
const sendLog = true;

//let playerId = uuidv4();
let redactleIndex = 0;
let token = "";

function setupExpress() {    
    app.use(cookieParser());
    app.use(express.json());

    app.all('/*', function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        next();
    });

    app.use(express.static(path.join(__dirname, "..", "public")));

    app.listen(port, () => console.log(`Listening at :${port}`));
}

function log(req, message) {
    let ip = req.headers["x-forwarded-for"];
    if(typeof ip == 'object') ip = ip[0];

    if(!ip) return;

    if(sendLog) Gamelog.log(ip, message);
}

function getArticle(callback: (metrics: SessionMetrics, err: string | undefined) => void) {
    let metrics: SessionMetrics = {
        token: '',
        redactleIndex: 0,
        article: '',
        yesterday: ''
    }

    fetchBody('https://www.redactle.com/ses.php', (data) => {

        try {
            const rmetrics = JSON.parse(data);

            redactleIndex = rmetrics.redactleIndex;
            token = rmetrics.token;
    
            var article = Buffer.from(rmetrics.article, 'base64').toString('utf-8');
    
        
            //article = 'World_Trade_Organization'
    
            console.log("[app] got article: " + article);
    
            
            fetchBody('https://en.wikipedia.org/wiki/' + article, (data) => {
    
                try {
    
                //var cleanText: string = data.replace(/<img[^>]*>/g,"").replace(/\<small\>/g,'').replace(/\<\/small\>/g,'').replace(/â€“/g,'-').replace(/<audio.*<\/audio>/g,"");
    
                fs.writeFileSync("public/page.html", data, "utf-8");
    
                console.log("[app] converting redirect url")
    
                var ptLink = `<a href="https://pt.wikipedia.org/wiki/`;
                var startI = data.indexOf(ptLink) + ptLink.length;
                var endI = data.indexOf('"', startI);
                var sl = data.slice(startI, endI);
    
                article = decodeURI(sl);
    
                console.log("[app] final article:", article);
    
                metrics = {
                    token: token,
                    redactleIndex: rmetrics.redactleIndex,
                    article: article,
                    yesterday: rmetrics.yesterday
                }
        
                callback(metrics, undefined);
    
                } catch (error) {
                    callback(metrics, <string>error);
                }
            });
        
        } catch (error) {
            callback(metrics, <string>error);
        }

        
    });
    

    
}

function main() {
    setupExpress();

    app.get("/ses", (req, res) => {
        log(req, "started session");
        console.log("\n[app] get /ses");

        getArticle((metrics, err) => {
            if(err) {
                reportError(<string>err);


                res.status(404).end(err.toString());
                return;
            }
            res.json(metrics)
        });
    })

    app.get("/vic", (req, res) => {
        console.log("\n[app] get /vic");
        log(req, "guessed the article");
        
        res.sendStatus(404);
        res.end();
    });

    app.post("/err", (req, res) => {
        var data: ErrorData = req.body;
        
        reportError(data.message);
    });
}

function reportError(error: string) {
    console.log(`[app] error: ${error}`);
    Gamelog.log("-", `ERROR: ${error}`);
}

function fetchBody(url: string, callback: (data: string) => void) {

    console.log(`[fetch] ${url}`);

    https.get(url, (resp) => {
        let data = '';

        console.log(`[fetch] body: `, data);

        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => { callback(data);  });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

/*
function getVictoryData(callback: (data: string) => void) {
    console.log(token)

    var postData = {
        'playerID': playerId,
        'currentRedactle': redactleIndex,
        'score': 840,
        'accuracy': 5526,
        'token': token
    };

    console.log(postData)

    request.post(
        'https://www.redactle.com/vic.php',
        { json: postData },
        function (error, response, body) {

            console.log(body)

            if (!error && response.statusCode == 200) {
                callback(body);
            }
        }
    );
}
*/

main();