import express from 'express';
import path from 'path';
//import { v4 as uuidv4 } from 'uuid';
import { Gamelog } from './gamelog';
import { SessionMetrics } from './sessionMetrics';

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
    app.all('/*', function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        next();
    });

    app.use(cookieParser());
    app.use(bodyParser.json());

    app.use(express.static(path.join(__dirname, "..", "public")));

    app.listen(port, () => console.log(`Listening at :${port}`));
}

function log(req, message) {
    let ip = req.headers["x-forwarded-for"];
    if(typeof ip == 'object') ip = ip[0];

    if(!ip) return;

    if(sendLog) Gamelog.log(ip, message);
}

function getArticle(callback: (metrics: SessionMetrics) => void) {
    fetchBody('https://www.redactle.com/ses.php', (data) => {
        const rmetrics: SessionMetrics = JSON.parse(data);

        redactleIndex = rmetrics.redactleIndex;
        token = rmetrics.token;

        var article = Buffer.from(rmetrics.article, 'base64').toString('utf-8');

        //article = 'World_Trade_Organization'

        console.log("[app] got article: " + article);

        fetchBody('https://pt.wikipedia.org/w/api.php?action=parse&format=json&page=' + article + '&prop=text&formatversion=2&origin=*', (data) => {
            var json = JSON.parse(data);
            var cleanText: string = json.parse.text.replace(/<img[^>]*>/g,"").replace(/\<small\>/g,'').replace(/\<\/small\>/g,'').replace(/â€“/g,'-').replace(/<audio.*<\/audio>/g,"");

            //fs.writeFileSync("page.html", json.parse.text);

            var isRedirect = cleanText.includes('redirectMsg');

            if(isRedirect) {
                console.log("[app] converting redirect url")

                var starti = cleanText.indexOf('<a href=\"/wiki/') + 15;
                var endi = cleanText.indexOf('"', starti);

                article = decodeURI(cleanText.slice(starti, endi));
            }

            console.log("[app] final article:", article);

            const metrics: SessionMetrics = {
                token: token,
                redactleIndex: rmetrics.redactleIndex,
                article: Buffer.from(article).toString('base64'),
                yesterday: rmetrics.yesterday
            }
    
            callback(metrics);
        });
     });
}

function main() {
    setupExpress();

    app.get("/ses", (req, res) => {
        log(req, "started session");
        console.log("\n[app] get /ses");

        getArticle(metrics => res.json(metrics));
    })

    app.get("/vic", (req, res) => {
        console.log("\n[app] get /vic");
        log(req, "guessed the article");
        
        res.sendStatus(404);
        res.end();
    });
}

function fetchBody(url: string, callback: (data: string) => void) {
    https.get(url, (resp) => {
        let data = '';
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