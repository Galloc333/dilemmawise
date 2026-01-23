import { NextResponse } from "next/server";
import { performWebSearch } from "@/lib/webSearch";

/**
 * Public Web Search API Endpoint
 * Wraps the internal search service for external calls if needed.
 */
export async function POST(request) {
    try {
        const { query } = await request.json();

        if (!query) {
            return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }

        const results = await performWebSearch(query);

        return NextResponse.json({
            results,
            query
        });

    } catch (error) {
        console.error("Web Search API Error:", error);
        return NextResponse.json({
            error: error.message,
            results: []
        }, { status: 500 });
    }
}
