import express from 'express';
import path from 'path';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';

const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const https = require('https');
const request = require('request');

interface SessionMetrics {
    token: string
    redactleIndex: number
    article: string
    yesterday: string
}

const app: express.Application = express();
const port = process.env.PORT || 3000;

let playerId = uuidv4();
let redactleIndex = 0;
let token = "";

function setupExpress() {
    app.use(session({ secret: 'random cat', resave: true, saveUninitialized: true, cookie: { secure: false }}));
    app.use(cookieParser());
    app.use(bodyParser.json());

    app.use(express.static(path.join(__dirname, "..", "public")));

    app.use((req, res, next) => {
        if(!req.session['token']) {
            req.session['token'] = uuidv4();
            req.session.save();
            console.log("\n[app] new user, token defined");
        }
        next();
    });

    app.listen(port, () => console.log(`Listening at :${port}`));
}

function main() {
    setupExpress();

    app.get("/ses", (req, res) => {
        console.log("\n[app] get /ses")

        fetchBody('https://www.redactle.com/ses.php', (data) => {
            const rmetrics: SessionMetrics = JSON.parse(data);

            redactleIndex = rmetrics.redactleIndex;
            token = rmetrics.token;

            var article = Buffer.from(rmetrics.article, 'base64').toString('utf-8');

            console.log("[app] article: " + article);

            fetchBody('https://pt.wikipedia.org/w/api.php?action=parse&format=json&page=' + article + '&prop=text&formatversion=2&origin=*', (data) => {
                var json = JSON.parse(data);
                var cleanText: string = json.parse.text.replace(/<img[^>]*>/g,"").replace(/\<small\>/g,'').replace(/\<\/small\>/g,'').replace(/â€“/g,'-').replace(/<audio.*<\/audio>/g,"");
         
                var starti = cleanText.indexOf('<a href=\"/wiki/') + 15;
                var endi = cleanText.indexOf('"', starti);
                var url = decodeURI(cleanText.slice(starti, endi));

                console.log("[app] url:", url);

                const metrics: SessionMetrics = {
                    token: req.session['token'],
                    redactleIndex: rmetrics.redactleIndex,
                    article: Buffer.from(url).toString('base64'),
                    yesterday: rmetrics.yesterday
                }
        
                res.json(metrics);
            });
         })



        
    })

    app.get("/vic", (req, res) => {
        console.log("\n[app] get /vic");

        //getVictoryData((data) => { });

        res.sendStatus(404);
        res.end();
    });
}

function fetchBody(url: string, callback: (data: string) => void) {
    https.get(url, (resp) => {
        let data = '';

        resp.on('data', (chunk) => {
            data += chunk;
        });

        resp.on('end', () => {
            callback(data);
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

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

main();