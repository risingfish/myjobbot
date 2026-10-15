import { NextResponse, type NextRequest } from "next/server.js";
import { callbackTarget } from "../../../../lib/gmailConnect.js";

export const dynamic = "force-dynamic";

/** Finishes a Google sign-in and sends the owner back to Settings with a fixed outcome code. */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const params = request.nextUrl.searchParams;
    const callback = { state: params.get("state"), code: params.get("code"), error: params.get("error"), host: request.headers.get("host") ?? "" };
    return NextResponse.redirect(new URL(await callbackTarget(callback), request.url));
}
