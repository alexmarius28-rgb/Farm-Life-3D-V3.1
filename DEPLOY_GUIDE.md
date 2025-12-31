# How to Keep the Server Online (Deployment Guide)

To allow other players to join your game from anywhere, you need to host the `server.js` file on a cloud service.
Here are two free and easy ways to do it:

## Option 1: Render.com (Recommended)
1.  Create a GitHub repository for your project.
2.  Push your project files (including `package.json` and `server.js`) to GitHub.
3.  Go to [Render.com](https://render.com) and sign up.
4.  Click **New +** -> **Web Service**.
5.  Connect your GitHub repository.
6.  Render will detect `Node.js`.
    *   **Build Command:** `npm install`
    *   **Start Command:** `node server.js`
7.  Click **Create Web Service**.
8.  Once deployed, Render will give you a URL (e.g., `https://farm-sim.onrender.com`).
9.  **In Game:** Open Settings -> Server, paste this URL, and click Save.

## Option 2: Glitch.com (Fastest)
1.  Go to [Glitch.com](https://glitch.com).
2.  Click **New Project** -> **glitch-hello-node**.
3.  Copy the content of your `package.json` into Glitch's `package.json`.
4.  Copy the content of your `server.js` into Glitch's `server.js`.
5.  Glitch will automatically start the server.
6.  Click **Share** -> **Live Site** to get your URL.
7.  **In Game:** Open Settings -> Server, paste this URL, and click Save.

## Option 3: Local Hosting (For friends on same WiFi)
1.  Run `node server.js` on your computer.
2.  Find your local IP address (e.g., `192.168.1.5`).
3.  Friends can connect by entering `http://192.168.1.5:3000` in the Settings.

## Ably Integration (Global Chat Relay)

The server can proxy chat messages to Ably's REST API so your global chat is published to an Ably channel. To enable this, set an environment variable with the Ably basic auth string (username:secret).

1. Set the environment variable before starting the server (recommended):

```powershell
$env:ABLY_BASIC_AUTH = "IqLf0A.dELi5A:lpIoCk_KaQCOZxXgQSSmWWRsVqHACUP5RyzruVjYOAA"
node server.js
```

Or on Linux/macOS:

```bash
export ABLY_BASIC_AUTH="IqLf0A.dELi5A:lpIoCk_KaQCOZxXgQSSmWWRsVqHACUP5RyzruVjYOAA"
node server.js
```

2. The server exposes a POST endpoint `/api/ably/publish` that the client uses to forward chat messages to Ably. You can also test it directly with curl:

```bash
curl -X POST https://your-server.example.com/api/ably/publish \
    -H "Content-Type: application/json" \
    --data '{"channel":"getting-started-widget","name":"cURL","data":"Message Published!"}'
```

Security note: Do not commit your Ably credentials into source control. Prefer storing them in environment variables on your host.
