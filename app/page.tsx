import { redirect } from 'next/navigation'
import { PodcastList } from '@/components/podcast/list'

export const revalidate = 600

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const query = await searchParams
  const pageParam = query.page

  if (pageParam !== undefined) {
    const requestedPage = Number(pageParam)
    if (Number.isInteger(requestedPage) && requestedPage > 1) {
      redirect(`/page/${requestedPage}`)
    }

    redirect('/')
  }

  return <PodcastList currentPage={1} />
}
