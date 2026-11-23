// Gom handler của cụm Gợi ý drift và Duyệt. Thêm vào danh sách handler chung của MSW:
//   setupWorker(...authHandlers, ...workflowHandlers)
import { resetReviewsMock, reviewHandlers } from './reviews'
import { resetSuggestionsMock, suggestionHandlers } from './suggestions'

export const workflowHandlers = [...suggestionHandlers, ...reviewHandlers]

export function resetWorkflowMocks() {
  resetSuggestionsMock()
  resetReviewsMock()
}
