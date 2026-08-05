import EvalRunPage from '@/components/eval/EvalRunPage';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <EvalRunPage runId={id} />;
}
