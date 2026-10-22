import { notFound } from "next/navigation";
import { findBranch } from "@/branches/branches";

// Checked here, outside the loading boundary, so an unknown slug gets a real 404
// instead of a streamed 200 with noindex.
export default async function BranchLayout({ children, params }: LayoutProps<"/[branch]">) {
  if (!findBranch((await params).branch)) notFound();
  return children;
}
