"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
//import { v4 as uuidv4 } from 'uuid';
const gamelog_1 = require("./gamelog");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const https = require('https');
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const sendLog = true;
//let playerId = uuidv4();
let redactleIndex = 0;
let token = "";
function setupExpress() {
    app.all('/*', function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        next();
    });
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(express_1.default.static(path_1.default.join(__dirname, "..", "public")));
    app.listen(port, () => console.log(`Listening at :${port}`));
}
function log(req, message) {
    let ip = req.headers["x-forwarded-for"];
    if (typeof ip == 'object')
        ip = ip[0];
    if (!ip)
        return;
    if (sendLog)
        gamelog_1.Gamelog.log(ip, message);
}
function main() {
    setupExpress();
    app.get("/ses", (req, res) => {
        log(req, "started session");
        console.log("\n[app] get /ses");
        fetchBody('https://www.redactle.com/ses.php', (data) => {
            const rmetrics = JSON.parse(data);
            redactleIndex = rmetrics.redactleIndex;
            token = rmetrics.token;
            var article = Buffer.from(rmetrics.article, 'base64').toString('utf-8');
            console.log("[app] article: " + article);
            fetchBody('https://pt.wikipedia.org/w/api.php?action=parse&format=json&page=' + article + '&prop=text&formatversion=2&origin=*', (data) => {
                var json = JSON.parse(data);
                var cleanText = json.parse.text.replace(/<img[^>]*>/g, "").replace(/\<small\>/g, '').replace(/\<\/small\>/g, '').replace(/â€“/g, '-').replace(/<audio.*<\/audio>/g, "");
                var starti = cleanText.indexOf('<a href=\"/wiki/') + 15;
                var endi = cleanText.indexOf('"', starti);
                var url = decodeURI(cleanText.slice(starti, endi));
                console.log("[app] url:", url);
                const metrics = {
                    token: token,
                    redactleIndex: rmetrics.redactleIndex,
                    article: Buffer.from(url).toString('base64'),
                    yesterday: rmetrics.yesterday
                };
                res.json(metrics);
            });
        });
    });
    app.get("/vic", (req, res) => {
        console.log("\n[app] get /vic");
        log(req, "guessed the article");
        res.sendStatus(404);
        res.end();
    });
}
function fetchBody(url, callback) {
    https.get(url, (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => { callback(data); });
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
