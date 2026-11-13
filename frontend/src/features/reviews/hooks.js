import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decideReview, getReview, listReviewQueue } from '../../services/workflowApi'
import { normalizeReviewDetail, normalizeTask } from './model'

const toTasks = (list) => list.map(normalizeTask)

export function useReviewQueue(level) {
  return useQuery({
    queryKey: ['reviewQueue', level],
    queryFn: () => listReviewQueue(level),
    select: toTasks,
    enabled: Boolean(level),
  })
}

export function useReviewDetail(taskId) {
  return useQuery({
    queryKey: ['review', taskId],
    queryFn: () => getReview(taskId),
    select: normalizeReviewDetail,
    enabled: Boolean(taskId),
  })
}

export function useDecideReview(taskId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => decideReview(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review', taskId] })
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] })
    },
  })
}
