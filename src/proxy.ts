import { NextResponse, type NextRequest } from "next/server";
import { BRANCH_COOKIE, findBranch } from "@/branches/branches";

// Returning visitors skip the branch picker: "/" sends them to their last branch
// before anything renders. "/?pick=1" always shows the picker.
export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.has("pick")) return NextResponse.next();
  const branch = findBranch(request.cookies.get(BRANCH_COOKIE)?.value);
  if (!branch) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${branch.slug}`;
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: "/" };
