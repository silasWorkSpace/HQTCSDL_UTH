import { useState, useEffect, useCallback, useRef } from 'react';

const queryListeners = new Set();

export function useQueryClient() {
  return {
    invalidateQueries: (opts) => {
      queryListeners.forEach((listener) => {
        try {
          listener(opts);
        } catch (e) {
          console.error('[QueryShim] Listener error:', e);
        }
      });
    },
  };
}

export function useQuery({ queryKey = [], queryFn, select, enabled = true }) {
  const [state, setState] = useState({
    data: undefined,
    isPending: enabled,
    isError: false,
    error: null,
  });

  const queryKeyStr = JSON.stringify(queryKey);
  const fnRef = useRef(queryFn);
  fnRef.current = queryFn;
  const selectRef = useRef(select);
  selectRef.current = select;

  const fetchData = useCallback(async () => {
    if (!enabled || !fnRef.current) return;
    setState((prev) => ({ ...prev, isPending: true, isError: false, error: null }));
    try {
      const res = await fnRef.current();
      const finalData = selectRef.current ? selectRef.current(res) : res;
      setState({
        data: finalData,
        isPending: false,
        isError: false,
        error: null,
      });
    } catch (err) {
      setState({
        data: undefined,
        isPending: false,
        isError: true,
        error: err,
      });
    }
  }, [enabled, queryKeyStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleInvalidation = (opts) => {
      if (!opts?.queryKey) {
        fetchData();
        return;
      }
      const matchPrefix = opts.queryKey.every((k, idx) => queryKey[idx] === k);
      if (matchPrefix) {
        fetchData();
      }
    };
    queryListeners.add(handleInvalidation);
    return () => {
      queryListeners.delete(handleInvalidation);
    };
  }, [fetchData, queryKeyStr]);

  return {
    ...state,
    refetch: fetchData,
  };
}

export function useMutation({ mutationFn, onSuccess, onError }) {
  const [isPending, setIsPending] = useState(false);
  const fnRef = useRef(mutationFn);
  fnRef.current = mutationFn;
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const mutate = useCallback(async (variables, { onSuccess: localSuccess, onError: localError } = {}) => {
    setIsPending(true);
    try {
      const result = await fnRef.current(variables);
      setIsPending(false);
      if (successRef.current) successRef.current(result);
      if (localSuccess) localSuccess(result);
      return result;
    } catch (err) {
      setIsPending(false);
      if (errorRef.current) errorRef.current(err);
      if (localError) localError(err);
      throw err;
    }
  }, []);

  return {
    mutate,
    isPending,
  };
}

export default {
  useQuery,
  useMutation,
  useQueryClient,
};
