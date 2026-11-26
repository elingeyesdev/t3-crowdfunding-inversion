import { useAsyncResource } from './useAsyncResource.ts';
import { getCapitalOverview, getMyInvestments } from '../api/investor.api';
import { getApiErrorStatus } from '../utils/apiError.ts';
async function loadOverview() {
 const [capital, investments] = await Promise.all([getCapitalOverview(), getMyInvestments()]);
 return {capital, investments};
}
export function useInvestorDashboard() {
 const resource = useAsyncResource(loadOverview);
 return {data: resource.data?.capital ?? null, investments: resource.data?.investments ?? [], loading: resource.loading, error: resource.error ? getApiErrorStatus(resource.error) === 404 ? 'No tienes perfil de donador.' : 'Error al cargar datos financieros.' : null, refetch: resource.refetch};
}
