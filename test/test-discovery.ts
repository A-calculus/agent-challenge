import { Memory, IAgentRuntime, UUID, stringToUuid } from "@elizaos/core";
import { searchPolicyDiscoveryAction } from "../src/plugin.js";

async function runTest() {
    console.log("Starting test-discovery.ts...");

    const createdMemories: any[] = [];
    let finalResponse = "";

    // Mock runtime
    const mockRuntime: any = {
        agentId: "test-agent-123",
        getService: (type: string) => {
            if (type === "TAVILY") {
                return {
                    search: async (query: string, opts: any) => {
                        console.log(`[Mock Tavily] searching for: ${query}`);
                        return {
                            answer: "Found hidden policy pages.",
                            results: [
                                { url: "https://mock.com/privacy", title: "Privacy" },
                                { url: "https://mock.com/terms", title: "Terms" },
                                { url: "https://other.com/scam", title: "Scam" } // Should be filtered out
                            ]
                        };
                    }
                };
            }
            if (type === "knowledge") {
                return {
                    addKnowledge: async (opts: any) => {
                        createdMemories.push(opts);
                        return { fragmentCount: 1 };
                    }
                };
            }
            return null;
        }
    };

    // Generic fetch mock for crawler handoff
    global.fetch = async (url: any) => {
        return {
            ok: true,
            text: async () => `<html><body><h1>Policy Content for ${url}</h1><main>Clean text from ${url}</main></body></html>`,
            status: 200
        } as any;
    };

    const mockMessage: Memory = {
        id: "msg-123" as UUID,
        agentId: "test-agent-123" as UUID,
        userId: "user-123" as UUID,
        roomId: "room-123" as UUID,
        content: { text: "Discover policies for mock.com" },
    };

    const callback = async (response: any) => {
        finalResponse = response.text;
    };

    // Run the action handler
    await (searchPolicyDiscoveryAction.handler as any)(mockRuntime, mockMessage, {}, {}, callback);

    console.log("\n--- TEST RESULTS ---");
    console.log(`Created Memories: ${createdMemories.length}`);
    console.log(`Callback Text Summary: ${finalResponse.slice(0, 100)}...`);

    // Expectations:
    // 1. Tavily called.
    // 2. https://other.com/scam filtered out.
    // 3. 2 memories created (privacy and terms).
    if (createdMemories.length === 2 && finalResponse.includes("Web Discovery complete")) {
        const urls = createdMemories.map(m => m.metadata.source);
        if (urls.includes("https://mock.com/privacy") && urls.includes("https://mock.com/terms") && !urls.includes("https://other.com/scam")) {
            console.log("✅ TEST PASSED: Discovery and strict domain filtering worked.");
            process.exit(0);
        } else {
            console.error("❌ TEST FAILED: Unexpected memory URLs:", urls);
            process.exit(1);
        }
    } else {
        console.error("❌ TEST FAILED. Expected 2 memories, got " + createdMemories.length);
        process.exit(1);
    }
}

runTest().catch(e => {
    console.error("Test execution error:", e);
    process.exit(1);
});
