interface Env {
    CORS_ALLOW_ORIGIN: string;
    ALCHEMY_API_KEY: string;
    ALCHEMY_NETWORK?: string; // Optional: e.g., "eth-mainnet", "eth-goerli", etc.
}

export default {
    async fetch(request: Request, env: Env) {
        // CORS handling
        const supportedDomains = env.CORS_ALLOW_ORIGIN ? env.CORS_ALLOW_ORIGIN.split(',') : undefined;
        const corsHeaders: Record<string, string> = {
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "*",
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
        const alchemyBaseUrl = `https://${network}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;

        // Handle WebSocket upgrades
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader === 'websocket') {
            const wsUrl = `wss://${network}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
            return await fetch(wsUrl, request);
        }

        // Process regular RPC requests
        try {
            // Parse the incoming request
            const url = new URL(request.url);
            const requestBody = await request.text();
            
            // Create the proxy request to Alchemy
            const proxyRequest = new Request(alchemyBaseUrl, {
                method: request.method,
                body: requestBody || null,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Alchemy-Cloudflare-Proxy': 'true',
                    ...(request.headers.get('Accept') && { 'Accept': request.headers.get('Accept')! }),
                }
            });

            // Forward the request to Alchemy
            const response = await fetch(proxyRequest);
            
            // Return the response with CORS headers
            return new Response(response.body, {
                status: response.status,
                headers: {
                    ...corsHeaders,
                    'Content-Type': response.headers.get('Content-Type') || 'application/json',
                },
            });
        } catch (error) {
            console.error('Error processing request:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
            });
        }
    },
};
