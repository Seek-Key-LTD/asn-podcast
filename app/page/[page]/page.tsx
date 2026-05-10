import { redirect } from 'next/navigation'
import { PodcastList } from '@/components/podcast/list'

export const revalidate = 600

interface PageProps {
  params: Promise<{ page: string }>
}

export default async function Page({ params }: PageProps) {
  const { page } = await params
  const currentPage = Number(page)

  if (!Number.isInteger(currentPage) || currentPage <= 1) {
    redirect('/')
  }

  return <PodcastList currentPage={currentPage} />
}
