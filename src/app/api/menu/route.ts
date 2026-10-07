import { NextResponse } from "next/server";
import { getMenu } from "@/cms/repository";
import { publicMenu } from "@/cms/schema";
export const dynamic = "force-dynamic";
export async function GET() {
  const { menu, revision } = await getMenu();
  return NextResponse.json(
    { revision, menu: publicMenu(menu) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
