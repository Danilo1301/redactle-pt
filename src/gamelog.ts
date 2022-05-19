const request = require('request');

export class Gamelog {
    public static URL = "https://dmdassc.glitch.me/gamelog/log";
    public static LOCAL_URL = "http://127.0.0.1:3000/gamelog/log";
    public static SERVICE_NAME = "redactle-pt";
    public static forceSendToMainServer = false;

    public static log(address: string, message: string) {
        let url = this.URL
        let isLocal = address.includes("127.0.0.1");

        if(isLocal && !this.forceSendToMainServer)
            url = this.LOCAL_URL;

        const data = {
            service: this.SERVICE_NAME,
            address: address,
            message: message,
            sendPing: !isLocal,
            isLocal: isLocal
        }

        console.log("[gamelog] post", url, data)

        request.post(
            url,
            { headers: {'user-agent': `service-${this.SERVICE_NAME}`}, json: data },
            function (error, response, body) {

                if(error) {
                    console.log("[gamelog] post error");
                    return
                }

                if (response.statusCode == 200) {
                    console.log("[gamelog] post ok");
                }
            }
        );
    }
}