import { useAsyncResource } from './useAsyncResource.ts';
import { getMe, logout } from '../api/auth.api';
import { getApiErrorStatus, getApiErrorMessage } from '../utils/apiError.ts';
async function loadUser() {
 try {return {user: await getMe()};}
 catch(error) {if(getApiErrorStatus(error) !== 401) throw error; await logout().catch(() => {}); return {user: null};}
}
export function useAuth() {
 const resource = useAsyncResource(loadUser, !!localStorage.getItem('accessToken'));
 return {user: resource.data?.user ?? null, loading: resource.loading, error: resource.error ? getApiErrorMessage(resource.error, 'Error al cargar los datos del usuario') : null, refreshUser: resource.refetch};
}
