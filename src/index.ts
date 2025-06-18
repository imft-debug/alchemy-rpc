interface Env {
	CORS_ALLOW_ORIGIN: string;
	ALCHEMY_API_KEY: string;
}

const ALCHEMY_ETH_RPC = "https://eth-mainnet.g.alchemy.com/v2/";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
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

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 200, headers: corsHeaders });
		}

		try {
			const payload = await request.text();

			const proxyRequest = new Request(`${ALCHEMY_ETH_RPC}${env.ALCHEMY_API_KEY}`, {
				method: "POST",
				body: payload || null,
				headers: {
					"Content-Type": "application/json",
				}
			});

			const response = await fetch(proxyRequest);
			const responseBody = await response.text();

			return new Response(responseBody, {
				status: response.status,
				headers: corsHeaders,
			});
		} catch (error) {
			// Generic JSON-RPC error with hidden details
			const errorPayload = {
				jsonrpc: "2.0",
				error: {
					code: -92500,
					message: "Internal RPC proxy error"
				},
				id: null
			};

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
