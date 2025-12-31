
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: '*',
    }
});
const https = require('https');
const Ably = require('ably');

// Accept JSON bodies for API endpoints
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Chat State
let onlineCount = 0;
const messageHistory = [];

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('onlineCount', onlineCount);
    
    // Send history
    socket.emit('chatHistory', messageHistory.slice(-50));

    // Handle Chat
    socket.on('chatMessage', (data) => {
        const msg = {
            id: Date.now(),
            user: data.user || 'Farmer',
            text: data.text,
            role: data.role || 'user', // Pass role through
            time: new Date().toLocaleTimeString()
        };
        messageHistory.push(msg);
        if (messageHistory.length > 100) messageHistory.shift();
        
        io.emit('chatMessage', msg);
    });

    socket.on('disconnect', () => {
        onlineCount--;
        io.emit('onlineCount', onlineCount);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log('Farm Server running on port ' + PORT + ' (accessible remotely)');
    
    // Auto-open browser
    const url = 'http://localhost:' + PORT;
    const start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
    require('child_process').exec(start + ' ' + url);
});

// ------------------------------------------------------------------
const ABLY_BASIC_AUTH = process.env.ABLY_BASIC_AUTH;
if (!ABLY_BASIC_AUTH) {
    console.error('ABLY_BASIC_AUTH environment variable is required. Exiting.');
    process.exit(1);
}

// Initialize Ably Realtime (and REST access via .rest)
const ably = new Ably.Realtime(ABLY_BASIC_AUTH);

ably.connection.on('connected', () => {
    console.log('Connected to Ably realtime.');
});
ably.connection.on('failed', (err) => {
    console.error('Ably connection failed:', err);
});

// Subscribe to incoming messages on the channel and forward to socket.io
const ablyChannelName = 'getting-started-widget';
const ablyChannel = ably.channels.get(ablyChannelName);
ablyChannel.subscribe((msg) => {
    try {
        console.log('Ably -> received message:', msg.name, msg.data);
        const outbound = {
            id: Date.now(),
            user: msg.name || 'Ably',
            text: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data),
            role: 'user',
            time: new Date().toLocaleTimeString()
        };
        // Broadcast to connected clients
        io.emit('chatMessage', outbound);
        // keep history
        messageHistory.push(outbound);
        if (messageHistory.length > 100) messageHistory.shift();
    } catch (e) {
        console.error('Error handling Ably message:', e);
    }
});

// Publish endpoint uses Ably SDK (server-side)
// Ably Publish Proxy
// ------------------------------------------------------------------
app.post('/api/ably/publish', (req, res) => {
    // Expect { channel, name, data }
    const channel = req.body.channel || ablyChannelName;
    const name = req.body.name || req.body.user || 'GameChat';
    const data = req.body.data || req.body.text || '';

    try {
        ably.rest.channels.get(channel).publish(name, data, (err) => {
            if (err) {
                console.error('Ably publish error:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('Published to Ably channel', channel, { name, data });
            return res.json({ status: 'ok' });
        });
    } catch (e) {
        console.error('Ably publish exception:', e);
        return res.status(500).json({ error: e.message });
    }
});

