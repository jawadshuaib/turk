import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InvestorDetailRedirect({
  params,
}: {
  params: { id: string };
}) {
  // Look up by investor project ID, redirect to the project page
  const ip = await prisma.investorProject.findUnique({
    where: { id: params.id },
    select: { projectId: true },
  });

  if (ip) {
    redirect(`/projects/${ip.projectId}`);
  }

  // Fallback: maybe the ID is already a project ID
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (project) {
    redirect(`/projects/${project.id}`);
  }

  redirect("/projects");
}
