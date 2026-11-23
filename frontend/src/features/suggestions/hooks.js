import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptSuggestion,
  dismissSuggestion,
  editSuggestion,
  fetchPublishedContent,
  listDriftAlerts,
  listSuggestions,
} from '../../services/workflowApi'
import { normalizeDriftAlert, normalizeSuggestion } from './model'

const toSuggestions = (list) => list.map(normalizeSuggestion)
const toAlerts = (list) => list.map(normalizeDriftAlert)

/** status rỗng hoặc undefined là lấy tất cả trạng thái. */
export function useSuggestions(status) {
  return useQuery({
    queryKey: ['suggestions', status ?? 'all'],
    queryFn: () => listSuggestions(status),
    select: toSuggestions,
  })
}

export function useDriftAlerts(documentId) {
  return useQuery({
    queryKey: ['driftAlerts', documentId],
    queryFn: () => listDriftAlerts(documentId),
    select: toAlerts,
    enabled: Boolean(documentId),
  })
}

export function usePublishedContent(documentId) {
  return useQuery({
    queryKey: ['publishedContent', documentId],
    queryFn: () => fetchPublishedContent(documentId),
    enabled: Boolean(documentId),
    retry: false,
  })
}

/** Accept, Edit, Dismiss dùng chung một cách làm mới dữ liệu. */
function useSuggestionAction(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['driftAlerts'] })
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] })
    },
  })
}

export const useAcceptSuggestion = () => useSuggestionAction((id) => acceptSuggestion(id))
export const useEditSuggestion = () => useSuggestionAction(({ id, content }) => editSuggestion(id, content))
export const useDismissSuggestion = () => useSuggestionAction(({ id, reason }) => dismissSuggestion(id, reason))
