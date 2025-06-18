interface Env {
	CORS_ALLOW_ORIGIN: string;
	ALCHEMY_API_KEY: string;
}

const ALCHEMY_ETH_RPC = "https://eth-mainnet.g.alchemy.com/v2/";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// CORS Configuration
		const supportedDomains = env.CORS_ALLOW_ORIGIN ? env.CORS_ALLOW_ORIGIN.split(',') : undefined;
		const corsHeaders: Record<string, string> = {
			"Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
			"Access-Control-Allow-Headers": "*",
		};

		const origin = request.headers.get('Origin');
		if (supportedDomains?.includes(origin || '')) {
			corsHeaders['Access-Control-Allow-Origin'] = origin!;
		} else {
			corsHeaders['Access-Control-Allow-Origin'] = '*';
		}

		// Handle OPTIONS method (CORS pre-flight)
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 200, headers: corsHeaders });
		}

		try {
			// Get the request payload (the JSON-RPC request body)
			const payload = await request.text();

			// Build the URL to send the request to Alchemy
			const alchemyUrl = `${ALCHEMY_ETH_RPC}${env.ALCHEMY_API_KEY}`;

			// Create the proxy request to Alchemy's Ethereum RPC endpoint
			const proxyRequest = new Request(alchemyUrl, {
				method: "POST",
				body: payload || null,
				headers: {
					"Content-Type": "application/json",
				}
			});

			// Forward the request and get the response
			const response = await fetch(proxyRequest);
			const responseBody = await response.text();

			// Return Alchemy's response back to the client
			return new Response(responseBody, {
				status: response.status,
				headers: corsHeaders,
			});
		} catch (error) {
			// In case of error, return a standard JSON-RPC error with code -92500
			const errorPayload = {
				jsonrpc: "2.0",
				error: {
					code: -92500,
					message: "Internal RPC proxy error"
				},
				id: null
			};

			// Respond with the error and a 500 status code
			return new Response(JSON.stringify(errorPayload), {
				status: 500,
				headers: {
					...corsHeaders,
					"Content-Type": "application/json"
				}
			});
		}
	},
};
