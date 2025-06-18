interface Env {
    CORS_ALLOW_ORIGIN: string;
    ALCHEMY_API_KEY: string;
    ALCHEMY_NETWORK?: string;
}

export default {
    async fetch(request: Request, env: Env) {
        // CORS handling
        const supportedDomains = env.CORS_ALLOW_ORIGIN ? env.CORS_ALLOW_ORIGIN.split(',') : undefined;
        const corsHeaders: Record<string, string> = {
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Content-Type": "application/json"
        };

        if (supportedDomains) {
            const origin = request.headers.get('Origin');
            if (origin && supportedDomains.includes(origin)) {
                corsHeaders['Access-Control-Allow-Origin'] = origin;
            }
        } else {
            corsHeaders['Access-Control-Allow-Origin'] = '*';
        }

        // Handle OPTIONS requests
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 200,
                headers: corsHeaders,
            });
        }

        // Determine the Alchemy base URL
        const network = env.ALCHEMY_NETWORK || 'eth-mainnet';
        const alchemyBaseUrl = `https://${network}.g.alchemy.com/v2`;

        try {
            // Handle WebSocket upgrades
            const upgradeHeader = request.headers.get('Upgrade');
            if (upgradeHeader === 'websocket') {
                const wsUrl = `wss://${network}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
                return await fetch(wsUrl, request);
            }

            // Parse the incoming request
            const url = new URL(request.url);
            const path = url.pathname;
            
            // Validate the path to prevent API key exposure
            if (path.includes(env.ALCHEMY_API_KEY)) {
                return new Response(JSON.stringify({
                    jsonrpc: "2.0",
                    error: {
                        code: -32000,
                        message: "Invalid request"
                    },
                    id: null
                }), {
                    status: 400,
                    headers: corsHeaders
                });
            }

            // Get request body or create empty for GET requests
            let requestBody = await request.text();
            let method = request.method;
            
            // Handle GET requests (convert to POST for Alchemy)
            if (method === 'GET') {
                method = 'POST';
                if (!requestBody) {
                    requestBody = JSON.stringify({
                        jsonrpc: "2.0",
                        method: "eth_blockNumber",
                        params: [],
                        id: 1
                    });
                }
            }

            // Create the proxy request to Alchemy
            const proxyUrl = `${alchemyBaseUrl}/${env.ALCHEMY_API_KEY}`;
            const proxyRequest = new Request(proxyUrl, {
                method: method,
                body: requestBody || null,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
            });

            // Forward the request to Alchemy
            const response = await fetch(proxyRequest);
            
            // Process the response to ensure no API key leaks
            let responseBody = await response.text();
            if (responseBody.includes(env.ALCHEMY_API_KEY)) {
                responseBody = responseBody.replace(new RegExp(env.ALCHEMY_API_KEY, 'g'), '[REDACTED]');
            }

            // Return the sanitized response
            return new Response(responseBody, {
                status: response.status,
                headers: corsHeaders
            });

        } catch (error) {
            console.error('Error processing request:', error);
            return new Response(JSON.stringify({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Internal server error"
                },
                id: null
            }), {
                status: 500,
                headers: corsHeaders
            });
        }
    },
};
