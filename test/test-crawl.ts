import { crawlPagePolicyAction } from "../src/plugin";
import { IAgentRuntime, Memory } from "@elizaos/core";

// Mock global fetch
const originalFetch = global.fetch;
global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = url.toString();
    if (urlStr.includes("sitemap.xml")) {
        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://mock.com/privacy-policy</loc></url><url><loc>https://mock.com/terms</loc></url><url><loc>https://mock.com/about</loc></url></urlset>`,
            { status: 200 }
        );
    }
    if (urlStr.includes("privacy")) {
        return new Response(`<html><body><main><h1>Privacy Policy</h1><p>We respect your privacy.</p></main></body></html>`, { status: 200 });
    }
    if (urlStr.includes("terms")) {
        return new Response(`<html><body><main><h1>Terms of Service</h1><p>By using this site, you agree.</p></main></body></html>`, { status: 200 });
    }
    return new Response("Not Found", { status: 404 });
};

async function runTest() {
    console.log("Starting test-crawl.ts...");
    
    const createdMemories: any[] = [];
    
    // Mock runtime
    const mockRuntime: any = {
        agentId: "test-agent-123",
        getService: (type: string) => {
            if (type === "knowledge") {
                return {
                    addKnowledge: async (opts: any) => {
                        createdMemories.push(opts);
                        return { fragmentCount: 1 };
                    }
                };
            }
            return null;
        },
        messageManager: {
            createMemory: async (mem: any) => {
                createdMemories.push(mem);
            }
        }
    };

    // Mock message
    const mockMessage: Memory = {
        id: "msg-123" as any,
        userId: "user-123" as any,
        agentId: "test-agent-123" as any,
        roomId: "room-123" as any,
        content: {
            text: "crawl https://mock.com for policies",
        }
    };

    let finalResponse = "";
    const callback = async (response: any) => {
        finalResponse = response.text;
    };

    await crawlPagePolicyAction.handler!(mockRuntime as IAgentRuntime, mockMessage, undefined, undefined, callback);

    console.log("\n--- TEST RESULTS ---");
    console.log(`Created Memories: ${createdMemories.length}`);
    console.log(`Callback Text: ${finalResponse}`);

    // Expect 2 memories total: 1 per page matched going into addKnowledge
    if (finalResponse.includes("Discovery complete") && createdMemories.length === 2) {
        console.log("✅ TEST PASSED");
        process.exit(0);
    } else {
        console.error("❌ TEST FAILED. Expected 2 memories, got " + createdMemories.length);
        process.exit(1);
    }
}

runTest().finally(() => {
    // Restore fetch
    global.fetch = originalFetch;
});
