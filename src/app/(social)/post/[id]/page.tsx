import { PostDetail } from "@/components/social/PostDetail";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetail postId={id} />;
}
