import { NextResponse } from "next/server";
import { readMenu } from "@/cms/repository";
import { publicMenu } from "@/cms/schema";
export const dynamic = "force-dynamic";
export async function GET() {
  const { menu, revision } = await readMenu();
  return NextResponse.json(
    { revision, menu: publicMenu(menu) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
