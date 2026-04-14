import { stringToUuid, type UUID } from "@elizaos/core";
import fetch from "node-fetch";

/**
 * SQL Inject Script
 * 
 * Re-primes the database with initial knowledge fragments.
 * Note: Actual similarity search is currently disabled in the plugin
 * to prevent crashes, so this serves as a data-only prime for now.
 */
async function sqlInject() {
    console.log("🚀 [SQL-Inject] Starting knowledge injection...");

    const agentId = "ef00de47-7fd2-0da5-8ddd-b046d1de230d";
    const roomId = stringToUuid("privora-main-room") as UUID;

    const initialKnowledge = [
        {
            domain: "nosana.io",
            url: "https://nosana.io/privacy",
            content: "Nosana is a decentralized compute network. This mock policy ensures data privacy on the blockchain.",
            type: "privacy"
        },
        {
            domain: "elizaos.ai",
            url: "https://elizaos.ai/terms",
            content: "ElizaOS is an autonomous agent framework. Usage implies consent to decentralized knowledge processing.",
            type: "terms"
        }
    ];

    for (const k of initialKnowledge) {
        console.log(`📦 [SQL-Inject] Injecting knowledge for ${k.domain}...`);
        const domainId = stringToUuid(roomId + "-" + k.domain) as UUID;

        try {
            const response = await fetch(`http://localhost:3000/api/agents/${agentId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `INTERNAL_INJECT: ${k.content}`,
                    userId: "admin",
                    roomId: roomId,
                    metadata: {
                        inject: true,
                        domain: k.domain,
                        source: k.url,
                        policyType: k.type,
                        clientDocumentId: domainId
                    }
                })
            });

            if (response.ok) {
                console.log(`✅ [SQL-Inject] Success for ${k.domain}`);
            } else {
                console.error(`❌ [SQL-Inject] Failed for ${k.domain}: ${response.statusText}`);
            }
        } catch (err: any) {
            console.error(`❌ [SQL-Inject] Error: ${err.message}`);
        }
    }

    console.log("✨ [SQL-Inject] Injection complete.");
}

sqlInject();
