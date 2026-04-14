import WebSocket from 'ws';
import fetch from 'node-fetch';

async function verifyNativeWebSocket() {
    console.log("🔍 [WS Verification] Starting native endpoint check...");

    // 1. Get Agent ID
    let agentId = "";
    try {
        const response = await fetch('http://localhost:3000/api/agents');
        const json = await response.json() as any;
        const agents = json?.data?.agents || [];
        if (agents && agents.length > 0) {
            agentId = agents[0].id;
            console.log(`✅ [WS Verification] Found live agent: ${agents[0].name} (${agentId})`);
        } else {
            console.error("❌ [WS Verification] No agents found. Is the server running?");
            process.exit(1);
        }
    } catch (e) {
        console.error("❌ [WS Verification] Failed to connect to API. Is the server running on port 3000?");
        process.exit(1);
    }

    // 2. Connect to Native WS
    // ElizaOS direct client typically listens for agents on /api/agents/:id/ws
    // Ensure we use the correct IP and headers to avoid origin/hangup issues
    const wsUrl = `ws://127.0.0.1:3000/api/agents/${agentId}/ws`;
    console.log(`📡 [WS Verification] Connecting to ${wsUrl}...`);

    await new Promise(r => setTimeout(r, 1000));

    const ws = new WebSocket(wsUrl, {
        headers: {
            "Host": "127.0.0.1:3000",
            "Origin": "http://127.0.0.1:3000"
        }
    });

    ws.on('open', () => {
        console.log("🔓 [WS Verification] Connection opened successfully.");
        
        const testPayload = {
            type: 'message',
            userId: 'test-user-999',
            roomId: 'test-room-999',
            content: { 
                text: "Ping from verification script",
                source: "websocket-verification"
            }
        };

        console.log("📤 [WS Verification] Sending test message...");
        ws.send(JSON.stringify(testPayload));
    });

    let chunkReceived = false;
    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log(`📥 [WS Verification] Received event: ${msg.type}`);
        
        if (msg.type === 'chunk') {
            chunkReceived = true;
            console.log(`   > Chunk text: "${msg.text}"`);
        }

        if (msg.type === 'complete') {
            console.log("✅ [WS Verification] Successfully received 'complete' event.");
            console.log(`   > Full response: "${msg.text?.slice(0, 50)}..."`);
            console.log(`   > Actions: [${msg.actions?.join(', ')}]`);
            
            if (chunkReceived) {
                console.log("\n✨ VERIFICATION SUCCESSFUL: Native agent WebSocket is active and streaming.");
            } else {
                console.log("\n⚠️ VERIFICATION PARTIAL: Got complete response but no chunks. (Streaming might be disabled or fast)");
            }
            ws.close();
            process.exit(0);
        }
    });

    ws.on('error', (err) => {
        console.error("❌ [WS Verification] WebSocket Error:", err.message);
        process.exit(1);
    });

    ws.on('close', () => {
        console.log("🔌 [WS Verification] Connection closed.");
    });

    // Timeout
    setTimeout(() => {
        console.error("⏰ [WS Verification] Timeout waiting for agent response.");
        ws.close();
        process.exit(1);
    }, 15000);
}

verifyNativeWebSocket();
