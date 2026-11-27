import { useAsyncResource } from './useAsyncResource.ts';
import { getCapitalOverview, getMyInvestments } from '../api/investor.api';
import { getApiErrorStatus } from '../utils/apiError.ts';
export function useInvestorCapital() {
  const resource = useAsyncResource(getCapitalOverview);
  return {
    data: !resource.loading && !resource.error ? resource.data : null,
    loading: resource.loading,
    error: resource.error,
    isNewProfile: !resource.loading && getApiErrorStatus(resource.error) === 404,
    retry: resource.retry,
  };
}

export function useInvestorDashboard() {
  const capital = useInvestorCapital();
  const history = useAsyncResource(getMyInvestments);
  return {
    ...capital,
    investments: !history.loading && !history.error ? history.data ?? [] : [],
    investmentsLoading: history.loading,
    investmentsError: history.error,
    retryInvestments: history.retry,
    refetch: () => { capital.retry(); history.retry(); },
  };
}
