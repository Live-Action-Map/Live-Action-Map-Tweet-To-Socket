require('dotenv').config()
const needle = require('needle');
const token = process.env.TWITTER_TOKEN;
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';
const rules = require("./rules.json")

async function getAllRules() {
    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": `Bearer ${token}`
        }
    })
    if (response.statusCode !== 200) {
        logger.error("Error:", response.statusMessage, response.statusCode)
        throw new Error(response.body);
    }
    return (response.body);
}
async function deleteAllRules(rules) {
    if (!Array.isArray(rules.data)) {
        return null;
    }
    const ids = rules.data.map(rule => rule.id);
    const data = {
        "delete": {
            "ids": ids
        }
    }
    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })
    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }
    return (response.body);
}
async function setRules() {

    const data = {
        "add": rules
    }
    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })
    if (response.statusCode !== 201) {
        throw new Error(response.body);
    }
    return (response.body);

}
function streamConnect(retryAttempt) {
    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ${token}`
        },
        timeout: 20000
    });
    stream.on('data', data => {
        try {
            const json = JSON.parse(data);
            handleStreamMessage(json)
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                clogger.error(data.detail)
                process.exit(1)
            } else {
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            logger.error(error.code);
            process.exit(1);
        } else {
            setTimeout(() => {
                logger.info("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt)
        }
    });

    return stream;
}
(async () => {
    let currentRules;

    try {
        currentRules = await getAllRules();
        await deleteAllRules(currentRules);
        await setRules();
    } catch (e) {
        logger.error(e);
        process.exit(1);
    }
    streamConnect(0);
})();


require('dotenv').config()
const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {});
const logger = require("@bunnylogger/bunnylogger")
logger.start(`Server running on ${process.env.SERVER_IP}:${process.env.SERVER_PORT}`)

httpServer.listen(process.env.SERVER_PORT);

function handleStreamMessage(message) {
    try {
        io.emit('tweet', { message });
    }
    catch (e) {
        logger.error(e)
    }
}